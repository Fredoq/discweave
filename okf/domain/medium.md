---
type: Domain Entity
title: Medium
description: A release component such as a vinyl disc, CD, cassette side, file set, or other carrier.
tags: [domain, entity, medium]
timestamp: 2026-10-03T00:00:00Z
---

# Medium

A Medium represents a carrier or subdivision of a release, such as a vinyl disc,
CD, cassette side, file set, or other format component.

Media help DiscWeave represent tracklists, formats, copies, and physical or
digital gaps accurately.

Track numbers are unique within a medium (including its side when sides are
modeled); the same number may therefore appear on different media of one
release.

## Modeling Notes

- Folder imports derive a disc marker from nested disc folders matched by Disc
  folder import patterns; see [Import Deduplication](../workflows/import-deduplication.md).

- A release can contain one or more media.
- Media type and format should use constrained values where practical.
- Track order belongs to the medium layout, not only to the track title.

## Related Knowledge

- [Release](release.md)
- [Track](track.md)
- [Owned Item](owned-item.md)
