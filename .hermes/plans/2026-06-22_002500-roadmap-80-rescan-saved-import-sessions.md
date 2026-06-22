# Roadmap 80 — Add Rescan action for saved import sessions

## Issue
#61 `[Roadmap 80] Add Rescan action for saved import sessions`

## Goal
Let users rescan a saved local import session's `sourceRoot` from the Imports workspace without mutating old reviewed sessions. Rescans should produce a new import session via the existing desktop-folder scan API.

## Guardrails
- Use the saved session's `sourceRoot` for direct rescans.
- Let the user choose full scan or names-only mode.
- Missing/inaccessible source roots must show a clear error and offer a replacement folder picker.
- Do not silently mutate old reviewed sessions; save rescan results through the existing new-session API path.
- Do not upload audio bytes.
- Repository artifacts and issue metadata stay in English.

## Context found
- Existing desktop folder scans use `window.discweaveDesktop.imports.pickAndScan({ mode })`, then POST the returned scan to `/api/imports/desktop-folder-scans`.
- Electron main already has `scanFolder(sourceRoot, { mode, manifestRoot })` and #60 manifest reuse under app data.
- `SessionsTable` currently lists saved sessions and selects them but has no per-session actions.
- `preload.cjs` only exposes `imports.pickAndScan`; #61 needs a second IPC contract for rescanning a known root.

## Implementation plan
1. Add preload/IPC TDD for `imports.rescanSource(sourceRoot, { mode })` routing to `discweave:imports:rescan-source`.
2. Add renderer TDD for rescan happy path:
   - saved session row exposes Full / Names-only rescan actions;
   - clicking a rescan calls `rescanSource(session.sourceRoot, { mode })`;
   - the returned scan is posted to `/api/imports/desktop-folder-scans` and selected as a new session.
3. Add renderer TDD for missing-root path:
   - `rescanSource` rejection shows a clear error;
   - UI offers `Choose replacement folder`;
   - replacement uses existing picker flow with the requested mode and saves a new session.
4. Implement Electron main/preload/types for direct rescan.
5. Extend `SessionsTable` and `ImportsWorkspace` with per-session rescan actions and replacement-folder fallback state.
6. Verify targeted desktop import/preload tests, full app tests, lint, format, build, and `git diff --check`.

## Implementation completed
- Added `imports.rescanSource(sourceRoot, options)` to the desktop preload bridge and routed it to `discweave:imports:rescan-source`.
- Added the Electron main handler for `discweave:imports:rescan-source`; it rescans the saved root with the selected mode and the same local manifest root used by folder picker scans.
- Extended the desktop bridge TypeScript contract with optional `rescanSource` for compatibility with older desktop shells.
- Added per-session `Rescan full` and `Rescan names only` actions in the Imports sessions table.
- Refactored `ImportsWorkspace` scan saving into a shared `saveDesktopScan` helper so new scans and rescans both create a new backend import session through `/api/imports/desktop-folder-scans`.
- Added renderer rescan flow that selects the new import session/draft after saving and shows `Rescan saved`.
- Added missing-root fallback copy and a `Choose replacement folder` action that uses the existing picker flow with the failed rescan mode.
- Added compact rescan action/replacement styling in `imports.css`.

## Tests added
- `electron/preload-contract.test.cjs` now verifies that `imports.rescanSource('/music', { mode: 'full' })` invokes `discweave:imports:rescan-source` with the saved root and options.
- `src/App.imports-desktop.test.tsx` now covers:
  - rescan happy path from a saved session row to a new `/api/imports/desktop-folder-scans` POST;
  - missing saved root error with replacement-folder fallback.

## Verification
- RED: `npm test -- electron/preload-contract.test.cjs` failed before implementation because only `pickAndScan` was exposed.
- RED: `npm test -- App.imports-desktop.test.tsx` failed before UI implementation because `Rescan full` / `Rescan names only` actions did not exist.
- Targeted GREEN: `npm test -- electron/preload-contract.test.cjs App.imports-desktop.test.tsx` — 2 files / 6 tests passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format:check` passed.
- Full app tests: `npm test` — 59 files / 351 tests passed.
- `npm run build` passed; Vite still reports the existing large-chunk warning.
- `git diff --check` passed.
