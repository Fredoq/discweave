---
type: Architecture Decision
title: SQLite Storage
description: DiscWeave uses local SQLite storage and local artifact directories for v2 baseline data.
tags: [architecture, sqlite, local-first, storage]
timestamp: 2026-10-11T00:00:00Z
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
but does not upgrade an existing SQLite file. User-owned archives now exist, so
a schema change after the baseline ships as an in-place upgrade step.

## In-Place Upgrades

`SqliteSchemaUpgrader` runs at startup, after `EnsureCreated`.

- The schema version lives in `PRAGMA user_version`. A newly created database
  starts at the current version; an existing one runs the missing steps.
- Steps are append-only and numbered. A step adds what the current EF model
  expects and converts existing rows; it never rewrites an earlier step.
- Before the first pending step the database is copied next to itself as
  `<database>.schema-v<old version>.bak` with `VACUUM INTO`. The steps and the
  version bump then run in one transaction.
- Version 1 adds `rating_values.is_standout` and
  `rating_criteria.artist_average_roles`, and converts ten-point ratings to
  the five-point scale: 1-5 become 1, 6-9 become 2-5, and 10 becomes a
  standout 5.
- The portable JSON export stays the recovery boundary it was: it does not
  restore import sessions or drafts, raw cover bytes, audio bytes, or account
  data.

## Related Knowledge

- [Local-First Desktop Direction](../product/local-first-desktop.md)
- [Import Deduplication](../workflows/import-deduplication.md)
- [Human-Readable Export](../workflows/export-human-readable.md)
