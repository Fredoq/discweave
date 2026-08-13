---
type: Architecture Constraint
title: Collection Isolation
description: Collection-specific user data must stay isolated across domain logic, API behavior, storage, import, export, and tests.
tags: [architecture, collection, isolation, data-safety]
timestamp: 2026-07-24T00:00:00Z
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
- Original-discovery source lookup, candidate fact loading, relation traversal,
  and ranking must be scoped by the active Collection ID. A foreign source is
  indistinguishable from a missing source, and foreign candidates never appear.
- Candidate search performs no writes. Confirmation reloads and revalidates the
  source, target, stack state, and settings inside the active collection before
  atomically creating the relation and, when requested, promoting a standalone
  target.
- External provider evidence and local provenance lookup are also scoped by the
  active Collection ID. A provider reference may match zero, one, or many local
  entities; foreign Release/Track IDs are never selectable, and ambiguous local
  matches remain a persisted review state rather than being guessed.
- Cached provider snapshots are suitable for discovery display only. Binding
  validation and all mutations bypass cached snapshots while retaining
  cancellation, throttling, and typed provider-failure handling.

## Related Knowledge

- [Owned Item](../domain/owned-item.md)
- [Destructive Operations](../workflows/destructive-operations.md)
- [Import Deduplication](../workflows/import-deduplication.md)
