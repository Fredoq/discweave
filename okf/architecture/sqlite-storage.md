---
type: Architecture Decision
title: SQLite Storage
description: DiscWeave uses local SQLite storage and local artifact directories for v2 baseline data.
tags: [architecture, sqlite, local-first, storage]
timestamp: 2026-06-27T00:00:00Z
---

# SQLite Storage

DiscWeave v2 stores baseline data locally in SQLite, with local artifact
directories under macOS Application Support.

The schema should support relationship and role queries, not only direct title
search.

## Constraints

- Preserve exportability in human-readable formats.
- Use constrained values where domain lists are constrained.
- Avoid infrastructure that is only speculative future preparation.
- Keep import and deduplication scenarios visible when changing schema.

## Related Knowledge

- [Local-First Desktop Direction](../product/local-first-desktop.md)
- [Import Deduplication](../workflows/import-deduplication.md)
- [Human-Readable Export](../workflows/export-human-readable.md)
