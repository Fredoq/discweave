---
type: Architecture Decision
title: SQLite Storage
description: DiscWeave uses local SQLite storage and local artifact directories for v2 baseline data.
tags: [architecture, sqlite, local-first, storage]
timestamp: 2026-11-11T00:00:00Z
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

## Archive schema upgrades

The desktop archive upgrade is an explicit user action, not an incidental
schema change from `EnsureCreated`. The app checks schema compatibility before
opening authenticated collection workflows. Known previous schemas may keep
using compatible features while an additive upgrade is deferred; unknown
schemas fail closed instead of being guessed, reset, or silently rewritten.

Electron pauses and drains application work and stops the sidecar before
invoking its offline archive-maintenance command. A shared archive lease and a
SQLite write transaction prevent concurrent upgrade writers. A verified SQLite
backup includes committed WAL contents; archive artifacts and app-managed
settings are included with checksums before schema changes begin. External
audio and the active Chromium profile, including unsaved browser plans and UI
preferences, are excluded and never modified by the upgrade.

Each supported upgrade is append-only, with its schema changes and upgrade
ledger committed atomically. Completed recovery backups are retained on
failure. Reopening after interruption checks the resulting schema rather than
assuming that an interrupted UI implies either a successful or failed commit.
Backend restart failure is reported separately from database upgrade failure.

See [migration policy](../../api/docs/arch/migration-policy.md) for supported
baselines, backup scope, and recovery procedures.
