---
type: Domain Entity
title: Credit
description: A role-based relationship between an artist or entity and a release, track, label, or other music object.
tags: [domain, entity, credit, roles]
timestamp: 2026-06-27T00:00:00Z
---

# Credit

A Credit records a role-based relationship between an artist or entity and a
music object.

Credits help users navigate producers, remixers, engineers, performers,
memberships, aliases, and other relationships that make a collection meaningful.

## Modeling Notes

- Use explicit roles or constrained role values where practical.
- Preserve source wording when the user's data needs it.
- Support release-level and track-level credits when needed.
- Avoid reducing credits to unstructured text if relationship queries depend on
  them.

## Related Knowledge

- [Artist](artist.md)
- [Release](release.md)
- [Track](track.md)
