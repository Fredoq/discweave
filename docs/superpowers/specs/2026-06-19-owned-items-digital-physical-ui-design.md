# Owned Items Digital And Physical UI Design

## Context

This specification defines the UI design for GitHub issue
`Fredoq/discweave#45`, Roadmap 61: rework the Owned Items UI for digital and
physical copy details.

This work builds on:

- `docs/superpowers/specs/2026-06-18-release-owned-digital-copies-design.md`;
- `docs/superpowers/specs/2026-06-19-local-audio-file-link-persistence-design.md`;
- `docs/superpowers/specs/2026-06-19-import-confirmation-file-links-design.md`;
- `docs/superpowers/specs/2026-06-19-owned-item-track-local-file-api-contracts-design.md`.

Roadmap 61 is a frontend workflow and rendering redesign. It should consume the
clean release-owned owned item contracts from Roadmap 60 and should not reopen
backend domain modeling, import confirmation behavior, export/restore, or the
Track detail redesign.

The selected visual direction is SuperDesign variant A, "Type-Aware Details":

https://p.superdesign.dev/draft/0a7960d3-3556-443f-a46b-8c78a7a29091

## Product Decision

Owned Items is a release-copy inventory workspace.

The screen should keep the existing dense master-detail pattern:

- a table of owned release-copy records;
- type-aware filters and columns;
- a right-side detail panel for the selected copy;
- a compact add/edit flow for inventory records.

Digital and physical copies must no longer share a physical-first detail
surface. A digital owned item is complete or incomplete based on release track
file coverage, local file metadata, and import context. It must not be treated
as missing physical storage or physical condition.

Physical owned items remain inventory copies with storage, condition, and
type-specific physical details. Their UI should continue to make storage and
condition easy to scan.

## Visual Direction

The UI should stay consistent with the current DiscWeave shell and design
system:

- calm collector-tool tone;
- dense information layout;
- restrained borders and muted status colors;
- no marketing hero treatment;
- no playback, marketplace, social, or recommendation framing.

The selected design keeps the existing page rhythm rather than introducing a
new application metaphor. It changes the information hierarchy inside the
Owned Items workspace so the user's attention follows the copy type.

## Workspace Header

The header remains operational and compact.

It should communicate that the page is an inventory surface for release copies,
not a media player or file browser. Suitable copy:

- title: `Owned Items`;
- description: "Track the physical and digital release copies in this
  collection.";

High-level counts may stay if they already exist, but they should avoid
physical-only wording. Good summary counters are:

- total owned items;
- digital copies;
- physical copies;
- copies needing attention.

## Table And Filters

The table should list owned items as release-copy records.

Required visible context:

- release title;
- artist context;
- owned item type;
- ownership status;
- type-specific location or coverage summary;
- type-specific condition or digital state summary.

The current separate physical columns should be replaced or remapped:

- `Storage` becomes `Location / Storage`;
- `Condition` becomes `Condition / Digital state`.

For digital items:

- `Location / Storage` should show the source folder, path summary, or an empty
  neutral value when unknown;
- `Condition / Digital state` should show file coverage, format, or digital
  attention state;
- missing physical storage must not render as `No storage recorded`;
- missing physical condition must not render as `No condition recorded`.

For physical items:

- `Location / Storage` should show the physical storage location when known;
- `Condition / Digital state` should show the physical media condition when
  known;
- missing physical storage or condition can still be shown as physical inventory
  gaps.

Filters should remain compact and table-oriented.

The first implementation should keep:

- ownership status;
- item type;
- attention state.

Physical-only filters such as condition and storage should either:

- apply only when a physical item type is selected; or
- be labeled and grouped so digital items are not implied to need those fields.

Digital-specific filters can include:

- complete coverage;
- missing files;
- format or codec missing;
- imported from folder.

The first implementation may include only filters that the current DTOs can
support, but the visible copy must not present physical requirements as global
owned item requirements.

## Digital Detail Panel

A selected digital owned item should render a digital-first detail surface.

Required sections:

- linked release summary;
- digital copy overview;
- file coverage by release track;
- local file paths;
- format and codec summary;
- missing file rows for release tracks without linked files;
- source folder or import context when available;
- ownership status and notes when available.

The digital detail panel must not include a `Physical details` section. It must
not show placeholder physical warnings such as:

- `No storage recorded`;
- `No condition recorded`;
- `Physical details unavailable`.

The file coverage section should use release track identity and position
context. Each row should show enough information to answer which file represents
which track appearance in this digital release copy:

- release position;
- track title;
- linked local file path or missing state;
- file format and codec when known;
- local file attention state when metadata is incomplete.

Missing files should be visible as coverage gaps, not as generic item errors.
If a release has ten tracks and eight linked files, the UI should make the
`8 / 10` coverage state clear and list the two missing release track rows.

Import context should be concise. It can show the source folder and import
session reference when available, but it should not become a broad import
review surface. Import cleanup remains separate roadmap scope.

