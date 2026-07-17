---
type: Domain Entity
title: Track
description: A musical work or recording entry as it appears within release media and tracklists.
tags: [domain, entity, track]
timestamp: 2026-07-17T00:00:00Z
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

## Stack Assignment

- Assigning a Track to a stack creates a directed relation from the member Track
  to the existing stack root. It does not create a persisted `TrackStack`
  aggregate.
- An assignable source is a standalone Track that is neither a member of another
  stack nor a root with members. An assignment target is an existing original
  Track with at least one transitive stack member.
- Destination discovery is collection-scoped and independent of the Tracks
  workspace's current scroll position, filters, and visible page. A match on a
  stack member identifies its root as the destination.
- The user explicitly chooses one of the enabled stack relation types.
  DiscWeave does not infer relation meaning from Track titles.
- Drag-and-drop remains a direct path when both records are visible. Searchable,
  keyboard-accessible assignment is the scalable path for large collections;
  both paths use the same authoritative validation and relation mutation.

## Related Knowledge

- [Release](release.md)
- [Medium](medium.md)
- [Credit](credit.md)
- [Collection Isolation](../architecture/collection-isolation.md)
