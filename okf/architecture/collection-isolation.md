---
type: Architecture Constraint
title: Collection Isolation
description: Collection-specific user data must stay isolated across domain logic, API behavior, storage, import, export, and tests.
tags: [architecture, collection, isolation, data-safety]
timestamp: 2026-06-27T00:00:00Z
---

# Collection Isolation

DiscWeave must keep collection-specific user data isolated.

Local mode provisions one owner and one default collection, but code should still
respect collection boundaries so future collection workflows remain safe.

## Constraints

- Domain logic, storage, search, import, export, and API behavior should preserve
  collection boundaries.
- Tests should cover collection isolation for affected workflows.
- Destructive operations must not cross collection boundaries accidentally.

## Related Knowledge

- [Owned Item](../domain/owned-item.md)
- [Destructive Operations](../workflows/destructive-operations.md)
- [Import Deduplication](../workflows/import-deduplication.md)
