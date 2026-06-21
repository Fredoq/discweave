# Roadmap 73 Import Scan Diagnostics UI Implementation Plan

> **For Hermes:** Use SuperDesign first for the UI direction, then implement with strict TDD after the selected design is approved. Do not implement production UI code before failing UI tests.

**Goal:** Make import scan diagnostics and release-level draft issues visible in the Imports workspace so a user can answer “why did this file not import?” without inspecting every track.

**Architecture:** Add a focused scan report surface for the selected import session, compact warning/error badges in session and draft tables, and release-level issue rendering near release metadata. Keep session-level scan diagnostics, draft-level release issues, and track-level issues visually distinct. If scan mode must be durable, extend the desktop scan/API/session contract before rendering it from persisted sessions.

**Tech Stack:** React + Vite + TypeScript, Vitest/Testing Library, vanilla CSS, SuperDesign, existing ASP.NET Core API if scan mode needs persistence.

---

## Current context

- Branch: `roadmap/import-hardening-loose-files`.
- Prior commit `7b20014` persists scan diagnostics and exposes `diagnostics` and `diagnosticSummaries` on import sessions.
- Issue: `Fredoq/discweave#54` / Roadmap 73.
- Product guardrails:
  - local-first archive, not player/social/marketplace/SaaS-first;
  - no audio bytes upload/storage;
  - loose files must not create fake tracks/releases or automatic cleanup;
  - repository artifacts and issue metadata stay in English.
- SuperDesign must be used before implementation. Implement code only after the design direction is selected/approved.

## Key discovery

`scan mode` is requested by issue #54 but is not currently persisted or exposed:

- Electron scanner computes `mode`, but returned scan payload has no `scanMode`.
- API `DesktopFolderScanRequest` has no scan mode field.
- `ReleaseImportSessionResponse` has no scan mode field.
- Frontend `ReleaseImportSession` has no scan mode field.

Implementing durable scan mode display therefore requires a small cross-layer contract addition. If scope must stay web-only, show `Scan mode unavailable for older sessions` or omit mode; otherwise add persistence.

## SuperDesign context files

Use these full files as `--context-file`; all are under 1000 lines.

### Required design context

- `.superdesign/design-system.md`
- `app/src/index.css`
- `app/src/App.css`
- `app/src/styles/app-shell.css`
- `app/src/styles/common-panels.css`
- `app/src/styles/responsive.css`

### Route and shell

- `app/src/app/renderWorkspace.tsx`
- `app/src/app/routes.ts`
- `app/src/app/AppShell.tsx`
- `app/src/app/DiscWeaveLogo.tsx`

### Imports UI

- `app/src/features/imports/ImportsWorkspace.tsx`
- `app/src/features/imports/ImportReviewPanels.tsx`
- `app/src/features/imports/ImportDraftEditor.tsx`
- `app/src/features/imports/TrackDraftList.tsx`
- `app/src/features/imports/ImportRelationSuggestionsPanel.tsx`
- `app/src/features/imports/ImportArtistCreditsEditor.tsx`
- `app/src/features/imports/ImportLabelsEditor.tsx`
- `app/src/features/imports/ImportEntitySuggestions.tsx`
- `app/src/features/imports/importEntitySuggestionHooks.ts`
- `app/src/features/imports/importHelpers.ts`
- `app/src/features/imports/importDiscogsApply.ts`
- `app/src/features/imports/imports.css`
- `app/src/features/imports/import-relation-suggestions.css`

### Imported shared UI and API types

- `app/src/features/releases/DiscogsReleaseLookupPanel.tsx`
- `app/src/features/releases/DiscogsCandidateReview.tsx`
- `app/src/features/releases/discogsReleaseTrackRows.ts`
- `app/src/features/releases/discogsRoleUtils.ts`
- `app/src/features/releases/discogs-release-lookup.css`
- `app/src/features/releases/release-form.css`
- `app/src/features/releases/release-tracklist.css`
- `app/src/features/releases/release-track-artists.css`
- `app/src/features/settings/settings.css`
- `app/src/features/catalog/catalogApi.ts`
- `app/src/features/catalog/api/catalogTypes.ts`
- `app/src/features/catalog/api/importsExportsClient.ts`
- `app/src/desktop.d.ts`

## Task 1: Produce SuperDesign baseline and variations

**Objective:** Get a pixel-perfect current UI baseline and two branch variations for the scan diagnostics UI.

