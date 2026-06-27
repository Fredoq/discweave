---
type: Workflow
title: Destructive Operations
description: User data is important and destructive operations require explicit confirmation.
tags: [workflow, data-safety, destructive-actions]
timestamp: 2026-06-27T00:00:00Z
---

# Destructive Operations

Treat all DiscWeave user data as important.

Any destructive operation must require explicit confirmation and should make the
scope of deletion or mutation clear to the user.

## Expectations

- Avoid implicit destructive side effects.
- Make the affected collection, entity, and relationship scope clear.
- Write tests for destructive workflows that affect domain data, imports,
  exports, or collection isolation.

## Related Knowledge

- [Owned Item](../domain/owned-item.md)
- [Collection Isolation](../architecture/collection-isolation.md)
- [Product Boundaries](../product/product-boundaries.md)
