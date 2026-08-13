---
type: Product Constraint
title: Product Boundaries
description: DiscWeave is a music archive, not a player, marketplace, social network, or streaming product.
tags: [product, constraints, scope]
timestamp: 2026-06-27T00:00:00Z
---

# Product Boundaries

DiscWeave is a music archive, not a music player.

Do not optimize product or architecture decisions for:

- streaming;
- cloud audio storage;
- mobile-first product direction;
- social networking;
- marketplace flows;
- complex recommendation engines;
- Neo4j-first storage;
- rights or DRM workflows;
- public profiles;
- sharing flows.

External integrations may assist metadata entry and original-track discovery,
but core entities must not depend on Discogs or MusicBrainz identifiers.
MusicBrainz is used for Recording lineage and row evidence; Discogs may enrich a
concrete release edition. Both are optional provenance references, never local
identity, ownership, or a recommendation engine. Search is read-only and
provider failures must not erase already-visible candidates.

## Related Knowledge

- [DiscWeave](discweave.md)
- [Import Deduplication](../workflows/import-deduplication.md)
- [Release](../domain/release.md)
