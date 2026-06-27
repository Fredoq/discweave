---
type: Workflow
title: Import Deduplication
description: Every import path needs an explicit strategy for matching, merging, and preserving music collection data.
tags: [workflow, import, deduplication]
timestamp: 2026-06-27T00:00:00Z
---

# Import Deduplication

Every DiscWeave import path must have a clear deduplication strategy.

Imports may come from files, spreadsheets, folders, notes, Discogs, MusicBrainz,
or custom tables, but core entity identity must not depend on external service
identifiers.

## Expectations

- Define matching keys and confidence rules before importing records.
- Separate reference release data from owned item data.
- Preserve user-entered data unless the user explicitly chooses an overwrite.
- Track ambiguous matches so users can resolve them.
- Write tests for import, deduplication, and collection isolation behavior.

## Related Knowledge

- [Release](../domain/release.md)
- [Owned Item](../domain/owned-item.md)
- [Collection Isolation](../architecture/collection-isolation.md)
