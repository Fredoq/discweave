# Migration Policy

DiscWeave treats collection data as durable product data. The local desktop baseline currently creates the SQLite schema from the EF Core model. Future schema upgrade work must preserve the ability to upgrade an existing archive without rewriting history.

## Pre-release baseline exception

Before the first release with user-owned archives, the project owner may apply a
one-time baseline upgrade to the local development database (or export/reset
and recreate it) using a reviewed operational script. This exception does not
add EF Core migrations or a runtime schema upgrader to the product. It is valid
only while the product is an internal, disposable pre-release and no user-owned
archive must be preserved.

Once real user archives exist, this exception expires and schema-affecting
changes require an approved backup/export-and-restore procedure or an
append-only upgrade path before release.

## Existing SQLite baseline reset

`EnsureCreated` creates a missing SQLite schema; it does not add columns to an
existing database. During the pre-release baseline exception only, a
project-owner-approved schema change such as
`release_import_draft_tracks.has_explicit_version_year` may therefore use this
reset procedure. This documentation change neither authorizes nor performs a
reset. When the project owner approves one, follow the
[pre-release SQLite schema reset](../backup/local-backup-restore.md#pre-release-sqlite-schema-reset).
Do not use it after user-owned archives exist.

## Five-point rating baseline upgrade

The five-point rating change adds `rating_values.is_standout` and
`rating_criteria.artist_average_roles` and rescales stored ratings. Under the
baseline exception above, an existing local database is upgraded once with the
reviewed script
[`upgrade-ratings-to-five-point.sql`](../backup/upgrade-ratings-to-five-point.sql):
quit DiscWeave, copy the data directory, then run this from the repository
root (adjust the database path when `DISCWEAVE_DATA_DIR` is set):

```sh
sqlite3 -bail "$HOME/Library/Application Support/DiscWeave/discweave.sqlite" < api/docs/backup/upgrade-ratings-to-five-point.sql
```

The script maps 1-5 to 1, 6-9 to 2-5, and 10 to a standout 5, keeps every other
table untouched, and refuses to run twice. JSON restore applies the same
mapping to snapshots older than `formatVersion: 3`.

## Rules

- Do not reintroduce generated EF Core migrations unless a future task explicitly scopes a durable upgrade path.
- If migrations are reintroduced, keep them append-only, readable, and reviewable.
- Rewrite a baseline schema only with explicit project-owner approval for a deliberate schema reset.
- Back up collection data before applying migrations that affect catalog, ownership, import, search, export, settings, playlists, ratings, or authentication data.
- Back up local desktop databases and collection exports before shipping schema-affecting ownership changes such as adding `OwnedItemDetails.Note` / `owned_items.note`.
- Prefer reversible operational procedures for risky changes: export JSON first, apply migration, verify acceptance checks, then keep the backup until the upgraded archive is confirmed.

## Rollback Expectations

Rollback is an operational decision, not an automatic promise. If a schema upgrade cannot safely roll back automatically, document the recovery path in the same change, usually by restoring from a JSON export or database backup.

## Label import source links

The explicit label-to-import-session feature adds `label_import_session_links`.
Fresh databases receive it through the EF model. Existing archives use the
supported **Back up and upgrade** desktop action, not a reset or an automatic
startup migration. Declining it preserves ordinary collection and import
workflows; label-import links return `schema.upgrade_required` until upgraded.
An unrecognized schema blocks normal API access before authentication bootstrap
or mutations. Read-only maintenance status and health remain available.

The desktop action pauses application operations and watchers, drains pending
work, stops its owned API process, then invokes the packaged API's offline
`--upgrade-archive` command. The API process and upgrader share an exclusive
archive lease; a running API or SQLite writer prevents the upgrade. A successful
operation restarts the same backend. Web clients can inspect status but cannot
invoke the upgrade or choose filesystem paths.

The supported baseline is the current EF schema, the immediately preceding
schema missing only the label-import-links table, or the current schema with a
validated `label-import-links-v1` upgrade ledger. Structural comparison includes
columns, keys, indexes, constraints, and unexpected schema objects. Unknown
layouts fail closed; this mechanism is not a general repair or migration tool.
Schema mutation and the ledger entry commit in one SQLite transaction, only
after a consistent verified backup exists. Repeated requests are safe: an
already-current archive is not changed or backed up again. Interrupted backup
folders end in `.incomplete` and are never accepted as successful backups.

See [archive backup and upgrade](../backup/archive-schema-upgrade.md) for the
backup scope, offline command, failures, and recovery procedure. Implementing
this feature does not authorize applying it to the project owner's live archive.

The reviewed append-only SQL file
[`add-label-import-session-links.sql`](../backup/add-label-import-session-links.sql)
remains an advanced operational fallback for an already backed-up, stopped
archive. It is not the default user workflow and does not create or verify a
backup. The supported mechanism recognizes its equivalent table schema.
