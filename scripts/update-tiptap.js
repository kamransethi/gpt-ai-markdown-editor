#!/usr/bin/env node
/**
 * update-tiptap.js
 *
 * Fetches the latest version of every @tiptap/* package used in this project,
 * updates package.json, and runs `npm install` to lock the new versions.
 *
 * Run manually every few days to pick up daily bug fixes:
 *   node scripts/update-tiptap.js
 *
 * Flags:
 *   --dry-run   Show what would change without modifying any files.
 *   --no-build  Skip the roundtrip test and build after install.
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');

const DRY_RUN = process.argv.includes('--dry-run');
const NO_BUILD = process.argv.includes('--no-build');

// ─── Packages to update ───────────────────────────────────────────────────────
// All @tiptap/* scoped packages. tiptap-extension-* (third-party) are excluded
// because they have their own release cadence and may lag behind @tiptap/core.
const TIPTAP_PACKAGES = [
  '@tiptap/core',
  '@tiptap/extension-bubble-menu',
  '@tiptap/extension-character-count',
  '@tiptap/extension-code-block-lowlight',
  '@tiptap/extension-color',
  '@tiptap/extension-drag-handle',
  '@tiptap/extension-highlight',
  '@tiptap/extension-image',
  '@tiptap/extension-link',
  '@tiptap/extension-list',
  '@tiptap/extension-placeholder',
  '@tiptap/extension-table',
  '@tiptap/extension-table-cell',
  '@tiptap/extension-table-header',
  '@tiptap/extension-table-of-contents',
  '@tiptap/extension-table-row',
  '@tiptap/extension-text-style',
  '@tiptap/extension-typography',
  '@tiptap/extension-underline',
  '@tiptap/markdown',
  '@tiptap/pm',
  '@tiptap/starter-kit',
  '@tiptap/suggestion',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(msg + '\n');
}

function bold(s) {
  return `\x1b[1m${s}\x1b[0m`;
}

function green(s) {
  return `\x1b[32m${s}\x1b[0m`;
}

function yellow(s) {
  return `\x1b[33m${s}\x1b[0m`;
}

function red(s) {
  return `\x1b[31m${s}\x1b[0m`;
}

function getLatestVersion(pkg) {
  try {
    const result = execSync(`npm view ${pkg} version`, { encoding: 'utf-8', cwd: ROOT }).trim();
    return result;
  } catch {
    return null;
  }
}

function stripCaret(version) {
  return version.replace(/^[\^~]/, '');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

log('');
log(bold('━━━ TipTap Update Script ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
if (DRY_RUN) log(yellow('  DRY RUN — no files will be changed'));
log('');

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

// Determine which dep section each package lives in
const depSection = {};
for (const p of TIPTAP_PACKAGES) {
  if (pkg.dependencies?.[p]) depSection[p] = 'dependencies';
  else if (pkg.devDependencies?.[p]) depSection[p] = 'devDependencies';
}

const updates = []; // { pkg, from, to, section }
const notFound = [];

log(`  Checking ${TIPTAP_PACKAGES.length} packages against npm registry…`);
log('');

for (const p of TIPTAP_PACKAGES) {
  const currentRaw = allDeps[p];
  if (!currentRaw) {
    notFound.push(p);
    continue;
  }
  const current = stripCaret(currentRaw);
  const latest = getLatestVersion(p);
  if (!latest) {
    log(`  ${yellow('?')}  ${p} — could not resolve (skipping)`);
    continue;
  }
  if (latest !== current) {
    updates.push({ pkg: p, from: current, to: latest, section: depSection[p] });
    log(`  ${green('↑')}  ${bold(p)}  ${yellow(current)} → ${green(latest)}`);
  } else {
    log(`  ${green('✓')}  ${p}  ${current} (latest)`);
  }
}

if (notFound.length) {
  log('');
  log(yellow(`  Packages listed in script but not found in package.json (ignored):`));
  for (const p of notFound) log(`     ${p}`);
}

log('');

if (updates.length === 0) {
  log(green('  All TipTap packages are already up to date. Nothing to do.'));
  log('');
  process.exit(0);
}

log(bold(`  ${updates.length} package(s) will be updated.`));
log('');

if (DRY_RUN) {
  log(yellow('  Dry run complete. Rerun without --dry-run to apply.'));
  log('');
  process.exit(0);
}

// ─── Apply updates to package.json ───────────────────────────────────────────

log('  Updating package.json…');

for (const u of updates) {
  // Preserve the original range prefix (^ or ~) if the current entry had one.
  const currentRaw = pkg[u.section][u.pkg];
  const prefix = currentRaw.match(/^[\^~]/)?.[0] ?? '^';
  pkg[u.section][u.pkg] = prefix + u.to;
}

if (!DRY_RUN) {
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  log(green('  package.json updated.'));
}

log('');

// ─── npm install ─────────────────────────────────────────────────────────────

log('  Running npm install…');
log('');

const install = spawnSync('npm', ['install'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (install.status !== 0) {
  log('');
  log(red('  npm install failed. package.json has been updated but node_modules may be inconsistent.'));
  log(red('  Fix the install error then re-run: npm install'));
  process.exit(1);
}

log('');
log(green('  npm install complete.'));
log('');

// ─── Run roundtrip test to validate the update ───────────────────────────────

if (!NO_BUILD) {
  log('  Running roundtrip test to validate TipTap update…');
  log('');

  const test = spawnSync('npm', ['run', 'test:roundtrip'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  log('');

  if (test.status !== 0) {
    log(red('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    log(red('  ROUNDTRIP TEST FAILED after TipTap update.'));
    log(red('  A TipTap change broke markdown serialization.'));
    log(red(''));
    log(red('  To investigate:'));
    log(red('    npm run test:roundtrip'));
    log(red(''));
    log(red('  To revert:'));
    log(red('    git checkout package.json package-lock.json'));
    log(red('    npm install'));
    log(red('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    process.exit(1);
  }

  log(green('  Roundtrip test passed — TipTap update is safe to ship.'));
  log('');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

log(bold('━━━ Update complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
log('');
for (const u of updates) {
  log(`  ${green('✓')}  ${u.pkg}  ${yellow(u.from)} → ${green(u.to)}`);
}
log('');
log('  Review changes: git diff package.json package-lock.json');
log('  Then run:       npm run repackage');
log('');
