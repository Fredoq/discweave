---
type: Domain Entity
title: Medium
description: A release component such as a vinyl disc, CD, cassette side, file set, or other carrier.
tags: [domain, entity, medium]
timestamp: 2026-06-27T00:00:00Z
---

# Medium

A Medium represents a carrier or subdivision of a release, such as a vinyl disc,
CD, cassette side, file set, or other format component.

Media help DiscWeave represent tracklists, formats, copies, and physical or
digital gaps accurately.

## Modeling Notes

- A release can contain one or more media.
- Media type and format should use constrained values where practical.
- Track order belongs to the medium layout, not only to the track title.

## Related Knowledge

- [Release](release.md)
- [Track](track.md)
- [Owned Item](owned-item.md)
