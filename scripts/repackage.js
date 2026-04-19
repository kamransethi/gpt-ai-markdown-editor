/**
 * Script to automatically:
 * 1. Increment package.json minor version
 * 2. Run release build
 * 3. Package extension into dist/ directory
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run() {
    try {
        console.log('--- Step 1: Incrementing Patch Version ---');
        // Bumps the last number (e.g., 1.2.0 -> 1.2.1)
        execSync('npm version patch --no-git-tag-version', { stdio: 'inherit' });

        console.log('\n--- Step 2: Running Release Build ---');
        execSync('npm run build:release', { stdio: 'inherit' });

        console.log('\n--- Step 3: Packaging VSIX to releases/ ---');
        // Ensure releases directory exists
        const releasesDir = path.join(__dirname, '..', 'releases');
        if (!fs.existsSync(releasesDir)) {
            fs.mkdirSync(releasesDir);
        } else {
            // Clean up existing VSIX files in releases to prevent them being included in the next package
            const files = fs.readdirSync(releasesDir);
            files.forEach(file => {
                if (file.endsWith('.vsix')) {
                    fs.unlinkSync(path.join(releasesDir, file));
                }
            });
            console.log('🧹 Cleaned up old VSIX files in releases/');
        }

        // Run vsce package and output to releases/
        // Matches the publisher and name from package.json
        execSync(`npx vsce package --out releases/`, { stdio: 'inherit' });

        console.log('\n✅ Successfully recompiled and packaged into releases/');

        // Read the version to show the new one
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        console.log(`🚀 New version: ${pkg.version}`);
    } catch (error) {
        console.error('\n❌ Error during recompile and package process:', error.message);
        process.exit(1);
    }
}

run();
