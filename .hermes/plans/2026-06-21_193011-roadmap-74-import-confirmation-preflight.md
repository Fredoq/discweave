# Roadmap 74 — Import confirmation preflight summary

## Issue
#55 `[Roadmap 74] Add import confirmation preflight summary`

## Goal
Add a read-only confirmation preflight path for import drafts so users can see the planned catalog/file writes before confirming. Preflight must not write catalog data or file-link state.

## Scope
- API preflight endpoint for a draft confirmation plan.
- Reuse the same editable draft payload shape as draft save, but apply it only in the request DbContext without saving.
- Summary response must cover release, tracks, digital owned item, local audio files, digital track file links, skipped tracks, duplicate matches, and blocking errors.
- UI confirmation dialog replaces browser `window.confirm` and shows the preflight summary before the existing confirm call.
- Tests prove preflight does not mutate data and covers new import, duplicate/moved hash, partial duplicate, skipped tracks.

## Guardrails
- No audio bytes stored or uploaded.
- Preflight must not call confirmation mutation helpers, cover storage, or `SaveChangesAsync`.
- Keep confirmation behavior unchanged.
- Use TDD: RED API tests first, then implementation, then UI tests.

## Implementation steps
1. Add API tests in `DesktopImportConfirmationPreflightTests.cs` for preflight scenarios and no catalog mutation.
2. Add DTOs and `ReleaseImportConfirmationPreflightService`.
3. Add endpoint `POST /api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight`.
4. Extract reusable draft update application so preflight can use the current editor payload without saving.
5. Add frontend types/client method and protocol test.
6. Add `ImportConfirmationDialog` and wire it from `ImportsWorkspace`.
7. Verify targeted tests, app typecheck/lint/format, API tests, frontend tests, build, diff check.
