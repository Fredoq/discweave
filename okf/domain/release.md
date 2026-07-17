---
type: Domain Entity
title: Release
description: Reference metadata for a music release, separate from concrete owned copies.
tags: [domain, entity, release]
timestamp: 2026-07-17T00:00:00Z
---

# Release

A Release describes reference metadata for a published or otherwise cataloged
music release.

Release data is distinct from a user's concrete owned copies. A release can have
multiple media, tracks, labels, credits, versions, and related releases.

## Modeling Notes

- Keep reference release data separate from [Owned Item](owned-item.md).
- Model formats and media without assuming the user owns a copy.
- Treat Discogs or MusicBrainz identifiers as optional external references, not
  core identity.
- Preserve versions, editions, and formats because they matter to collectors.
- A release tracklist row may be linked to a catalog [Track](track.md) or remain
  release-only when the row is useful release metadata but should not create a
  standalone Track record.
- When a linked release tracklist row exposes Track title, duration, year, or
  Track credits for editing, those fields update the linked catalog Track; row
  position, disc, and side remain release-tracklist metadata.
- Release-only tracklist rows should preserve position, title, duration, and
  attribution where available, while staying outside Track relations, Track
  ratings, and the Tracks workspace.

## Release-Scoped Local File Opening

- Release detail may expose local-file actions for its linked Tracks, but
  DiscWeave delegates opening to the operating system's default application. It
  does not provide embedded playback or playback state.
- A Track-level quick-open action is scoped to the selected Release and uses
  only local files linked to that Track's appearance on that Release. Files for
  the same Track on other Releases are excluded.
- When no eligible local file exists, the action is absent. One eligible file
  opens directly through the trusted desktop bridge; multiple eligible files
  open the existing scoped file panel.
- Direct-open requests are serialized within the selected Release. Switching to
  another Release exposes that Release's independent actions, and completion of
  an earlier request must not replace the new Release's pending state.
- Trusted-path validation and open failures use the established local-file
  result and retry flow. Track detail remains the place to inspect local files
  across all Release appearances.

## Related Knowledge

- [Owned Item](owned-item.md)
- [Medium](medium.md)
- [Track](track.md)
- [Label](label.md)
- [Import Deduplication](../workflows/import-deduplication.md)
- [Local-First Desktop Direction](../product/local-first-desktop.md)
- [Product Boundaries](../product/product-boundaries.md)
