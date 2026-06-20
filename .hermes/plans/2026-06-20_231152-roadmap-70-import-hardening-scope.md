# Roadmap 70 Local Import Hardening Scope Implementation Plan

> **For Hermes:** Implement this plan directly for Issue #51 before starting Roadmap 71.

**Goal:** Add a product decision/spec that defines local import hardening, scan diagnostics, loose file candidates, rescan semantics, and non-goals.

**Architecture:** This issue is documentation-only. The spec should sit beside the existing DiscWeave decision specs under `docs/superpowers/specs/` and define terms and boundaries for later API, Electron, and UI issues without changing runtime code.

**Tech Stack:** Markdown documentation in the existing DiscWeave monorepo.

---

### Task 1: Create the decision spec

**Objective:** Write the product contract for local import hardening and loose-file handling.

**Files:**
- Create: `docs/superpowers/specs/2026-06-20-local-import-hardening-loose-files-design.md`

**Step 1: Draft the spec**

Include these sections:
- Context
- Product Decision
- Workflow Terms
- Classification Rules
- Scan Diagnostics
- Loose File Candidate Model
- User Actions
- Rescan And Moved File Semantics
- API, Desktop, and UI Boundaries
- Downstream Issue Boundaries
- Testing Direction
- Out Of Scope

**Step 2: Verify the spec against Issue #51**

Check that it covers:
- release draft;
- loose file candidate;
- ignored file;
- scan diagnostic;
- rescan;
- moved or renamed file hint;
- attach-to-existing-release flow;
- normal release folders;
- root-level files;
- mixed album tags;
- missing album tags;
- singles;
- compilations;
- moved or renamed files;
- duplicate hashes at different paths.

**Step 3: Verify formatting**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

**Step 4: Commit**

Run:

```bash
git add .hermes/plans/2026-06-20_231152-roadmap-70-import-hardening-scope.md docs/superpowers/specs/2026-06-20-local-import-hardening-loose-files-design.md
git commit -m "docs: define local import hardening scope"
```

Do not close Issue #51 yet; keep it linked for the future PR merge.
