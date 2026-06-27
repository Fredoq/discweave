---
type: Domain Entity
title: Track
description: A musical work or recording entry as it appears within release media and tracklists.
tags: [domain, entity, track]
timestamp: 2026-06-27T00:00:00Z
---

# Track

A Track represents a tracklist entry, musical work, or recording entry connected
to one or more media and releases.

DiscWeave should preserve tracklist number, title, duration, artist attribution,
and credits where available.

## Modeling Notes

- Track numbering should support physical and digital media layouts.
- Track-level credits can differ from release-level credits.
- Track data may be incomplete, especially for rare or user-entered material.

## Related Knowledge

- [Release](release.md)
- [Medium](medium.md)
- [Credit](credit.md)
