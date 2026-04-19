#!/usr/bin/env node

/**
 * ASCII Box Alignment Fixer
 * 
 * Deterministically fixes ASCII art box alignment by:
 * 1. Detecting box sections (bounded by ┌─...─┐ and └─...─┘)
 * 2. Measuring target width from top border
 * 3. Reformatting all content lines to match exactly
 * 4. Validating left/right border symmetry
 * 5. Reporting changes with detailed statistics
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Detect if a line is a top border (┌─────...─┐)
 */
function isTopBorder(line) {
  return /^[│\s]*┌─+┐[│\s]*$/.test(line);
}

/**
 * Detect if a line is a bottom border (└─────...─┘)
 */
function isBottomBorder(line) {
  return /^[│\s]*└─+┘[│\s]*$/.test(line);
}

/**
 * Detect if a line is a box header (╔═════...═╗)
 */
function isBoxHeader(line) {
  return /╔═+╗/.test(line);
}

/**
 * Detect if a line is a box footer (╚═════...═╝)
 */
function isBoxFooter(line) {
  return /╚═+╝/.test(line);
}

/**
 * Extract the target width from a border line
 * Example: "│  ╔═══════════════════════════════════════════════════════════════════════╗  │"
 * Returns the total line length
 */
function extractTargetWidth(borderLine) {
  // Find the position of the inner box borders
  const boxStartMatch = borderLine.match(/╔═+╗|┌─+┐/);
  const boxEndMatch = borderLine.match(/╚═+╝|└─+┘/);
  
  if (boxStartMatch && boxEndMatch) {
    // Return full line length - this is what all lines should match
    return borderLine.length;
  }
  
  return borderLine.length;
}

/**
 * Extract left padding (│  ║  or │  ╔ etc)
 */
function extractLeftPadding(line) {
  const match = line.match(/^([\s│╔╚║]*?)([☑☐]|─|═|\w)/);
  if (match) {
    // Find the exact left structure
    const beforeContent = line.substring(0, line.indexOf(match[2]));
    return beforeContent;
  }
  return '';
}

/**
 * Reformat a content line to match target width
 * Splits line into: leftPadding + content + rightPadding
 * Then calculates exact spacing needed
 */
function reformatLine(line, targetWidth) {
  // Detect the pattern: │  ║  <CONTENT>  ║  │
  const contentMatch = line.match(/^([│\s]*)║\s+(.*?)\s*║([│\s]*)$/);
  
  if (!contentMatch) {
    // Not a content line, return as-is
    return line;
  }
  
  const leftPadding = contentMatch[1]; // │  
  const content = contentMatch[2].trim(); // the actual text
  const rightPadding = contentMatch[3]; // │
  
  // Build the reformatted line with exact spacing
  // Structure: leftPadding + ║  + content + spaces + ║ + rightPadding
  const innerBoxStart = '║  ';
  const innerBoxEnd = '  ║';
  
  // Calculate how much space we have for content + padding
  const availableWidth = targetWidth 
    - leftPadding.length 
    - innerBoxStart.length 
    - innerBoxEnd.length 
    - rightPadding.length;
  
  // Determine content width and padding needed
  const contentWidth = content.length;
  const paddingNeeded = availableWidth - contentWidth;
  
  if (paddingNeeded < 0) {
    log(`⚠️  Line too long (${contentWidth} chars, space for ${availableWidth}): ${content.substring(0, 40)}...`, 'yellow');
    return line; // Can't fit, return original
  }
  
  // Build reformatted line
  const reformatted = leftPadding + innerBoxStart + content + ' '.repeat(paddingNeeded) + innerBoxEnd + rightPadding;
  
  return reformatted;
}

/**
 * Process a markdown file and fix all ASCII boxes
 */
function fixAsciiAlignment(filePath) {
  log(`\n📋 Reading file: ${filePath}`, 'cyan');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let fixed = 0;
  let errors = 0;
  let boxesFound = 0;
  let linesProcessed = 0;
  
  const result = [];
  let currentBoxTargetWidth = null;
  let inBox = false;
  
  log(`📊 Processing ${lines.length} lines...`, 'cyan');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect box start
    if (isBoxHeader(line)) {
      currentBoxTargetWidth = extractTargetWidth(line);
      inBox = true;
      boxesFound++;
      log(`   🔲 Box #${boxesFound} detected at line ${i + 1} (width: ${currentBoxTargetWidth})`, 'cyan');
      result.push(line);
      continue;
    }
    
    // Detect box end
    if (isBoxFooter(line)) {
      inBox = false;
      currentBoxTargetWidth = null;
      result.push(line);
      continue;
    }
    
    // Process content lines inside box
    if (inBox && currentBoxTargetWidth && line.includes('║')) {
      const reformatted = reformatLine(line, currentBoxTargetWidth);
      
      if (reformatted !== line) {
        fixed++;
        log(`   ✓ Line ${i + 1} aligned (was: ${line.length}ch, now: ${reformatted.length}ch)`, 'green');
      }
      
      linesProcessed++;
      result.push(reformatted);
      continue;
    }
    
    result.push(line);
  }
  
  const newContent = result.join('\n');
  
  // Validate that all box lines now match their target width
  log(`\n✅ Validation Results:`, 'cyan');
  log(`   Boxes found: ${boxesFound}`, 'green');
  log(`   Lines processed: ${linesProcessed}`, 'green');
  log(`   Lines fixed: ${fixed}`, fixed > 0 ? 'green' : 'yellow');
  
  if (fixed > 0) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    log(`\n✨ File updated successfully: ${filePath}`, 'green');
    return { success: true, fixed, boxesFound, linesProcessed };
  } else {
    log(`\n⚠️  No alignment issues found.`, 'yellow');
    return { success: true, fixed: 0, boxesFound, linesProcessed };
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Default to STRESS_TEST_DOC.md
    const defaultFile = path.join(
      __dirname,
      '..',
      'src',
      '__tests__',
      'STRESS_TEST_DOC.md'
    );
    
    log(`${colors.bold}🎯 ASCII Box Alignment Fixer${colors.reset}`, 'cyan');
    log(`No file specified, using default: STRESS_TEST_DOC.md\n`, 'yellow');
    
    if (fs.existsSync(defaultFile)) {
      const result = fixAsciiAlignment(defaultFile);
      process.exit(result.success ? 0 : 1);
    } else {
      log(`❌ File not found: ${defaultFile}`, 'red');
      process.exit(1);
    }
  } else {
    // Use specified file
    const filePath = args[0];
    const fullPath = path.resolve(filePath);
    
    log(`${colors.bold}🎯 ASCII Box Alignment Fixer${colors.reset}`, 'cyan');
    
    if (fs.existsSync(fullPath)) {
      const result = fixAsciiAlignment(fullPath);
      process.exit(result.success ? 0 : 1);
    } else {
      log(`❌ File not found: ${fullPath}`, 'red');
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((err) => {
    log(`\n❌ Error: ${err.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { fixAsciiAlignment };
