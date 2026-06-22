# Roadmap 83 — Import and loose-file regression fixture suite

## Issue

Issue #64: `[Roadmap 83] Add import and loose-file regression fixture suite`

## Goal

Add durable regression fixtures and acceptance coverage for messy local import scenarios across API, Electron scanner, and UI without using private real-library data.

## Existing coverage found

- Electron scanner already covered names-only byte safety, manifest reuse, unsupported files, hidden files, symlinks, hash read failures, oversized covers, depth limits, and unreadable directories in `app/electron/scanner.test.cjs`.
- API tests already covered normal desktop imports, loose file candidate persistence, create-draft-from-loose flow, attach-to-existing-release flow, moved/renamed hints, no audio bytes in responses, and collection isolation.
- UI tests already covered import diagnostics, desktop scans/rescans, loose files, create draft, attach, relink confirmation, and no audio bytes in scan POST.

## Implementation completed

1. Added API regression fixture suite in `DesktopImportRegressionFixtureTests` with synthetic paths/metadata only:
   - normal release folder;
   - compilation + multi-disc folder;
   - root-level loose files;
   - mixed album tags;
   - no-album-tag folder;
   - names-only missing hash fallback;
   - skipped draft outcome;
   - duplicate/same-hash moved-file hint;
   - no audio byte fields in import responses;
   - no catalog local-file/link rows for staged loose metadata.
2. Added Electron scanner synthetic messy fixture test in `electron/scanner.test.cjs`:
   - normal release, compilation CDs, root loose file, mixed-tag folder, unsupported file, hidden file, and symlink;
   - validates preserved relative paths, scanner diagnostics, hashes, and no audio byte fields/base64.
3. Added UI regression fixture test in `App.imports-regression-fixtures.test.tsx`:
   - renders compilation/multi-disc draft details;
   - renders scanner diagnostics;
   - renders pending loose candidates and guarded loose-file action affordances.
4. Added `api/docs/imports/import-regression-fixture-matrix.md` mapping every issue-scope fixture scenario to API, Electron scanner, and UI coverage.
5. Updated `app/docs/acceptance-checklist.md` with a disposable messy import fixture and one loose-file action.

## Guardrails

- Fixtures are synthetic; no private library data, no real audio payloads.
- Local import must not upload or store audio bytes.
- Loose files remain staged metadata unless explicitly converted/attached by a user action.
- Keep files under source-size gates by splitting helpers if needed.

## Verification

- Targeted API: `/usr/local/share/dotnet/dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "DesktopImportRegressionFixtureTests|SourceFileSizeTests"` → passed, 4 tests.
- Targeted app/Electron/UI: `npm test -- electron/scanner.test.cjs App.imports-regression-fixtures.test.tsx App.imports-desktop.test.tsx App.imports-loose-files.test.tsx App.imports-diagnostics.test.tsx` → passed, 28 tests.
- Full API: `/usr/local/share/dotnet/dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj` → passed, 395 tests.
- Full app/Electron/UI: `npm test` → passed, 60 files / 356 tests.
- App lint/typecheck/format: `npm run lint`, `npm run typecheck`, `npm run format:check` → passed.
- App build: `npm run build` → passed (existing Vite chunk-size warning only).
- Markdown formatting: `npx prettier --check ../api/docs/imports/import-regression-fixture-matrix.md ../app/docs/acceptance-checklist.md ../.hermes/plans/2026-06-22_111500-roadmap-83-import-regression-fixtures.md` → passed.
- Diff hygiene/source size: `git diff --check` and C# source-size scan → passed; no C# files over 300 lines.
