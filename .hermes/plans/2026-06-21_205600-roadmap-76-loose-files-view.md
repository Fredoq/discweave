# Roadmap 76 — Add Loose Files view to the Imports workspace

## Issue
#57 `[Roadmap 76] Add Loose Files view to the Imports workspace`

## Goal
Expose persisted import-session loose file candidates inside `/imports` so users can inspect messy/unmatched scan files without leaving the import workspace.

## Guardrails
- Do not imply loose files are catalog tracks/releases yet.
- Do not add destructive actions or catalog mutation flows in this issue.
- Do not invent fields not present in `ReleaseImportLooseFileCandidate`; show persisted metadata only.
- Repository artifacts and issue metadata stay in English.

## Implementation plan
1. Use SuperDesign context for the existing Imports workspace and generate a compact Loose Files panel direction.
   - Project: `e7bfb0e1-7adc-4309-ab44-73fa5bd81485`
   - Current reproduction: `6fc75c8b-867d-4d97-8e4e-8c6a40baed12`
   - Implemented direction: Variation A (`18297010-4067-4d0e-b3be-c36ac75b460b`) — compact panel under Scan report with grouped candidate cards and filter chips.
2. Add frontend tests for list/detail, empty state, and filters (pending, ignored, consumed/converted, has metadata, missing hash).
3. Implement a `LooseFilesPanel` using persisted `selectedSession.looseFileCandidates`.
4. Add session/scan metrics for loose file counts.
5. Style the panel in `imports.css` using existing DiscWeave panel/badge patterns.
6. Verify with targeted Vitest, typecheck, lint, format, full app tests/build, and `git diff --check`.

## Out of scope
- Creating release drafts from loose files (#58).
- Attaching loose files to existing releases (#59).
- Changing backend persistence beyond the existing #56 contract.
