# Discogs Artist Alias Of Design

## Goal

When Discogs artist detail provides a real name, applying that detail should connect the current artist alias or stage name to the real person in the artist graph.

## Behavior

- Discogs artist detail imports the Discogs `realname` field as `realName`.
- The artist review panel shows a `Real name` row.
- Applying Discogs data keeps the edited artist's type unchanged unless the existing group-member detection applies.
- If `realName` is blank or equals the current artist name case-insensitively, no alias relation is created.
- If `realName` names an existing artist in the same collection, that artist is reused.
- If no artist with that name exists, a new `Person` artist is created.
- The current artist receives an `aliasOf` relation to the real-name artist.
- Reapplying the same Discogs artist data does not duplicate the artist or relation.

## Dictionary

`aliasOf` is a builtin artist relation type with the display name `Alias of`. It is protected like `memberOf`, so users cannot disable, delete, rename, or reorder it from the dictionary.

The old `alias` relation type is no longer part of the default dictionary for new collections. Existing data compatibility is not required for this change.

## UI

`Review Discogs artist` shows `Real name` between `Type` and `Aliases`. The row communicates that applying Discogs data will create or reuse the real-name person and create an `Alias of` relation. No new artist type is introduced.

## Tests

- Domain test for protected `aliasOf`.
- API tests for creating and reapplying a Discogs real-name alias relation.
- External metadata mapping/client tests for `realName`.
- UI tests for showing `Real name` in the Discogs artist review and sending it in the apply payload.
