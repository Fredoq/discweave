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

## Related Knowledge

- [Owned Item](owned-item.md)
- [Medium](medium.md)
- [Track](track.md)
- [Label](label.md)
- [Import Deduplication](../workflows/import-deduplication.md)
