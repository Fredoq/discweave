# Loose Import Review Workspace Design

## Context

This specification defines the redesigned Imports workspace behavior for
loose-file-heavy scans. It follows the Superdesign exploration in project
`DiscWeave Loose Import Review`.

Reference drafts:

- current state:
  <https://p.superdesign.dev/draft/d7ca0033-daef-4b73-8187-89dbd758e58a>;
- selected direction:
  <https://p.superdesign.dev/draft/1963d316-8f07-4f06-971c-7b7b33bb4ac9>.

The current UI makes a loose-only scan feel like an empty import review. The
selected session is in the left column, the primary loose-file work is pushed
down, the right column only says that no release draft is selected, and the user
has to infer what to do next.

DiscWeave should treat this as a first-class review state. Loose files are
staged import metadata, not catalog tracks, but reviewing them is still the
main task for this scan.

## Product Decision

When a selected import session has loose file candidates and no selected release
draft, the right column becomes the primary loose-file review workspace.

The left column remains session context:

- local folder scan controls;
- saved sessions;
- compact scan report and diagnostics;
- draft list when drafts exist.

The right column owns the loose-file workflow:

- why these files are loose;
- candidate grouping and selection;
- mixed album tag conflicts;
- release title and artist choices before draft creation;
- create draft and attach-to-existing-release actions.

This keeps the user's attention on the active decision instead of forcing them
to scroll the left column and decode an empty detail panel.

## Primary User Flow

1. The user scans a folder.
2. The scanner creates loose file candidates because release context is not
   trusted enough for an automatic release draft.
3. The selected session opens with a right-side `Loose file review` workspace.
4. The user reviews candidate groups, selects pending files, and resolves any
   metadata conflicts.
5. The user either creates a release draft or starts attach-to-existing-release.
6. When a draft is created, the normal release draft editor appears in the right
   column.

This is not a separate wizard. It is a focused right-side review workspace that
uses the existing Imports master/detail pattern.

## Right Column Layout

The loose review workspace should be a sticky detail panel, matching the current
draft editor column behavior.

Top section:

- title: `Loose file review`;
- short explanation: loose files are staged scan metadata and need a reviewed
  release context before catalog confirmation;
- compact metrics: total loose, pending, converted, ignored, selected.

Action bar:

- `Create release draft`;
- `Attach to existing release`;
- `Select all pending`;
- `Clear selection`.

Actions stay near the top so the user does not need to scroll back after
reviewing candidates.

The empty right-column copy `No release draft selected` should not appear for a
loose-only session.

## Left Column Layout

The left column should be more compact in loose-only sessions. It should not
host the primary loose-file card list.

Keep:

- `Local folder import`;
- `Sessions`;
- `Scan report`.

Demote or hide in loose-only mode:

- repeated full loose-file candidate cards;
- duplicate loose action controls.

The left column can show a compact session summary such as `10 loose files · 10
pending · mixed album tags`, but detailed selection belongs on the right.

## Candidate Grouping

Loose candidates are grouped by reason, with `Mixed album tags` as the visible
group for the scenario shown in the screenshots.

Each group header should include:

- reason label;
- count badge with enough width for two and three digits;
- short reason copy, for example `Album tags disagree, so DiscWeave did not
  create a release draft automatically.`

Candidate rows should be more compact than the current large cards, but still
show enough metadata to decide:

- checkbox;
- track number when available;
- file title or relative path;
- album hint;
- artist hint;
- duration, format, and hash state;
- decision badge.

Long paths must wrap without pushing status badges into the card edge.

## Count Badges

Two-digit values such as `10` must not be rendered inside fixed tiny circles.

Use pill badges with:

- `min-width` large enough for at least three digits;
- horizontal padding;
- stable line-height;
- no layout shift when counts change.

Count badges should remain readable in filter buttons, group headers, session
rows, and scan metrics.

## Mixed Album Tag Resolution

When selected candidates have conflicting album title hints, the right panel
shows a `Resolve release title` section before draft creation.

The section should include:

- current fallback title, clearly labeled as provisional;
- distinct album title hints found in the selected files;
- candidate counts per album title;
- one-click apply buttons for each album title;
- an editable final release title field.

The folder name may remain available as context, but it should not silently look
like a confident release title. The user should understand that the title was
chosen because the album tags conflict.

Album artist conflicts follow the same pattern:

- show distinct album artist hints;
- allow choosing one value or leaving release artists empty for review.

## Draft Creation

Creating a draft from loose files should use the reviewed loose review state:

- selected candidate IDs;
- reviewed release title when provided;
- reviewed album artist choice when provided;
- no automatic user tags.

If no reviewed title is provided and album hints conflict, draft creation can
still be allowed, but the resulting draft must show a release-level warning and
make the provisional title obvious.

## Tags And System Origin

`local-import` and `loose-files` are system origin labels, not user tags.

They should not be written into `ReleaseImportDraft.Tags` and should not appear
in the editable `Tags` field in the Classification section.

The UI may display origin information elsewhere, for example:

- `Origin: local import`;
- `Source: loose files`;
- `Created from 10 staged files`.

This keeps user taxonomy clean while preserving import provenance.

## Release Draft Editor

After draft creation, the right column switches to the existing release draft
editor.

The editor should make loose-draft provenance visible near the header:

- created from loose files;
- number of files converted;
- any album tag conflict warning.

Release metadata should be editable as today. Conflict suggestions should remain
available until the user resolves them or confirms the draft.

## Visual Treatment

Use the existing DiscWeave design system:

- Inter/system font;
- `--color-canvas`, `--color-surface`, `--color-selected`;
- calm gray/green selected states;
- amber only for warnings and pending review;
- existing `panel`, `button`, `badge`, and form patterns.

Do not introduce a new visual style, decorative hero treatment, or marketing
layout. This is an operational review tool for collectors.

## Accessibility

Requirements:

- selection checkboxes have file-specific accessible names;
- group headings use semantic headings;
- conflict choices are buttons with clear selected state;
- counts include readable text, not color-only meaning;
- long paths wrap;
- action status uses existing passive status styling unless an action fails.

Keyboard users should be able to:

- select all pending candidates;
- select individual candidates;
- choose a release title hint;
- create a draft;
- start attach-to-existing-release.

## Implementation Notes

Likely frontend changes:

- split the current `LooseFilesPanel` into a compact summary/list component and
  a right-side `LooseFileReviewPanel`;
- route the right-side empty detail state to `LooseFileReviewPanel` when the
  selected session has loose candidates and no selected draft;
- move filters and selection state into the right-side panel or a shared
  controller hook;
- adjust count badge CSS globally or at least for imports filters and group
  headers;
- add tests for loose-only right-column behavior and readable two-digit count
  badges.

Likely backend/API changes:

- stop adding `local-import` and `loose-files` to loose draft user tags;
- extend loose draft creation to accept reviewed metadata fields, or add a small
  client-side draft update immediately after creation if the existing API shape
  should stay narrow;
- preserve existing conservative mixed album tag classification.

Out of scope:

- changing automatic mixed album tag classification;
- moving or renaming local files;
- automatic tag rewriting in audio files;
- creating Review Workbench items for loose files;
- cloud sync or external metadata dependency.

## Open Questions

The implementation plan should decide whether reviewed loose metadata is sent in
the existing `POST /loose-file-drafts` request or applied through the existing
draft update endpoint immediately after draft creation.

The product behavior is fixed either way: the user sees and controls the release
title before the draft becomes the main review object.