**Steps:**

1. Create a SuperDesign project titled `DiscWeave Roadmap 73 Import Scan Diagnostics`.
2. Create one reproduction draft titled `Current Imports UI` with a single reproduction-only prompt.
3. Branch exactly two variations from the baseline:
   - Variation A: compact scan report panel in the left/main column above Draft releases, with concise metric badges and grouped diagnostics.
   - Variation B: selected-session scan report integrated between Sessions and Draft releases, with a denser table-like diagnostic summary and minimal badges.
4. Keep existing DiscWeave visual style only; no new fonts, colors, gradients, or marketing visuals.
5. Stop for approval before implementing code.

## Task 2: Add failing UI tests for session diagnostic badges

**Objective:** Prove sessions expose warning/error/ignored counts at a glance.

**Files:**

- Modify test: `app/src/App.imports-desktop.test.tsx` or create `app/src/App.imports-diagnostics.test.tsx`.
- Modify fixture: `app/src/test/appTestHarness.ts` if shared responses are cleaner.

**TDD steps:**

1. Add an import session fixture with `diagnostics` and `diagnosticSummaries` containing info/warning/error groups.
2. Assert `/imports` renders warning/error count badges in the session row.
3. Run targeted Vitest and verify RED.
4. Implement the smallest rendering helper/UI needed.
5. Verify GREEN.

Command:

```bash
npm test -- src/App.imports-diagnostics.test.tsx
```

## Task 3: Add failing UI tests for scan report panel

**Objective:** The selected session shows scan report metrics and diagnostic groups.

**Expected UI behavior:**

- selected session renders `Scan report`;
- shows draft count, track count, ignored count;
- shows diagnostic group rows with severity, code/label, count, and representative message/path;
- empty selected session with no diagnostics renders `No scan diagnostics.`;
- no selected session keeps the existing `Select a scan session.` state.

**TDD steps:**

1. Add tests for diagnostic group rendering and empty state.
2. Verify RED.
3. Implement `ImportScanReportPanel` plus pure helper(s) for counts/group labels.
4. Verify GREEN.

## Task 4: Add failing UI tests for release-level draft issues

**Objective:** Draft-level `issues` are visible near release metadata.

**Expected UI behavior:**

- selected draft with `draft.issues` renders a `Release issues` section near release metadata;
- track-level issues remain in `TrackDraftList` and are not duplicated in release issues;
- draft table shows compact issue count/badge.

**TDD steps:**

1. Add fixture with release-level issue plus track-level issue.
2. Assert release issue appears near metadata and track issue remains in track area.
3. Verify RED.
4. Implement minimal UI and CSS.
5. Verify GREEN.

## Task 5: Decide and implement scan mode persistence

**Objective:** Show scan mode durably if product scope requires it.

**Preferred implementation:** Add persisted scan mode to import session.

**Likely files if implemented:**

- `app/electron/scanner.cjs`
- `app/electron/scanner.test.cjs`
- `app/src/desktop.d.ts`
- `app/src/features/catalog/api/catalogTypes.ts`
- `api/src/DiscWeave.Api/Features/Imports/DesktopFolderScanRequest.cs`
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.cs`
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportSessionResponse.cs`
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportResponseMapper.cs`
- `api/src/DiscWeave.Domain/Imports/ReleaseImportSession.cs`
- EF configuration/upgrader/tests if persisted in SQLite.

**If skipped:** Render scan mode only when unavailable copy is acceptable; do not invent persisted data.

## Task 6: Verification

Run targeted checks first, then broader frontend checks:

```bash
npm test -- src/App.imports-diagnostics.test.tsx src/App.imports-desktop.test.tsx src/features/catalog/catalogApi.protocol.test.ts
npm run typecheck
npm run lint
npm run format:check
npm test
```

If scan mode contract changes API/domain/persistence, also run:

```bash
/usr/local/share/dotnet/dotnet test tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter ReleaseImportSession
/usr/local/share/dotnet/dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter DesktopImportEndpointTests
/usr/local/share/dotnet/dotnet test
```

## Risks and guardrails

- Do not duplicate track-level issue messages in release-level issue sections.
- Do not make diagnostics visually alarming unless severity is `error`.
- Do not show absolute paths as dominant content; prefer relative path examples and wrap long paths.
- Do not implement fake scan mode values.
- Keep table density and current local-first design language.
