# Roadmap 81 — Detect moved and renamed files during rescan

## Issue
Issue #62: `[Roadmap 81] Detect moved and renamed files during rescan`

## Goal
When a local-folder rescan sees an audio file at a new path that looks like an existing catalog local file, surface a conservative moved/renamed hint in import review without deleting old local-file rows or automatically merging anything.

## Guardrails
- Same hash at a different path is valid collection data; do not clean up or delete the old local file automatically.
- Auto-selection of duplicate tracks stays conservative and only uses unambiguous logical matches.
- Missing-hash matches are low-confidence hints only.
- Collection isolation must be enforced for all hint lookup paths.
- Repository artifacts and issue metadata stay in English.

## Context found
- Confirmed imports and loose-file attachment already create/update `LocalAudioFile` rows with `ContentHash`, `SizeBytes`, `ModifiedAt`, and `ImportIdentity`.
- New desktop scans create fresh `ReleaseImportSession` rows through `ReleaseImportScanService.AcceptDesktopAsync`; rescans from #61 use the same endpoint and do not mutate old sessions.
- Draft tracks already carry persisted `ImportReviewIssue[]` and the UI displays those issues in `TrackDraftList`.
- Loose-file candidates do not currently carry issues; adding a computed file-move hint response is the least invasive way to surface hints there.
- `LoadFingerprintDuplicateMatchesAsync` already uses `LocalAudioFile.ImportIdentity` and current path/size/mtime fingerprints for duplicate matching.

## Implementation
1. Added API tests in `DesktopImportMoveHintTests` for:
   - same hash + new path returns a high-confidence moved/renamed hint;
   - multiple old local files with the same hash keep the hint ambiguous/reviewable instead of producing a single previous path;
   - missing hash falls back to unique size/mtime as a low-confidence hint;
   - other collections' local files do not produce hints.
2. Added response contract:
   - `ReleaseImportFileMoveHintResponse(previousPath, matchKind, confidence)`;
   - optional `moveHint` on `ReleaseImportDraftTrackResponse` and `ReleaseImportLooseFileCandidateResponse`.
3. Added `FileMoveHintLookup` for detail responses:
   - inspects current-session draft tracks and loose candidates;
   - queries `LocalAudioFiles` scoped by current collection;
   - uses current local-file hash and persisted import-identity hash for high-confidence same-hash/different-path hints;
   - uses current local-file size/mtime and persisted import-identity size/mtime for low-confidence missing-hash hints;
   - returns ambiguous confidence when multiple previous paths match.
4. Updated frontend DTOs and review UI:
   - `ReleaseImportFileMoveHint` type;
   - track-level hints in `TrackDraftList`;
   - loose-file hints in `ImportLooseFilesPanel`;
   - shared styling for calm review notes.
5. Split relation-suggestion mapping into `ReleaseImportResponseMapper.Relations.cs` to keep C# source-size architecture gates green.
6. Confirmation behavior remains unchanged and non-destructive: confirming creates/reuses a `LocalAudioFile` for the new path and relinks only through the existing explicit confirmation flow; old local file rows are not deleted.

## Verification
- RED observed before implementation: `DesktopImportMoveHintTests` initially failed because `moveHint` was absent.
- Passed: `/usr/local/share/dotnet/dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "DesktopImportMoveHintTests|SourceFileSizeTests"` — 5 passed.
- Passed: `/usr/local/share/dotnet/dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImport"` — 70 passed.
- Passed: `/usr/local/share/dotnet/dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj` — 389 passed.
- Passed: `npm test -- App.imports-desktop.test.tsx` — 6 passed.
- Passed: `npm test` — 59 files, 352 tests passed.
- Passed: `npm run lint`.
- Passed: `npm run typecheck`.
- Passed: `npm run format:check`.
- Passed: `npm run build` with the existing Vite chunk-size warning.
- Passed: `git diff --check`.
