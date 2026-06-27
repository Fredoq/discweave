---
type: Domain Entity
title: Release
description: Reference metadata for a music release, separate from concrete owned copies.
tags: [domain, entity, release]
timestamp: 2026-06-27T00:00:00Z
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
- Release-only tracklist rows should preserve position, title, duration, and
  attribution where available, while staying outside Track relations, Track
  ratings, and the Tracks workspace.

## Related Knowledge

- [Owned Item](owned-item.md)
- [Medium](medium.md)
- [Track](track.md)
- [Label](label.md)
- [Import Deduplication](../workflows/import-deduplication.md)
