# Roadmap 79 — Add incremental rescan support for local folders

## Issue
Issue #60: `[Roadmap 79] Add incremental rescan support for local folders`

## Goal
Add local-only Electron scan manifests so repeated full scans of unchanged local folders reuse audio file hashes and metadata instead of reopening audio bytes, while changed files are rehashed/reparsed and names-only scans remain byte-safe.

## Guardrails
- Manifest stays under Electron app data / scanner options; do not upload the manifest wholesale to the API.
- Do not store audio bytes in the manifest.
- Reuse cached hash/metadata only when `relativePath`, size, mtime, scan mode, scanner version, and source root match.
- Changed files must be re-read, rehashed, and re-parsed.
- Names-only scans must not read audio or cover bytes.
- Repository artifacts and issue metadata stay in English.

## Context found
- Desktop scanner lives in `app/electron/scanner.cjs`; `scanFolder(sourceRoot, options)` currently walks files and reads metadata/hash for every audio file in full mode.
- Electron main calls `scanFolder(result.filePaths[0], scanOptions(options))` from `discweave:imports:pick-and-scan`.
- `app.getPath('userData')` is already used for local edit operation logs, so manifest storage can be rooted under app data there.
- Existing `scanner.test.cjs` verifies names-only scans avoid byte reads, full scans hash metadata safely, diagnostic handling, and no audio bytes in payloads.

## Implementation plan
1. Add scanner TDD for unchanged full scan reuse:
   - first full scan writes a manifest;
   - second full scan with same size/mtime returns the same hash/metadata without calling `fsSync.createReadStream` or `music-metadata.parseFile`.
2. Add scanner TDD for changed files:
   - after size or mtime changes, second full scan rehashes/reparses and updates manifest.
3. Add scanner TDD for scanner-version / names-only safety:
   - scanner version mismatch invalidates cached metadata;
   - names-only scan with manifest root still avoids read streams/metadata parsing and returns null hash/metadata.
4. Implement local manifest helpers in `scanner.cjs`:
   - deterministic manifest file path under `options.manifestRoot` keyed by source root + scan mode;
   - manifest schema with `scannerVersion`, `sourceRoot`, `scanMode`, and file entries keyed by relative path;
   - atomic-ish write via temp file + rename.
5. Pass `manifestRoot: path.join(app.getPath('userData'), 'scan-manifests')` from Electron main.
6. Verify targeted scanner tests, Electron tests, frontend quality gates, and `git diff --check` before commit.

## Implementation progress
- Added `app/electron/scan-manifest.cjs` for local-only full-scan manifest sessions, source-root/scan-mode hashed manifest filenames, scanner-version validation, size/mtime cache matching, and temp-file write/rename.
- Updated `app/electron/scanner.cjs` to:
  - load a full-scan manifest when `options.manifestRoot` is present;
  - reuse cached `format`, `contentHash`, and `audioMetadata` for unchanged audio files;
  - preserve reused entries into the next manifest;
  - rehash/reparse changed files or stale-version manifests;
  - keep names-only scans bypassing manifest reads and byte reads;
  - support an optional `metadataReader` test seam.
- Updated `app/electron/main.cjs` to store manifests under `path.join(app.getPath('userData'), 'scan-manifests')`.
- Added Electron scanner tests for unchanged-cache reuse, changed-file invalidation, scanner-version invalidation, and names-only safety with an existing full manifest.

## Verification
- RED: `npm test -- electron/scanner.test.cjs` failed before implementation on cache reuse / missing manifest.
- GREEN targeted: `npm test -- electron/scanner.test.cjs` — 10 passed.
- Electron targeted: `npm test -- electron/scanner.test.cjs electron/preload-contract.test.cjs electron/backend-config.test.cjs` — 13 passed.
- Full app tests: `npm test` — 59 files / 349 tests passed.
- `npm run lint` passed.
- `npm run format:check` passed.
- `npm run build` passed; build still emits the existing Vite large-chunk warning.
- `git diff --check` passed.

## Note
- `npm run file-size:check` still fails because existing frontend source files are above the repo's 600-line threshold: `catalogTypes.ts`, `ImportsWorkspace.tsx`, and `imports.css`. #60 only changed Electron files and the plan, but this repo-level check should be addressed in a separate frontend refactor.
