#!/usr/bin/env node

/**
 * Move VSIX to Versioned Release Folder
 *
 * After vsce package creates a VSIX file in the root directory,
 * this script moves it into the appropriate versioned folder
 * under releases/ based on the version in package.json.
 *
 * Usage:
 *   node scripts/move-vsix-to-release.js
 */

const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Construct paths
const versionFolder = `v${version}`;
const rootDir = path.join(__dirname, '..');
const releasesDir = path.join(rootDir, 'releases', versionFolder);
const vsixFilename = `${packageJson.name}-${version}.vsix`;
const vsixPath = path.join(rootDir, vsixFilename);
const targetPath = path.join(releasesDir, vsixFilename);

// Create versioned release folder if it doesn't exist
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
  console.log(`Created releases folder: ${versionFolder}`);
}

// Move VSIX file if it exists in root
if (fs.existsSync(vsixPath)) {
  fs.renameSync(vsixPath, targetPath);
  console.log(`✓ Moved VSIX to: releases/${versionFolder}/${vsixFilename}`);
} else {
  console.warn(`⚠ VSIX file not found: ${vsixFilename}`);
  console.warn(`Expected at: ${vsixPath}`);
  process.exit(1);
}

console.log('✓ VSIX file organized into versioned release structure');
