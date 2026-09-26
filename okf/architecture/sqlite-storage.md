---
type: Architecture Decision
title: SQLite Storage
description: DiscWeave uses local SQLite storage and local artifact directories for v2 baseline data.
tags: [architecture, sqlite, local-first, storage]
timestamp: 2026-09-26T00:00:00Z
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

## Baseline Compatibility

The local desktop baseline uses `EnsureCreated`, which creates a missing schema
but does not upgrade an existing SQLite file. Before the first user-owned
archives, reviewed schema changes may use the one-time pre-release reset policy
in [the migration policy](../../api/docs/arch/migration-policy.md). Its
[pre-release reset procedure](../../api/docs/backup/local-backup-restore.md#pre-release-sqlite-schema-reset)
preserves the recovery boundary: portable JSON does not restore import sessions
or drafts, raw cover bytes, audio bytes, or account data. Once user-owned
archives exist, schema changes need a durable upgrade path or an approved
archive-preserving backup and restore procedure.

## Related Knowledge

- [Local-First Desktop Direction](../product/local-first-desktop.md)
- [Import Deduplication](../workflows/import-deduplication.md)
- [Human-Readable Export](../workflows/export-human-readable.md)
