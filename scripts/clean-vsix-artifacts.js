const fs = require('fs');
const path = require('path');

function deleteVsixFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const removed = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      removed.push(...deleteVsixFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith('.vsix')) {
      fs.unlinkSync(fullPath);
      removed.push(fullPath);
    }
  }

  return removed;
}

const distDir = path.join(__dirname, '..', 'dist');
const removedFiles = deleteVsixFiles(distDir);

if (removedFiles.length === 0) {
  console.log('No stale VSIX artifacts found in dist/.');
} else {
  console.log('Removed stale VSIX artifacts:');
  for (const filePath of removedFiles) {
    console.log(`- ${path.relative(path.join(__dirname, '..'), filePath)}`);
  }
}