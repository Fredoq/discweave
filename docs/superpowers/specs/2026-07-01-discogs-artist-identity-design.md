# Discogs Artist Identity Design

Date: 2026-07-01

## Context

DiscWeave currently accepts Discogs artist display names such as
`Robin Stone (2)` as local artist names in some flows. Discogs uses these
numeric suffixes to disambiguate different artist pages with the same visible
name. In DiscWeave, those suffixes should not become the primary artist name
when the value comes from Discogs metadata.

The current behavior can also create an incorrect alias chain. If a Discogs
artist has `name = Robin Stone (2)` and `realname = Robin Stone`, refreshing
the local artist can create another local `Robin Stone` record and mark
`Robin Stone (2)` as its alias. In this case, the suffix is provider
disambiguation, not an alias relationship.

Existing project constraints still apply:

- core DiscWeave identity must not depend only on external service identifiers;
- imports need explicit matching and confidence rules;
- collection boundaries must be preserved;
- existing user data must not be overwritten unless the user explicitly chooses
  that behavior.

## Goals

- Keep DiscWeave's primary artist name clean for Discogs-linked artists.
- Preserve Discogs artist ids as external source references for future matching.
- Allow same-name artists to exist when they have different identities.
- Stop automatic Discogs real-name alias creation when the real name only
  differs from the Discogs disambiguation suffix.
- Keep the first implementation smaller than a full ambiguous-match review UI.

## Non-Goals

- Do not automatically repair existing local names such as `Robin Stone (2)`.
- Do not normalize manually entered names that happen to end with `(2)`.
- Do not add a user-editable disambiguation note in this iteration.
- Do not add a uniqueness constraint on artist names.
- Do not build a full review-first identity resolution workflow in this
  iteration.

## Product Decisions

Discogs-linked names are cleaned only when Discogs metadata is the source of
the value. A manually entered local artist named `Name (2)` remains unchanged.

If Discogs returns `Robin Stone (2)`, DiscWeave stores or proposes the local
artist name `Robin Stone` and attaches the Discogs artist external source, for
example `discogs / artist / 12345`.

If an automatic import sees a local `Robin Stone` without that Discogs source,
it creates or resolves a separate artist record rather than merging by name.
If the user explicitly applies Discogs metadata to a selected local artist, the
selected local artist still wins and receives the Discogs source. The UI
distinguishes same-name records with secondary identity metadata instead of
putting `(2)` back into the main name.

Existing records are not automatically cleaned. Future imports and future
Discogs refreshes use the new behavior.

## Identity Resolution

Artist resolution should use this order:

1. If a selected local `artistId` is present, use that artist as today. This is
   an explicit user decision and may attach the Discogs source to the selected
   artist.
2. If a Discogs artist external source is present, search the current collection
   for an artist with the same provider name, resource type, and external id.
3. If exactly one matching artist exists, use it.
4. If more than one matching artist exists in the collection, stop with a
   conflict or review issue. Do not guess.
5. If no external-source match exists, create a new `Person` with the cleaned
   Discogs display name and attach the Discogs artist source.
6. If no external source exists, use the current name-based resolver.

Matching is always scoped by `collection_id`.

External ids improve matching, but they do not replace DiscWeave's local
artist ids. Local ids remain the primary internal identity.

## Discogs Name Cleaning

The cleaner applies only to provider-sourced Discogs artist names. It removes a
single trailing numeric Discogs disambiguation suffix such as ` (2)` or ` (11)`
from a non-empty name.

Examples:

- `Robin Stone (2)` becomes `Robin Stone`.
- `Anthony King (11)` becomes `Anthony King`.
- `Name (Live)` remains `Name (Live)`.
- `Name (2) Remix` remains `Name (2) Remix`.

If cleaning would produce an empty name, DiscWeave keeps the original trimmed
Discogs name.

## Discogs Artist Refresh

When creating or updating an artist from Discogs artist detail:

- use the cleaned Discogs name as the local primary name;
- upsert the Discogs artist external source on the local artist;
- compare Discogs `realname` against the cleaned Discogs name before creating
  an `aliasOf` relation;
- skip alias creation when `realname` equals the cleaned Discogs name
  case-insensitively;
- keep existing alias conflict behavior when `realname` truly points to a
  different local artist.

This prevents `Robin Stone (2)` from becoming an alias of a newly created
`Robin Stone` record when both values refer to the same Discogs artist page.

## Release Import Data Flow

Discogs release mapping should stop reducing artist data to plain strings too
early. The external metadata model should carry an artist reference shape with:

- display name;
- optional external source with provider, resource type, external id, and source
  URL.

This artist reference should be available for:

- release main artists;
- track main artists;
- release-level extra artists and credits;
- track-level extra artists and credits when Discogs provides an id.

The API draft and review payloads should keep existing human-readable name
fields for compatibility and UI simplicity, but add optional per-artist external
source data. Existing stored drafts that do not contain per-artist source data
continue to confirm through the current name-based behavior.

During import confirmation, release-level and track-level artist credits should
use a shared resolver that follows the identity resolution order above.

The release's own Discogs external source remains unchanged. This design adds
artist identity inside release credits and track credits.

## API And UI Presentation

Artist API responses should expose a derived secondary identity hint based on
external sources. For Discogs-linked artists, the UI can show:

```text
Discogs #12345
```

The primary display name stays `Robin Stone`.

Search results, artist lists, and import/review suggestions should include the
same secondary identity hint so users can distinguish same-name records:

```text
Robin Stone
Discogs #12345
```

```text
Robin Stone
```

No suffix should be added to the primary name unless the suffix is literally
part of a manually entered local name.

## Error Handling

If incoming Discogs artist source data is malformed or missing the external id,
DiscWeave treats that item as name-only metadata and keeps current behavior.

If multiple local artists in the same collection have the same Discogs artist
external source, DiscWeave should surface a conflict or review issue instead of
silently choosing one.

If a Discogs artist id appears on a record in another collection, it must not be
used for matching in the current collection.

## Testing

Add focused coverage for:

- Discogs name suffix cleaning for provider-sourced names only;
- manually entered `Name (2)` values remaining unchanged;
- artist refresh skipping real-name alias creation when `realname` equals the
  cleaned Discogs name;
- artist refresh attaching and reusing Discogs artist external sources;
- release import resolving artists by Discogs artist id before name;
- release import creating two same-name artists when external identity differs;
- existing name-only import drafts continuing to confirm;
- collection isolation for external-source artist matching;
- API responses exposing secondary Discogs identity hints.

## Rollout

Implement the behavior for future Discogs imports and future Discogs artist
refreshes only. Do not run a data migration that renames existing artists or
rewrites existing alias relations.

Manual cleanup of already affected records can be handled separately through
existing edit/delete tools or a future explicit repair workflow.
