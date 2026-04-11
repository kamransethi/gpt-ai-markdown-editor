# LLM Prompt Templates

These are copy-paste prompts for handing off work to LLM at each stage of the workflow.

---

## Stage 1: Generate Implementation Plan from Spec

**Context**: You've written spec.md and committed it. Now ask LLM to generate the implementation_plan.md.

```markdown
You are an experienced implementation planner for a VS Code extension built with TypeScript, TipTap/ProseMirror, and testing via Jest.

Read this spec: specs/006-BUG-ai-refine-code-blocks/spec.md

Then, analyze and generate an implementation_plan.md file with:

1. **Summary** (2-3 sentences): What's the core change needed?
2. **Files to Change**: Exact file paths (e.g., src/webview/features/aiRefine.ts)
3. **Functions/Components**: List what needs modification or creation
4. **Test Cases**: Write out what tests need to be written (3-5 test case descriptions)
5. **Architecture/Approach**: Why this approach? Any alternatives considered?
6. **Estimated Complexity**: Low / Medium / High

Format the output as markdown ready to commit to:
specs/006-BUG-ai-refine-code-blocks/implementation_plan.md

Only output the markdown file content. Do not explain or introduce it.
```

---

## Stage 2: Implementation — Prompt LLM to Code

**Context**: implementation_plan.md is approved and committed. Now ask LLM to code.

```markdown
You are a test-driven developer for VS Code extension (TypeScript + TipTap/ProseMirror + Jest).

Your inputs:
- Spec: specs/006-BUG-ai-refine-code-blocks/spec.md
- Plan: specs/006-BUG-ai-refine-code-blocks/implementation_plan.md

Follow this TDD workflow:

1. **Write the test FIRST** (RED)
   - Create a failing test that reproduces the spec problem
   - Put in: src/__tests__/features/aiRefine.test.ts (or appropriate path)
   - Test should fail before your code changes
   - Use jest/vitest patterns from existing test files in this project

2. **Write the code** (GREEN)
   - Modify files listed in implementation_plan.md
   - Keep code minimal and clean
   - Make the test pass

3. **Run tests locally**
   - Command: npm test -- src/__tests__/features/aiRefine.test.ts
   - Command: npm test -- --testPathPattern=features
   - Report: Are tests passing?

4. **Write IMPLEMENTATION.md** (after code works)
   Create specs/006-BUG-ai-refine-code-blocks/IMPLEMENTATION.md:
   
   ```markdown
   # IMPLEMENTATION.md
   
   ## What Changed
   - src/webview/features/aiRefine.ts: Modified handleAiRefineResult() to detect code block wrapper nodes (1 sentence on what changed)
   - src/webview/features/aiRefine.ts: Added new helper function detectCodeBlockContext() (1 sentence)
   
   ## Why It Matters (User-Facing)
   AI Refine no longer corrupts code blocks when you select and refine text inside them. Refined text now stays in context.
   
   ## How It Works (Technical)
   Before applying AI-refined text, the code now checks if the selection is inside a code block and uses context-aware insertion instead of simple replacement.
   ```

5. **Output format**:
   - Show the test code first
   - Show modified functions (full code, not diffs)
   - Show IMPLEMENTATION.md
   - Report test results

Go.
```

---

## Stage 3: Code Review Prompt

**Context**: LLM delivered code. You're reviewing it. Use this to give feedback.

```markdown
I reviewed the implementation and have feedback:

[Your specific comments, e.g.]
- The test looks good, but can you also test the X case?
- The implementation assumes Y, but we also need Z.
- Performance concern: this loops N times, can we optimize?

Please revise and re-run tests. Show me:
1. Updated test file
2. Updated code
3. Test run results (proof all pass)
```

Or if approved:

```markdown
Approved. Please:
1. Confirm all 828 tests pass locally: npm test
2. Output the full test file and modified source files
3. Confirm ready to commit
```

---

## Stage 4: Full Test Run

**Context**: After LLM codes, run locally to verify all 828 tests pass.

```bash
npm test
```

Expected output:
```
Test Suites: [X] passed, [X] total
Tests:       [X] passed, [X] total
```

If any fail:
```markdown
Tests failed:
[Paste failing test names and errors]

Please review the failures and:
1. Debug the issue
2. Fix code if needed
3. Re-run: npm test
4. Show me the passing results
```

---

## Troubleshooting Prompts

### If tests fail after LLM codes

```markdown
Tests are failing:
[Paste test output]

Can you:
1. Analyze why this test is failing
2. Fix the code
3. Re-run tests
4. Show me the passing results
```

### If implementation_plan.md needs revision

```markdown
I reviewed the implementation_plan.md and have concerns:

[Your specific issues, e.g.]
- Files don't seem right; I think we also need to change src/extension.ts
- The test cases don't cover scenario X
- The architecture approach conflicts with Y constraint

Please revise the plan and re-output the full implementation_plan.md.
```

### If you don't like the spec after review

```markdown
Before we proceed, I want to strengthen this spec:

[Your concerns, e.g.]
- The acceptance criteria aren't clear enough
- We need to handle edge case X
- I'm worried about backward compatibility

Let's use /speckit.clarify to improve the spec. Here are my questions:
1. [Question 1]?
2. [Question 2]?

Answer these, and I'll update the spec.
```

---

## Template Workflow Summary

| Stage | Action | LLM Prompt | Output |
|-------|--------|-----------|--------|
| 1 | You create spec.md | None (manual) | spec.md (committed) |
| 2 | LLM analyzes & plans | "Generate Implementation Plan from Spec" | implementation_plan.md |
| 3 | You review plan | Approve or "Revise Plan" | Updated plan (committed) |
| 4 | LLM codes | "Implementation — Prompt LLM to Code" | Code + test + IMPLEMENTATION.md |
| 5 | You review code | Approve or "Feedback" | Final code or revisions |
| 6 | You run tests locally | `npm test` | All 828 passing ✅ |
| 7 | Merge | `git commit` + `git push` | Merged to main |

