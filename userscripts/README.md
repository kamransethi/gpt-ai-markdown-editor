# User Scripts

Utility scripts for development and maintenance tasks.

## fix-ascii-alignment.js

**Purpose:** Deterministically fixes ASCII art box alignment in markdown files.

### Why This Script Works (When LLMs Fail)

ASCII art alignment is **perfect for scripts** because:

- ✅ **Deterministic** — Same input always produces identical output
- ✅ **Character-precise** — Counts exact bytes/characters, no guessing
- ✅ **Verifiable** — Validates alignment before/after
- ✅ **Repeatable** — Can re-run anytime without drift
- ✅ **Unicode-aware** — Handles emoji and box-drawing characters correctly

LLMs fail at ASCII alignment because they generate tokens (not character-level) and have no "check your work" loop. This script proves that character-level determinism is the right approach.

### Usage

```bash
# Fix default file (STRESS_TEST_DOC.md)
node userscripts/fix-ascii-alignment.js

# Fix a specific markdown file
node userscripts/fix-ascii-alignment.js path/to/file.md
```

### How It Works

1. **Detects** all ASCII box sections (bounded by `╔═══╗` and `╚═══╝`)
2. **Measures** the target width from box borders
3. **Extracts** content from each line and trims it
4. **Calculates** exact spacing needed for perfect alignment
5. **Rebuilds** each line to match target width precisely
6. **Validates** that left and right borders align perfectly
7. **Reports** statistics: boxes found, lines processed, lines fixed

### Example Output

```
🎯 ASCII Box Alignment Fixer

📋 Reading file: src/__tests__/STRESS_TEST_DOC.md
📊 Processing 334 lines...
   🔲 Box #1 detected at line 36 (width: 79)
   ✓ Line 37 aligned (was: 78ch, now: 79ch)
   ✓ Line 38 aligned (was: 78ch, now: 79ch)
   ...
   
✅ Validation Results:
   Boxes found: 7
   Lines processed: 35
   Lines fixed: 30

✨ File updated successfully: src/__tests__/STRESS_TEST_DOC.md
```

### Before/After

**Before (misaligned — right missing space):**
```
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  ☑ Enable auto-save on document change                               ║  │  ← 78 chars
│  ║  ☑ Show formatting toolbar by default                                ║  │  ← 78 chars
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
```

**After (perfectly aligned):**
```
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  ☑ Enable auto-save on document change                                ║  │  ← 79 chars
│  ║  ☑ Show formatting toolbar by default                                 ║  │  ← 79 chars
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
```

### Technical Details

- **Algorithm:** Measures box border width as source of truth
- **Pattern:** Extracts content between left `║  ` and right `  ║` boundaries
- **Spacing:** Calculates `padding_needed = available_width - content_length`
- **Validation:** All lines in a box match the border width exactly
- **Safety:** Only modifies lines that need fixing; leaves others untouched

### Exit Codes

- `0` — Success (file updated or no issues found)
- `1` — Error (file not found or other I/O error)

### When to Use

- After manually editing ASCII boxes in markdown
- Before committing documentation with ASCII diagrams
- When adding new ASCII configuration mockups or UI examples
