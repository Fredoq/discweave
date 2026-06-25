# Discogs Artist Member Apply Design

Date: 2026-06-23

## Context

DiscWeave artists can be searched and updated from Discogs, but the current
artist workflow has four gaps:

- existing artist records cannot change artist type from the Artists form;
- the artist Discogs review panel renders below the candidate list instead of
  inside the selected candidate card like releases;
- artist Discogs apply still exposes an `Apply External Source` checkbox even
  though external source attribution should always be persisted when Discogs
  data is applied;
- Discogs group data with members does not yet create member artists and
  `memberOf` relations.

The product direction stays archive-focused: Discogs assists metadata entry, but
DiscWeave stores its own artists and relations without depending on Discogs IDs
as core identities.

## Decisions

- Use a backend Discogs artist apply workflow, not a sequence of client-side
  create/update calls.
- Treat Discogs artist detail as a group when it has one or more members.
- When applying a Discogs group, create missing member artists as `Person`
  records and create `memberOf` relations from each member to the group.
- Deduplicate member artists by exact case-insensitive name match inside the
  current collection.
- Deduplicate `memberOf` relations by exact source artist, target artist, and
  relation type inside the current collection.
- Protect the `memberOf` artist relation type dictionary entry from deletion,
  replacement, and deactivation. Concrete `memberOf` relation records remain
  editable and deletable like other relations.
- Always apply the Discogs external source when applying Discogs artist data.
  The UI will not expose an external-source checkbox.
- Keep UI copy, code, tests, and documentation in English.

## Backend Design

### Artist Type Updates

`UpdateArtistRequest` will accept `type` in addition to `name` and
`externalSources`.

The update endpoint will normalize and validate the requested type using the
existing API values:

- `person`
- `group`

If the requested type matches the current EF discriminator, the endpoint updates
the existing domain object in place.

If the requested type changes, the endpoint will replace the tracked domain
object with a new `Person` or `Group` instance that keeps:

- the same public `ArtistId`;
- the same `CollectionId`;
- the updated name;
- the requested external sources.

This preserves references from credits and relations because they use the public
artist identifier, while allowing EF's TPH discriminator to change cleanly.

### Discogs Artist Apply Workflow

Add an API workflow for applying a selected Discogs artist detail during artist
create and update. The workflow must be transactional and run from the existing
`POST /api/artists` and `PUT /api/artists/{artistId}` persistence moments when
the request includes a selected Discogs artist payload.

The create and update requests can include the Discogs detail selected by the
user, including source, draft name, aliases, members, and variations. The
endpoint:

1. resolves the artist inside the current collection;
2. determines the desired artist type from Discogs members;
3. updates the artist name, type, and external source;
4. if the desired type is `group`, resolves each Discogs member by exact
   case-insensitive name match;
5. creates a `Person` artist for each missing member;
6. creates missing `memberOf` relations from member to group;
7. saves all changes in one transaction;
8. returns the updated artist plus created/reused member and relation counts.

For create-mode UI, `Apply Discogs data` updates the unsaved form and stores the
selected Discogs detail in form state. When the user clicks `Add record`, the
create endpoint creates the group artist first, then creates/reuses member
artists and `memberOf` relations in the same transaction.

### Protected `memberOf`

`CollectionDictionaryEntry.IsProtected` will include
`(DictionaryKind.ArtistRelationType, "memberOf")`.

Existing dictionary update/delete/replace flows already call protection checks,
so this makes `memberOf` non-deactivatable and non-removable through the same
product mechanism used for protected release types, credit roles, and media
types.

## Frontend Design

### Artist Type Select

The Artists form type selector is editable for existing artists. Changing it
updates the form state and persists through `updateArtist`.

The React display values stay:

- `Person`
- `Band`
- `Project`
- `Alias`
- `Collective`

The API request mapper keeps mapping group-like UI values to `group` and
person-like values to `person`.

### Discogs Artist Review Layout

The artist Discogs lookup panel will follow the release lookup pattern:

- candidate cards render with a stable summary and actions;
- the selected card receives `is-selected`;
- the review panel renders inside the selected candidate card;
- the review panel uses the existing Discogs impact row visual grammar rather
  than two loose definition-list columns;
- long aliases, members, variations, and profile text wrap without expanding the
  workspace beyond its column.

The artist review rows are:

- `Core`: current local name to Discogs name;
- `Type`: current type to `Band` when members exist, otherwise `Person`;
- `Aliases`: Discogs aliases summary;
- `Members`: Discogs member count and preview;
- `External source`: always applied.

### Discogs Apply Control

The review panel removes apply group checkboxes. It shows one primary action:

`Apply Discogs data`

Applying Discogs data:

- applies name, inferred type, and external source to the form;
- stores the selected Discogs detail in form state for the next save request;
- closes the lookup;
- clears candidate/review state;
- shows a status message that the form must still be saved to persist changes;
- sends the selected Discogs detail to the API when the user clicks
  `Add record` or `Save record`.

The button applies data only to the form. Catalog persistence happens on the
existing form submit action.

## Superdesign Use

Before implementing the UI changes, Superdesign must be used for the existing
Artists Discogs review surface:

1. verify the Superdesign CLI is installed and authenticated;
2. create a Superdesign project for the Artists Discogs apply UI;
3. create a pixel-perfect reproduction draft of the current Artists Discogs
   lookup using the required context files and design system;
4. create one branch-mode variation that moves artist review into the selected
   candidate card and removes apply checkboxes while keeping DiscWeave's current
   design system;
5. get user approval of the Superdesign draft before applying UI code changes.

Required context includes `.superdesign/design-system.md`,
`app/src/index.css`, `app/src/App.css`, app shell/layout files, Artists
workspace files, release Discogs lookup/review files, release Discogs lookup
CSS, and manual entry/release form CSS.

## Error Handling

- Missing target artist returns `404`.
- Invalid artist type returns the existing deterministic validation error.
- Missing or invalid Discogs source data returns `400`.
- Duplicate member names in one Discogs payload are collapsed before creating
  artists or relations.
- Member names that are blank after trimming are ignored.
- If any artist or relation write fails, the transaction rolls back.

## Testing

Backend tests:

- updating an artist can change `person` to `group` and back;
- applying Discogs group data updates the selected artist to group;
- applying Discogs group data reuses existing member artists by exact
  case-insensitive name;
- applying Discogs group data creates missing member artists as people;
- applying Discogs group data creates missing `memberOf` relations;
- repeated apply does not duplicate member artists or relations;
- `memberOf` dictionary entry cannot be deactivated, deleted, or replaced.

Frontend tests:

- existing Artists form type select is enabled and saves changes;
- artist Discogs review appears inside the selected candidate card;
- artist Discogs review has no `Apply External Source` checkbox;
- `Apply Discogs data` applies name, inferred type, and external source;
- Discogs group detail with members selects `Band`;
- existing update via Discogs persists through the new API contract.

Regression checks:

- run relevant API tests;
- run relevant Vitest suites for artist workspace and Discogs artist
  autocomplete;
- run app typecheck after TypeScript contract changes.

## Out Of Scope

- Fuzzy matching member names.
- Manual member review before creation.
- Discogs alias relation creation.
- Start/end membership periods from Discogs profile text.
- Making concrete `memberOf` relation records undeletable.
- Cloud sync, public accounts, streaming, or social workflows.
