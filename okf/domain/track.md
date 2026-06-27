---
type: Domain Entity
title: Track
description: A musical work or recording entry as it appears within release media and tracklists.
tags: [domain, entity, track]
timestamp: 2026-06-27T00:00:00Z
---

# Track

A Track represents a concrete track version or recording connected to one or
more media and releases.

DiscWeave should preserve tracklist number, title, duration, artist attribution,
and credits where available.

## Modeling Notes

- Track numbering should support physical and digital media layouts.
- Track-level credits can differ from release-level credits.
- Track data may be incomplete, especially for rare or user-entered material.
- Track year metadata should describe the concrete version or recording, not the
  release year.
- Track stacks are relation-derived views. The original or anchor Track is an
  explicit Track metadata choice, and stack membership is found by traversing
  configured version-like Track relations toward that original.
- Track stack relation behavior belongs in collection-level stack settings, not
  as a hard-coded flag on relation type dictionary entries.
- Release-only tracklist rows are not Tracks and should not appear in the Tracks
  workspace.

## Related Knowledge

- [Release](release.md)
- [Medium](medium.md)
- [Credit](credit.md)
