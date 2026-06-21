# Roadmap 77 — Create release drafts from loose files

## Issue
#58 `[Roadmap 77] Create release drafts from loose files`

## Goal
Allow users to select persisted loose file candidates and convert them into a normal release import draft that uses the existing draft editor and confirmation path.

## Guardrails
- Do not create catalog releases/tracks directly from loose files; only create import drafts.
- Do not upload/store audio bytes.
- Do not create fake standalone track-owned files.
- Mark consumed candidates so they leave the pending queue.
- Keep later attach-to-existing-release flow out of scope (#59).

## Implementation plan
1. Add API TDD for one-file, multi-file/shared tags, conflicting tags, duplicate/idempotent confirmation path where practical, and already-consumed candidates.
2. Add request/endpoint `POST /api/imports/{sessionId}/loose-file-drafts` with selected candidate ids.
3. Convert selected pending candidates to `ReleaseFolderScanDraft`/tracks using safe hints, then reuse existing draft persistence helpers.
4. Add domain method to mark loose candidates as consumed with source draft reference.
5. Return updated import session detail with created draft selected by the frontend.
6. Add frontend action/selection in the Loose Files panel and client method.
7. Verify API targeted tests, frontend targeted tests, typecheck/lint/format/build/full relevant suites.

## Completed implementation
- Added `ReleaseImportLooseFileDraftRequest` and `POST /api/imports/{sessionId}/loose-file-drafts`.
- Added `ReleaseImportScanService.CreateDraftFromLooseFilesAsync` to convert selected pending loose candidates into regular import drafts while marking candidates `consumed`.
- Reused existing draft persistence and confirmation flow so catalog/file-link creation still happens only after review confirmation.
- Added Imports workspace selection controls and `Create release draft` action for pending loose candidates.
- Split loose-draft route handler into `ReleaseImportsEndpointRouteBuilderExtensions.LooseDrafts.cs` to keep the main endpoint file under the source-size gate.

## Verification
- `dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "Loose"` — 8 passed.
- `dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImport"` — 61 passed.
- `dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --no-build` — 380 passed.
- `npm test` — 59 files / 344 tests passed.
- `npm run build` — passed; existing Vite chunk-size warning only.
- `npm run typecheck && npm run lint && npm run format:check` — passed.
- `git diff --check` — passed.
