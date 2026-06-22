# Roadmap 82 — Add import session cleanup and filtering

## Issue
Issue #63: `[Roadmap 82] Add import session cleanup and filtering`

## Goal
Keep `/imports` usable as local scans/rescans accumulate by adding session filters, archive/hide, and explicit cleanup for abandoned unconfirmed sessions.

## Guardrails
- Never delete catalog data created by confirmed imports.
- Deleting an import session is allowed only when the session has no confirmed drafts.
- Archive/hide is non-destructive and safe for confirmed sessions; copy makes clear catalog data remains protected.
- Repository artifacts and issue metadata stay in English.

## Context found
- Import sessions have statuses `ReadyForReview` and `Completed`; draft statuses include `needsReview`, `ready`, `confirmed`, and `skipped`.
- `/api/imports` previously listed all active sessions for the current collection, ordered by creation date.
- Session summaries already expose draft/track/loose counts and diagnostic summaries; detail responses expose draft issues, track issues, loose candidates, and relation suggestions.
- Existing persistence uses `EnsureCreated` plus `SqliteSchemaUpgrader` for additive SQLite columns.
- Existing UI has a session table in `ImportReviewPanels.tsx` and load helpers in `importsExportsClient.ts`.

## Implementation completed
1. Added non-destructive archive state:
   - `ReleaseImportSession.ArchivedAt`, `Archive(updatedAt)`, and `Restore(updatedAt)` domain methods.
   - EF mapping for `archived_at` and SQLite upgrader `EnsureReleaseImportSessionArchivedAtColumnAsync`.
   - API response field `archivedAt` for summaries and detail payloads.
2. Added `GET /api/imports` filtering and paging:
   - `filter=ready|confirmed|skipped|hasLooseFiles|hasWarningsOrErrors|missingHashes|duplicateMatches`.
   - Archived sessions hidden by default; `includeArchived=true` includes them.
   - Collection scoping preserved and verified by existing isolation tests.
3. Added cleanup endpoints:
   - `POST /api/imports/{sessionId}/archive` returns updated detail and hides the session from default list.
   - `DELETE /api/imports/{sessionId}` requires `X-DiscWeave-Confirm-Delete: delete-abandoned-import-session` and rejects sessions with confirmed drafts using `release_import.confirmed_cannot_delete`.
4. Added API regression tests in `DesktopImportSessionManagementTests` for filters, archive/hide, delete confirmation, confirmed safety, and catalog-data preservation.
5. Updated frontend API client/types:
   - `ImportSessionFilter`, `archivedAt`, `loadImportSessions({ filter, includeArchived })`, `archiveImportSession`, and `deleteImportSession`.
6. Updated `/imports` UI:
   - Session filter selector, archived toggle, archived badge, archive action, and delete-abandoned action with explicit confirmation copy.
7. Added UI tests in `App.imports-desktop.test.tsx` for filter query calls, archived toggle, archive endpoint, delete confirmation header, and refresh behavior.

## Verification
- Targeted API: `/usr/local/share/dotnet/dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "ImportCollectionIsolationEndpointTests|DesktopImportSessionManagementTests|SourceFileSizeTests"` → passed, 6 tests.
- Full API: `/usr/local/share/dotnet/dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj` → passed, 392 tests.
- Targeted app: `npm test -- App.imports-loose-files.test.tsx App.imports-desktop.test.tsx` → passed, 14 tests.
- Full app: `npm test` → passed, 59 files / 354 tests.
- App lint/typecheck/format: `npm run lint`, `npm run typecheck`, `npm run format:check` → passed.
- App build: `npm run build` → passed (existing Vite chunk-size warning only).
- Diff hygiene: `git diff --check` → passed.
