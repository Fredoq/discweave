---
type: Domain Entity
title: Artist
description: A person, group, project, alias, or credited entity connected to releases, tracks, labels, and roles.
tags: [domain, entity, artist]
timestamp: 2026-06-27T00:00:00Z
---

# Artist

An Artist represents a music-related person, group, project, alias, or credited
entity.

Artists can be connected through aliases, memberships, collaborations, credits,
roles, and releases. These relationships are central to DiscWeave's value as a
music archive.

## Modeling Notes

- Preserve artist relationships even when metadata is incomplete.
- Do not collapse aliases into a single name unless the model explicitly records
  the alias relationship.
- Support credits on both releases and tracks when product scenarios require it.

## Related Knowledge

- [Credit](credit.md)
- [Release](release.md)
- [Track](track.md)
