/**
 * Round-Trip Fidelity Tests — Playwright spec
 *
 * Parametrized over all .md files in src/__tests__/fixtures/roundtrip/.
 * Each fixture is loaded into the full-editor harness and serialized back
 * to markdown. A two-pass strategy classifies each difference as either a
 * LOAD bug or a SERIALIZE bug:
 *
 *   Pass 1: original → setContent → getContent → output1   (all failures)
 *   Pass 2: output1  → setContent → getContent → output2   (serialize stability)
 *
 *   MISSING in Pass 1              → LOAD      (content never parsed into ProseMirror)
 *   ADDED   in Pass 1, stable      → LOAD      (loader consistently adds/transforms)
 *   ADDED   in Pass 1, unstable    → SERIALIZE (non-idempotent serializer)
 *
 * On failure the test emits a structured report grouping diffs by construct
 * type and pipeline stage so an AI coding agent can identify root causes.
 *
 * Run smoke:  npx playwright test marp-roundtrip.spec.ts --project smoke
 * Run all:    npx playwright test marp-roundtrip.spec.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@playwright/test';
import {
  FULL_HARNESS_URL,
  waitForEditor,
  setContent,
  getContent,
} from './helpers/index';

// ---------------------------------------------------------------------------
// Construct-type classifier
//
// Ordered rules applied to the ORIGINAL input line. First match wins.
// Tracks frontmatter, code-fence, and MARP mode across lines.
// In MARP mode (frontmatter contains `marp: true`), bare `---` lines are
// [SLIDE-SEPARATOR]; in non-MARP mode they are [THEMATIC-BREAK].
// ---------------------------------------------------------------------------

type ConstructType =
  | '[FRONTMATTER]'
  | '[HEADING]'
  | '[THEMATIC-BREAK]'
  | '[SLIDE-SEPARATOR]'
  | '[CSS-DIRECTIVE]'
  | '[HTML-BLOCK]'
  | '[CODE-BLOCK]'
  | '[BLOCKQUOTE]'
  | '[TABLE]'
  | '[LIST]'
  | '[TASK-LIST]'
  | '[IMAGE]'
  | '[LINK-REF]'
  | '[FOOTNOTE]'
  | '[BODY-TEXT]';

function classifyLines(lines: string[]): ConstructType[] {
  const labels: ConstructType[] = [];
  let inFrontmatter = false;
  let frontmatterClosed = false;
  let inCodeBlock = false;
  let isMarp = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Frontmatter (first --- opens, second --- closes) ───────────────────
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      labels.push('[FRONTMATTER]');
      continue;
    }
    if (inFrontmatter && !frontmatterClosed) {
      if (trimmed === '---') {
        inFrontmatter = false;
        frontmatterClosed = true;
        labels.push('[FRONTMATTER]');
        continue;
      }
      if (/^marp\s*:\s*true/.test(trimmed)) isMarp = true;
      labels.push('[FRONTMATTER]');
      continue;
    }

    // ── Code fence (backtick or tilde) ─────────────────────────────────────
    if (trimmed.startsWith('```') || /^~~~+/.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      labels.push('[CODE-BLOCK]');
      continue;
    }
    if (inCodeBlock) {
      labels.push('[CODE-BLOCK]');
      continue;
    }

    // ── Ordered rules (outside frontmatter and code blocks) ────────────────
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      labels.push(isMarp && trimmed === '---' ? '[SLIDE-SEPARATOR]' : '[THEMATIC-BREAK]');
    } else if (trimmed.startsWith('#')) {
      labels.push('[HEADING]');
    } else if (trimmed.startsWith('<!--')) {
      labels.push(isMarp ? '[CSS-DIRECTIVE]' : '[HTML-BLOCK]');
    } else if (trimmed.startsWith('<')) {
      labels.push('[HTML-BLOCK]');
    } else if (trimmed.startsWith('|')) {
      labels.push('[TABLE]');
    } else if (trimmed.startsWith('>')) {
      labels.push('[BLOCKQUOTE]');
    } else if (/^- \[[ x]\]/.test(trimmed) || /^\s+- \[[ x]\]/.test(trimmed)) {
      labels.push('[TASK-LIST]');
    } else if (/^[-*+] /.test(trimmed) || /^\d+[.)]\s/.test(trimmed) ||
               /^\s+[-*+] /.test(trimmed) || /^\s+\d+[.)]\s/.test(trimmed)) {
      labels.push('[LIST]');
    } else if (trimmed.includes('![') || trimmed.includes('<img')) {
      labels.push('[IMAGE]');
    } else if (/^\[.+\]:\s+\S/.test(trimmed)) {
      labels.push('[LINK-REF]');
    } else if (/^\[\^.+\]:/.test(trimmed)) {
      labels.push('[FOOTNOTE]');
    } else {
      labels.push('[BODY-TEXT]');
    }
  }

  return labels;
}

// ---------------------------------------------------------------------------
// Diff types
// ---------------------------------------------------------------------------

interface DiffMissing {
  type: 'missing';
  origLine: number;   // 1-based
  content: string;
  label: ConstructType;
}

interface DiffAdded {
  type: 'added';
  outLine: number;    // 1-based
  content: string;
  label: ConstructType;
}

interface DiffChanged {
  type: 'changed';
  origLine: number;
  outLine: number;
  origContent: string;
  outContent: string;
  label: ConstructType;
}

type DiffEntry = DiffMissing | DiffAdded | DiffChanged;

// ---------------------------------------------------------------------------
// Pipeline stage classification (LOAD vs SERIALIZE)
//
// Two-pass strategy:
//   Pass 1: original → setContent → getContent → output1   (all failures)
//   Pass 2: output1  → setContent → getContent → output2   (serialize stability)
//
// Classification per entry in diffs1:
//   MISSING              → LOAD      (content never parsed into ProseMirror)
//   ADDED, stable        → LOAD      (loader consistently adds/transforms content)
//   ADDED, unstable      → SERIALIZE (serializer generates non-idempotent output)
// ---------------------------------------------------------------------------

type PipelineStage = 'LOAD' | 'SERIALIZE';

interface TaggedDiffEntry extends DiffEntry {
  stage: PipelineStage;
}

function tagDiffsWithStage(
  diffs1: DiffEntry[],
  diffs2: DiffEntry[],
): TaggedDiffEntry[] {
  // Line numbers (1-based) in output1 that change in pass 2 — serialize-unstable.
  const unstableOutput1Lines = new Set<number>();
  for (const d of diffs2) {
    if (d.type === 'missing') unstableOutput1Lines.add(d.origLine);
    if (d.type === 'changed') unstableOutput1Lines.add(d.origLine);
  }

  return diffs1.map(d => {
    let stage: PipelineStage;
    if (d.type === 'missing') {
      // Content absent from output1 — never entered ProseMirror → LOAD bug
      stage = 'LOAD';
    } else {
      // Content present in output1 — stable across passes → LOAD, else SERIALIZE
      const outLineNum = d.type === 'added' ? d.outLine : d.outLine;
      stage = unstableOutput1Lines.has(outLineNum) ? 'SERIALIZE' : 'LOAD';
    }
    return { ...d, stage };
  });
}

// ---------------------------------------------------------------------------
// LCS-based line diff
// ---------------------------------------------------------------------------

function computeDiff(original: string, output: string): DiffEntry[] {
  const origLines = original.split('\n');
  const outLines = output.split('\n');
  const origLabels = classifyLines(origLines);

  // Build LCS table
  const m = origLines.length;
  const n = outLines.length;

  // Use flat Uint32Array for memory efficiency on large files
  const dp = new Uint32Array((m + 1) * (n + 1));
  const stride = n + 1;

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (origLines[i] === outLines[j]) {
        dp[i * stride + j] = dp[(i + 1) * stride + (j + 1)] + 1;
      } else {
        dp[i * stride + j] = Math.max(
          dp[(i + 1) * stride + j],
          dp[i * stride + (j + 1)]
        );
      }
    }
  }

  // Walk the LCS to produce diff entries
  const diffs: DiffEntry[] = [];
  let i = 0;
  let j = 0;

  while (i < m || j < n) {
    if (i < m && j < n && origLines[i] === outLines[j]) {
      // Lines match — no diff
      i++;
      j++;
    } else if (
      j < n &&
      (i >= m || dp[(i + 1) * stride + j] >= dp[i * stride + (j + 1)])
    ) {
      // Line added in output (not in original)
      // Use origLabels for context if within range, else BODY-TEXT
      const contextLabel: ConstructType =
        i < m ? origLabels[i] : '[BODY-TEXT]';
      diffs.push({
        type: 'added',
        outLine: j + 1,
        content: outLines[j],
        label: contextLabel,
      });
      j++;
    } else {
      // Line missing from output
      diffs.push({
        type: 'missing',
        origLine: i + 1,
        content: origLines[i],
        label: origLabels[i],
      });
      i++;
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Format structured failure report
// ---------------------------------------------------------------------------

const FIX_HINTS: Partial<Record<ConstructType, string>> = {
  '[FRONTMATTER]':     'check frontmatter extraction in MarkdownEditorProvider.ts',
  '[HTML-BLOCK]':      'check htmlPreservation.ts / GenericHTMLBlock parseHTML()',
  '[CSS-DIRECTIVE]':   'check htmlComment.ts / HtmlCommentBlock parseHTML()',
  '[CODE-BLOCK]':      'check CodeBlock / IndentedImageCodeBlock extension',
  '[TABLE]':           'check renderTableToMarkdownWithBreaks / Table extension',
  '[BLOCKQUOTE]':      'check StarterKit blockquote / GitHubAlerts parseHTML()',
  '[LIST]':            'check ListKit / OrderedListMarkdownFix extension',
  '[TASK-LIST]':       'check TaskItemClipboardFix / TaskList extension',
  '[HEADING]':         'check StarterKit heading serialization',
  '[IMAGE]':           'check CustomImage / SpaceFriendlyImagePaths extension',
  '[SLIDE-SEPARATOR]': 'check MARP slide separator handling in editor',
  '[THEMATIC-BREAK]':  'check thematic break serialization in StarterKit',
  '[LINK-REF]':        'check link reference definitions (may not be supported)',
  '[FOOTNOTE]':        'check footnote extension (may not be supported)',
  '[BODY-TEXT]':       'check paragraph / inline mark serialization',
};

function formatReport(
  filename: string,
  tagged: TaggedDiffEntry[],
  origLineCount: number,
  out1LineCount: number,
  out2LineCount: number,
  serializeStable: boolean,
): string {
  const SEP = '══════════════════════════════════════════════════════════════';
  const lines: string[] = [''];

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(SEP);
  lines.push(`  ROUND-TRIP FAILURES: ${filename}  (${tagged.length} total)`);
  lines.push(`  Original: ${origLineCount} lines  →  Pass1: ${out1LineCount} lines  →  Pass2: ${out2LineCount} lines`);
  lines.push(`  Serializer idempotent: ${serializeStable ? 'YES — all issues are LOAD bugs' : 'NO — mix of LOAD and SERIALIZE bugs'}`);
  lines.push(SEP);
  lines.push('');

  // ── Summary table ──────────────────────────────────────────────────────────
  const loadCounts: Record<string, number> = {};
  const serCounts:  Record<string, number> = {};
  for (const d of tagged) {
    if (d.stage === 'LOAD') loadCounts[d.label] = (loadCounts[d.label] ?? 0) + 1;
    else                    serCounts[d.label]  = (serCounts[d.label]  ?? 0) + 1;
  }
  const allLabels = [...new Set(tagged.map(d => d.label))].sort();

  lines.push('  SUMMARY BY CONSTRUCT TYPE:');
  lines.push('  ┌──────────────────────────┬───────┬───────────┐');
  lines.push('  │ Construct Type           │ LOAD  │ SERIALIZE │');
  lines.push('  ├──────────────────────────┼───────┼───────────┤');
  for (const lbl of allLabels) {
    const l = String(loadCounts[lbl] ?? 0).padStart(5);
    const s = String(serCounts[lbl]  ?? 0).padStart(9);
    lines.push(`  │ ${lbl.padEnd(24)} │ ${l} │ ${s} │`);
  }
  lines.push('  └──────────────────────────┴───────┴───────────┘');
  lines.push('');

  // ── Where to look ──────────────────────────────────────────────────────────
  const worstFirst = allLabels
    .map(lbl => ({ lbl, load: loadCounts[lbl] ?? 0, ser: serCounts[lbl] ?? 0 }))
    .sort((a, b) => (b.load + b.ser) - (a.load + a.ser));

  lines.push('  WHERE TO LOOK:');
  for (const { lbl, load, ser } of worstFirst) {
    const hint = FIX_HINTS[lbl as ConstructType] ?? '';
    if (load > 0) lines.push(`    → ${String(load).padStart(3)} LOAD      ${lbl.padEnd(22)}  ${hint}`);
    if (ser  > 0) lines.push(`    → ${String(ser).padStart(3)} SERIALIZE ${lbl.padEnd(22)}  ${hint}`);
  }
  lines.push('');
  lines.push(SEP);
  lines.push('');

  // ── Per-entry detail ───────────────────────────────────────────────────────
  tagged.forEach((d, idx) => {
    const n   = String(idx + 1).padStart(3);
    const stg = `[${d.stage}]`.padEnd(11);
    if (d.type === 'missing') {
      lines.push(`[${n}] MISSING  ${stg} orig:${String(d.origLine).padEnd(4)} ${d.label.padEnd(20)} ${JSON.stringify(d.content)}`);
    } else if (d.type === 'added') {
      lines.push(`[${n}] ADDED    ${stg} out:${String(d.outLine).padEnd(5)} ${d.label.padEnd(20)} ${JSON.stringify(d.content)}`);
    } else {
      lines.push(`[${n}] CHANGED  ${stg} orig:${String(d.origLine).padEnd(4)} ${d.label}`);
      lines.push(`       ORIGINAL: ${JSON.stringify(d.origContent)}`);
      lines.push(`       OUTPUT:   ${JSON.stringify(d.outContent)}`);
    }
  });

  lines.push('');
  lines.push(SEP);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Fixture discovery
// ---------------------------------------------------------------------------

const ROUNDTRIP_FIXTURE_DIR = path.join(__dirname, '../fixtures/roundtrip');
const fixtureFiles = fs.readdirSync(ROUNDTRIP_FIXTURE_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

// ---------------------------------------------------------------------------
// Tests — one per fixture file
// ---------------------------------------------------------------------------

test.describe('Round-Trip Fidelity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FULL_HARNESS_URL);
    await waitForEditor(page);
  });

  for (const filename of fixtureFiles) {
    const fixtureUrl = `/src/__tests__/fixtures/roundtrip/${filename}`;

    test(`${filename} — zero data loss @smoke`, async ({ page }) => {
      // ── Fetch fixture ─────────────────────────────────────────────────────
      const original: string = await page.evaluate(async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
        return res.text();
      }, fixtureUrl);

      // Strip exactly one trailing newline (symmetric comparison)
      const normalised = original.endsWith('\n') ? original.slice(0, -1) : original;

      // ── Pass 1: original → editor → output1 ──────────────────────────────
      await setContent(page, normalised);
      await page.waitForTimeout(100);
      let output1 = await getContent(page);
      if (output1.endsWith('\n')) output1 = output1.slice(0, -1);

      const diffs1 = computeDiff(normalised, output1);
      if (diffs1.length === 0) return; // Perfect round-trip — nothing to report

      // ── Pass 2: output1 → editor → output2 (serializer stability) ─────────
      await setContent(page, output1);
      await page.waitForTimeout(100);
      let output2 = await getContent(page);
      if (output2.endsWith('\n')) output2 = output2.slice(0, -1);

      const diffs2 = computeDiff(output1, output2);
      const serializeStable = diffs2.length === 0;

      // ── Tag each diff entry with LOAD vs SERIALIZE ────────────────────────
      const tagged = tagDiffsWithStage(diffs1, diffs2);

      const report = formatReport(
        filename,
        tagged,
        normalised.split('\n').length,
        output1.split('\n').length,
        output2.split('\n').length,
        serializeStable,
      );

      // Fail with structured report so an AI coding agent can identify root causes
      expect(tagged, report).toHaveLength(0);
    });
  }
});
