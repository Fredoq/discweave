# Roadmap 78 — Attach loose files to an existing release

## Issue
Issue #59: `[Roadmap 78] Attach loose files to an existing release`

## Goal
Allow selected loose file candidates to be attached to an existing catalog release by explicitly mapping candidates to release track rows, creating/reusing local file rows, a digital owned item, and digital track-file links without recreating the release.

## Guardrails
- Do not create fake releases/tracks or delete local files.
- Keep #58 draft-creation flow intact; this issue adds an alternate attach flow.
- Partial mapping is allowed; unmapped loose candidates remain pending.
- Existing linked files require explicit relink confirmation.
- All repository artifacts and issue metadata stay in English.

## Context found
- Existing confirmation path already has reusable local-file/link helpers in `ReleaseImportConfirmationService.Files.cs` but they are private to draft confirmation.
- Release responses expose `ReleaseTracklistItemResponse.ReleaseTrackId`, track title, position, disc, side, duration and credits.
- Loose candidates carry enough persisted metadata for local file creation and matching suggestions.
- Imports workspace already owns the `LooseFilesPanel` selection/action surface from #57/#58.

## Implementation plan
1. Use SuperDesign for an attach-flow UI direction inside the Imports workspace before production UI edits.
   - Created project `1305e248-e502-47f8-b8fc-c4382602b9a7`.
   - Draft generation is currently blocked by SuperDesign API error `insufficient_credits`; continue with backend TDD and revisit UI draft when credits are available or user explicitly approves a non-SuperDesign fallback.
2. Add API TDD for mapping selected loose candidate(s) to an existing release track row.
3. Add request/response contracts for attach preview/confirmation, including explicit relink confirmation flags.
4. Implement backend service to:
   - validate session/candidate/release/release-track collection scope;
   - suggest mappings by track number/title/hash where unambiguous;
   - create/reuse digital owned item, local audio file, and digital track-file link;
   - reject existing-link replacement unless confirmed;
   - mark attached candidates consumed while leaving unmapped candidates pending.
5. Add UI flow from Loose Files panel:
   - select pending candidates;
   - choose `Attach to existing release`;
   - search/select release;
   - show release tracklist mapping table with linked-file state;
   - require explicit confirm.
6. Verify API targeted tests, frontend targeted tests, full relevant API/frontend suites, source-size gate, and `git diff --check`.

## Backend progress
- Added TDD coverage in `DesktopImportLooseFileAttachTests.cs` and `DesktopImportLooseFileAttachReleaseResponseTests.cs`:
  - mapped loose candidate attaches to an existing release track and creates file rows/links idempotently;
  - partial mapping leaves unmapped candidates pending;
  - existing file-link relink requires explicit `confirmRelink`;
  - collection isolation blocks cross-collection release attachment;
  - release detail tracklists expose linked local-file state after attach.
- Added `ReleaseImportLooseFileAttachmentRequest` contract and `POST /api/imports/{sessionId}/loose-file-attachments`.
- Added `ReleaseImportScanService.AttachLooseFilesToReleaseAsync` with validation, collection scoping, digital owned item reuse/create, local audio file reuse/create, file-link create/relink, and consumed candidate marking.
- Extended release tracklist responses with `linkedLocalFiles` and split linked-file response loading into `ReleasesEndpointRouteBuilderExtensions.Response.FileLinks.cs`.
- Split attach test helpers into `DesktopImportLooseFileAttachTests.Helpers.cs` to keep source-size checks green.

## Frontend progress
- Added `ReleaseTrackLinkedLocalFileDto` and optional `linkedLocalFiles` on release tracklist items.
- Added import API helpers for release search and loose-file attachment confirmation.
- Added `LooseAttachmentPanel` with release search, release tracklist linked-file state, candidate-to-track mapping, partial mapping, relink confirmation, and API error display.
- Added `Attach to existing release` action to `LooseFilesPanel` and integrated the attach state machine in `ImportsWorkspace`.
- Added client-side mapping suggestions by content hash, track number, then normalized title when unambiguous.
- Added Vitest coverage for happy-path attach and explicit relink confirmation.

## Verification
- `dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "Loose"` — 13 passed.
- `dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImport"` — 66 passed.
- `dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --no-build` — 385 passed.
- `npm test -- App.imports-loose-files.test.tsx` — 6 passed.
- `npm test` — 59 files / 346 tests passed.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` passed. Build still emits the existing Vite large-chunk warning.
- API source-size scan and `git diff --check` passed.
