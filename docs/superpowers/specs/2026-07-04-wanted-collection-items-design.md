# Wanted Collection Items Design

## Context

This specification defines the release-entry workflow for releases that are not
yet owned but are desired in a specific medium.

The current release form exposes an `Owned copy` section. That wording is wrong
for wanted targets: a user can want a digital version of a release without
owning any copy yet. The current create-release path can also fail when saving a
`Wanted` digital copy because it sends physical `condition` and
`storageLocation` values for a digital medium.

The selected visual direction is SuperDesign variant A1, the dense
`Collection items` table:

https://p.superdesign.dev/draft/21b4e3da-cffe-49a9-8a8a-7215ecdfc443

## Product Decision

Use `Collection items` as the user-facing term in release entry and release
detail surfaces.

Internally, this iteration can keep the existing `OwnedCopy` and `OwnedItem`
types. A broad domain rename is not required for this workflow. The UI should
avoid calling a wanted target an owned copy, but the persistence layer can still
store it through the existing owned-item model with status `Wanted`.

A collection item is a collection relationship to a release. It can represent:

- an owned copy;
- a wanted acquisition target;
- a sold past copy;
- a physical copy that needs digitization.

This keeps wanted releases queryable by medium and status without introducing a
separate release-level wanted flag.

## Release Entry UX

Replace the bottom `Owned copy` section with `Collection items`.

The section should use the selected A1 dense table layout:

- section title: `Collection items`;
- helper copy: "Track owned copies, wanted targets, and other collection
  statuses for this release.";
- action: `+ Item`;
- one row per collection item;
- row fields: `Status`, `Medium`, `Note`;
- remove action per row.

The default state for a newly imported or manually created release should be no
collection item. Adding an item creates the first row. The form must support at
least these rows:

- `Wanted` + `Digital` + optional note;
- `Owned` + physical medium + optional note;
- `Needs digitization` + physical medium + optional note.

The section should not show storage or physical condition fields for the A1
release-entry workflow. Those details can remain in the dedicated owned-item
surface and should not be required when the user only wants to mark a desired
digital target.

## Data Handling

The release-entry form should manage collection items as an array of draft rows
instead of a single `includeOwnedCopy`, `medium`, and `status` pair.

Each draft row needs:

- stable client id;
- status;
- medium;
- note.

Rows with neither status nor medium should not be submitted. If a row has a
medium but no status, default the status to `Owned` only when the user is clearly
creating a physical owned copy. For wanted flows, the UI should make status
selection explicit and preserve `Wanted`.

For this iteration, notes can be held in frontend state and mapped to the
existing `OwnedCopy.note` shape where the client state supports it. The current
release create request does not carry note, so server persistence of notes can
be deferred unless the implementation touches the owned-item endpoint.

## Save Behavior

Saving `Wanted` + `Digital` must succeed.

Digital collection items must send no physical fields:

- `condition`: `null`;
- `storageLocation`: `null`.

This rule should be shared between release creation and owned-item creation.
The existing owned-item relation client already applies the correct digital
payload behavior. The release creation path must match it.

The smallest acceptable implementation is:

- support one submitted collection item through the existing release
  `ownedCopy` create payload;
- render the release-entry UI as a collection-item table;
- fix digital release-create payload mapping;
- add release workspace filtering for status.

The preferred implementation is:

- allow multiple collection item draft rows in the form;
- submit the first row through the current release-create payload if the API
  still accepts only one `ownedCopy`;
- persist additional rows through the existing `/api/owned-items` path after the
  release exists, or extend the release create contract to accept an array if
  that is lower risk in the implementation pass.

Do not introduce a separate wanted-release entity in this iteration.

## Release Workspace Filters

The Releases workspace must expose an `Ownership status` filter alongside the
existing medium, label, year, and tag filters.

Filtering should use collection items attached to the release:

- `Ownership status = Wanted` shows releases with at least one wanted
  collection item;
- `Medium = Digital` plus `Ownership status = Wanted` shows wanted digital
  targets;
- existing search text may keep matching ownership status, but explicit filter
  controls are required.

The result table can keep current `Media` and `Ownership` columns for now, but
their content should be interpreted as collection-item summaries rather than
proof of owned inventory.

## Release Detail UX

Release detail should rename `Owned copies` to `Collection items`.

Cards or list rows should show:

- status;
- medium;
- note when present;
- physical storage or condition only when present and relevant.

Wanted digital entries should read as acquisition targets, not as incomplete
physical inventory.

## Scope Boundaries

In scope:

- release entry section rename and A1 table UI;
- collection item draft array in the release form;
- save fix for `Digital` collection items;
- release workspace `Ownership status` filter;
- release detail terminology update;
- focused tests for the wanted digital save path and filters.

Out of scope:

- renaming backend/domain `OwnedItem` types;
- global navigation rename of the Owned Items workspace;
- marketplace integrations;
- price tracking;
- import/export schema redesign;
- full owned-item detail redesign.

## Acceptance Criteria

- A user can manually add a release, add a collection item with `Wanted` status
  and `Digital` medium, save it, and return to the releases list without catalog
  sync failure.
- The save payload for a digital collection item does not contain physical
  condition or storage values.
- The release form no longer displays `Owned copy` or `Add owned copy`.
- The release form displays the A1-style `Collection items` table and supports
  adding and removing rows.
- Releases can be filtered by `Ownership status`.
- Combining `Ownership status = Wanted` and `Medium = Digital` shows wanted
  digital release targets.
- Release detail uses `Collection items` wording.
- Existing tracklist behavior from the release-entry form is preserved.

## Test Plan

Frontend tests:

- release entry renders `Collection items` and no `Owned copy` wording;
- adding a `Wanted` + `Digital` collection item builds a release submission with
  the expected collection item status and medium;
- removing a collection item row excludes it from submission;
- release workspace status filter returns wanted releases;
- release workspace status and medium filters combine correctly.

API/client tests:

- `createRelease` maps digital collection items with `condition: null` and
  `storageLocation: null`;
- physical collection items still map condition and storage when present;
- existing owned-item payload behavior remains unchanged.

Regression tests:

- existing manual release creation still creates tracklist rows;
- existing owned physical release-copy creation still succeeds;
- catalog sync failure message for digital physical fields is no longer
  triggered by the release-entry wanted digital path.

## Self Review

This design preserves the existing local-first owned-item model and fixes the
user-facing mismatch without a large domain rename. The risk is that the current
release create API accepts only one `ownedCopy`, while the chosen A1 UI can show
multiple rows. The implementation plan must either persist additional rows via
the existing `/api/owned-items` endpoint after release creation or deliberately
ship a first pass that renders the table but submits one row. The preferred path
is to persist multiple rows because the user explicitly selected a multi-row
collection-item UI.
