---
type: Domain Entity
title: Owned Item
description: A concrete physical or digital copy in the user's collection, separate from reference release metadata.
tags: [domain, entity, ownership, collection]
timestamp: 2026-06-27T00:00:00Z
---

# Owned Item

An Owned Item is a concrete copy in the user's collection.

Owned items answer collection inventory questions: which copies exist, what
format they are, what condition or status they have, where they are stored, and
whether there are physical or digital gaps.

## Modeling Notes

- Do not mix owned copy data into [Release](release.md).
- An owned item should reference a release when known.
- The model must support incomplete ownership data.
- Destructive operations affecting owned items require explicit confirmation.

## Related Knowledge

- [Release](release.md)
- [Medium](medium.md)
- [Collection Isolation](../architecture/collection-isolation.md)
- [Destructive Operations](../workflows/destructive-operations.md)
