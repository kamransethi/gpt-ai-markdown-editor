#!/usr/bin/env node

/**
 * Build Script for Playwright Test Harness
 *
 * Bundles src/__tests__/playwright/harness/editor-harness.ts
 * into src/__tests__/playwright/harness/editor-harness.js so
 * index.html can load it as a plain script (no module bundler needed at runtime).
 *
 * Usage:
 *   node scripts/build-playwright-harness.js
 *   node scripts/build-playwright-harness.js --watch
 */

const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.resolve(__dirname, '../src/__tests__/playwright/harness/editor-harness.ts')],
  bundle: true,
  outfile: path.resolve(__dirname, '../src/__tests__/playwright/harness/editor-harness.js'),
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  loader: {
    '.css': 'empty',   // strip CSS imports — not needed for logic tests
    '.ttf': 'empty',
  },
  // TipTap optional peer deps — not used, shim to empty
  external: [
    '@tiptap/extension-collaboration',
    '@tiptap/y-tiptap',
    '@tiptap/extension-node-range',
  ],
};

async function run() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching harness for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('✅ Playwright harness built');
  }
}

run().catch(err => {
  console.error('❌ Harness build failed:', err);
  process.exit(1);
});
