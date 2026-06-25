# Artist Alias Identity Design

## Goal

Make the built-in `aliasOf` relation read as product identity metadata instead of a technical graph edge in the Artists workspace.

## User Experience

Artist detail panels for `Person` records show an `Identity` block. The block always shows `Real name`. If the selected artist has an outgoing `aliasOf` relation, `Real name` is the target artist name. Otherwise, it is the selected artist name. If other artists have incoming `aliasOf` relations pointing at the selected artist, the block also shows `Aliases` with those source artist names.

`aliasOf` relations are hidden from the generic `Other relations` group. Membership relations keep their current dedicated presentation.

Artist master list rows use the same product language. Alias rows show `Real name: <target>`. Real-name rows with incoming aliases show `Aliases: <source list>`. Rows without product-specific identity or membership data keep the existing empty relation summary.

## Domain Rule

An artist may have at most one outgoing `aliasOf` relation in a collection. The API rejects attempts to create or update a second outgoing `aliasOf`. Discogs apply remains idempotent when the same real-name relation already exists, but rejects a conflicting real name instead of adding another alias target.

## Testing

Backend tests cover API create/update validation and Discogs apply conflict behavior. Frontend tests cover the detail `Identity` block, hidden technical `aliasOf` relation cards, and master-list summaries for both the alias artist and the real-name artist.
