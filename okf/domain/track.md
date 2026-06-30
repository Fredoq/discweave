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
- Release editors and import review may update Track title, duration, year, and
  Track credits through a linked release tracklist row when that row points to a
  catalog Track.
- Track stacks are relation-derived views. The original or anchor Track is an
  explicit Track metadata choice, and stack membership is found by traversing
  configured version-like Track relations toward that original.
- `remixOf` and `versionOf` are product-owned protected Track relation type
  codes. The Tracks workspace may use them for first-class stack groups named
  Remixes and Versions.
- Edits, radio edits, and single edits are modeled as `versionOf`; DiscWeave
  does not maintain a separate built-in `editOf` relation type.
- Collection-level stack settings remain the extension point for traversal and
  future custom stack rules. Non-product stack relation types should appear as
  Other relations until custom stack grouping is modeled explicitly.
- Release-only tracklist rows are not Tracks and should not appear in the Tracks
  workspace.

## Related Knowledge

- [Release](release.md)
- [Medium](medium.md)
- [Credit](credit.md)