## Physical Detail Panel

A selected physical owned item should render a physical inventory detail
surface.

Required sections:

- linked release summary;
- physical copy overview;
- storage location;
- media condition;
- type-specific physical details;
- digitization status where relevant;
- ownership status and notes when available.

Type-specific details should follow the release-owned digital copies design:

- vinyl: storage location, media condition, sleeve condition, pressing notes
  when available;
- CD: storage location, media condition, booklet or sleeve condition, disc
  count, edition notes when available;
- cassette: storage location, media condition, case or insert condition, tape
  type, digitization status;
- other: description, storage location, condition, and notes.

Physical copies may show missing storage or condition as attention states,
because those are real physical inventory gaps.

Physical detail panels should not show digital file coverage unless the product
has a concrete digitization link for that physical copy. In Roadmap 61,
digitization status is enough.

## Add And Edit Flow

The add/edit form should be type-aware.

Common fields:

- release;
- owned item type;
- ownership status;
- notes when available.

Digital fields:

- source folder or path summary when editable;
- file format or codec fields only if the Roadmap 60 contract exposes them for
  the owned item detail;
- digital attention state only as derived read-only context when it comes from
  file coverage.

Physical fields:

- storage location;
- media condition;
- type-specific physical details;
- digitization status where relevant.

Changing the owned item type should change the visible field set. Digital items
should not show condition and storage inputs as required physical fields.
Physical items should not show release track file coverage editing unless a
future roadmap item introduces that workflow.

If the implementation still needs a compact create form for the current slice,
it can limit itself to creating the copy record and leave detailed file-link
editing to import confirmation and local file flows.

## Empty, Loading, And Error States

Empty states should stay operational and archive-focused.

Recommended empty states:

- no owned items: "No release copies recorded yet.";
- no digital coverage rows: "No local files linked to this digital copy yet.";
- no physical storage: "No storage location recorded for this physical copy.";
- no physical condition: "No condition recorded for this physical copy.";

Digital screens must not reuse the physical missing-storage or missing-condition
messages.

Loading states should preserve table and panel structure where practical to
avoid layout jumps.

Error states should identify the affected copy or file coverage section. They
should avoid generic player or library sync language.

## Data Mapping Direction

The React view model should reflect the Roadmap 60 owned item response shape.

The UI should branch from the fixed owned item type:

- `digital` renders digital detail data and file coverage;
- `vinyl`, `cd`, `cassette`, and `other` render physical detail data.

Frontend adapters may normalize API response data into table rows and detail
sections, but they must not recreate the old shared physical/digital medium
shape. In particular:

- digital details should not be encoded as nullable physical fields;
- physical details should not be mixed into digital detail panels;
- table attention states should be derived per type.

The first implementation can gracefully handle partial backend data. If file
coverage is not present yet for a digital copy, the UI should show a digital
empty state rather than falling back to physical details.

## Accessibility And Responsive Behavior

The table and detail panel should stay keyboard reachable.

Selection should have a visible focus state distinct from hover state. Status
badges must not rely on color alone; label text should communicate the state.

Responsive behavior should keep the collector workflow intact:

- desktop and wide tablet: table and detail panel side by side;
- narrow viewports: table first, selected detail below or in a stacked panel;
- filter controls should wrap without overlapping table content.

Text must not overflow badges, buttons, or table cells. Long paths should wrap
or truncate in the middle with the full value available through native title
text or an accessible label.

## Testing Direction

Roadmap 61 implementation should add Testing Library coverage for the
type-aware UI behavior.

Required frontend tests:

- digital owned item detail renders digital copy overview and file coverage;
- digital owned item detail does not render `Physical details`;
- digital owned item detail does not render physical missing-storage or
  missing-condition messages;
- physical owned item detail renders storage and condition clearly;
- table rows show digital state without treating digital condition or storage as
  required;
- table rows show physical storage and condition for physical copies;
- filters do not imply condition or storage requirements for digital items;
- add/edit form changes visible fields when switching between digital and
  physical item types.

When the implementation touches API DTO mapping, add focused mapper tests for
digital and physical response shapes.

## Non-Goals

Roadmap 61 should not implement:

- playback;
- waveform, queue, or listening controls;
- file deletion or destructive cleanup;
- export and restore changes;
- Review Workbench detectors;
- Track detail redesign;
- import confirmation redesign;
- loose file import without release context;
- automatic file deduplication;
- cloud sync, marketplace, social, or recommendation features.

## Acceptance Criteria

The implementation is complete when:

- digital owned item detail panels no longer show physical details;
- digital owned items no longer show missing storage or missing condition as
  physical problems;
- digital owned item details show release track file coverage and missing file
  rows when data is available;
- physical owned item detail panels still expose storage and condition clearly;
- table columns and filters are type-aware enough that digital and physical
  copies can be scanned without misleading requirements;
- Testing Library coverage proves the digital and physical rendering paths.
