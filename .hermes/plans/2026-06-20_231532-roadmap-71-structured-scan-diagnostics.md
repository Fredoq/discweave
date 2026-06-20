# Roadmap 71 Structured Desktop Scan Diagnostics Implementation Plan

> **For Hermes:** Follow strict TDD. Write scanner tests first, verify they fail, then implement the minimal scanner/type changes.

**Goal:** Extend the Electron desktop scanner to return structured diagnostics while preserving `ignoredFileCount`, names-only safety, and no-audio-byte scan payloads.

**Architecture:** Keep diagnostics produced in `app/electron/scanner.cjs` because the desktop scanner owns filesystem traversal, metadata reads, hashes, and cover reads. Return a top-level `diagnostics` array in the scan result; keep backend persistence for Roadmap 72.

**Tech Stack:** Node/Electron CommonJS scanner, Vitest scanner tests, TypeScript frontend API types.

---

### Task 1: Add RED tests for diagnostic output

**Objective:** Prove scanner output must include structured diagnostics and preserve existing scan behavior.

**Files:**
- Modify: `app/electron/scanner.test.cjs`

**Tests to add/update:**
- names-only scans report hidden and unsupported diagnostics while not reading audio/cover bytes;
- full scans report metadata parse diagnostics while still returning the audio file;
- hash read failures report diagnostics and keep scanning;
- oversized covers report `cover_too_large` and do not attach cover bytes;
- cover read failures report `cover_read_failed` and keep the cover path metadata;
- depth limit and unreadable directory failures produce diagnostics.

**Run:**

```bash
npm test -- --run app/electron/scanner.test.cjs
```

Expected: FAIL because `diagnostics` is not implemented.

### Task 2: Implement scanner diagnostics

**Objective:** Add structured diagnostic helpers in the scanner with minimal behavior changes.

**Files:**
- Modify: `app/electron/scanner.cjs`

**Implementation notes:**
- Return `{ sourceRoot, files, ignoredFileCount, diagnostics }`.
- Track ignored count separately from warning diagnostics.
- Add stable codes from Issue #52.
- Metadata/hash/cover read failures should not stop the whole scan.
- Names-only mode must not open audio or cover bytes.

### Task 3: Update TypeScript scan request types

**Objective:** Keep renderer/preload typing aligned with the desktop scan result.

**Files:**
- Modify: `app/src/features/catalog/api/catalogTypes.ts`

**Implementation notes:**
- Add `DesktopFolderScanDiagnostic` type.
- Add `diagnostics: DesktopFolderScanDiagnostic[]` to `DesktopFolderScanRequest`.

### Task 4: GREEN verification

Run:

```bash
npm test -- --run app/electron/scanner.test.cjs
npm run typecheck
npm run lint
npm run format:check
```

Expected: all pass.

### Task 5: Commit

Run:

```bash
git add .hermes/plans/2026-06-20_231532-roadmap-71-structured-scan-diagnostics.md app/electron/scanner.cjs app/electron/scanner.test.cjs app/src/features/catalog/api/catalogTypes.ts
git commit -m "feat: add structured desktop scan diagnostics"
```
