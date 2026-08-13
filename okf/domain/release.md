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
- MusicBrainz is the authority for Recording lineage and release-row
  membership. When explicit lineage is absent, deterministic Work, release,
  release-group, artist, version-role, and chronology evidence may produce an
  explainable lead; it never turns chronology or a shared Work by itself into
  confirmation. Discogs is optional release-edition enrichment: a route is
  used only after direct relationship evidence or deterministic compatible
  matching, and its release provenance coexists with MusicBrainz provenance.
  Compatible matching treats punctuation-only title differences and reordered
  sides or tracklist rows as source representation differences. It still
  requires a one-to-one track match and rejects conflicting identity,
  chronology, label, catalog, artist, or duration evidence.
- Original-track discovery presents concrete Release editions before abstract
  Recording leads. Each quick result identifies the exact release row and shows
  available date, artist, label, format, catalog number, position, duration,
  and provider links so the user can select an actionable import route.
- External release discovery enters the normal persisted import-review
  lifecycle. Metadata-only confirmation creates no fake local files and does
  not imply ownership; the explicit collection-item intent decides whether a
  Wanted or existing item is used.

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
