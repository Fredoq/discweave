# Archive backup and schema upgrade

## Supported desktop workflow

When Labels needs the new import-source table, choose **Back up and upgrade**
in the desktop app. The action is explicit and optional. It pauses application
operations and folder watchers, waits for active operations, stops the owned API,
and runs the offline upgrade. It never scans, moves, rewrites, or deletes external
audio files. A declined upgrade leaves the known preceding schema usable for
ordinary collection and import work.

The operation recognizes only the current model or its immediately preceding
baseline without the label-import-links table. It refuses unexpected columns,
constraints, indexes, tables, triggers, views, or an invalid upgrade ledger.
Unknown archives are not repaired, reset, or written by the application.

## Backup contents and guarantees

Before changing the schema, the upgrader holds an exclusive application lease
and a SQLite writer lock. It checks database integrity and foreign keys, then
uses SQLite's backup API to create a standalone snapshot including committed
WAL contents. Copying only the original `.sqlite` file would not be sufficient.
The snapshot is checked independently before schema changes begin.

A sibling `DiscWeave Backups/<timestamp-and-id>/` directory contains:

- `data/discweave.sqlite`: the complete pre-upgrade database, including catalog,
  authentication, import sessions, review drafts, and database settings;
- `data/artifacts/` and `data/integrations.local.json`, when present;
- persistent desktop settings: `watched-import-folders.json`,
  `discover-credentials.enc`, `local-file-trust.json`, `scan-manifests/`, and
  `local-edit-operation-logs/`, when present;
- `manifest.json`: source roots, included and absent entries, file hashes,
  backup format, and explicit exclusions.

Settings are stored under `settings/`, or under `data/` when the two source
roots are the same. Included paths cannot be symbolic links. Each copied file
is hash-checked; backup directories and files are restricted to the current user
on Unix systems. A complete backup is renamed out of its `.incomplete` name only
after verification. A backup failure leaves the original schema unchanged.

This is an **archive and application-settings backup**, not a full browser
profile or machine backup. It excludes external audio, Chromium caches, cookies,
sessions, localStorage staging plans and UI preferences, and application logs.
These excluded originals are not modified by the upgrade. Encrypted credentials
may depend on the same machine's keychain and are not promised to be portable.

## Offline command

The desktop bridge supplies these paths from its trusted runtime configuration;
the renderer cannot choose them. For maintenance by an informed operator, quit
the app and every API process first, then use the packaged API executable:

```sh
DISCWEAVE_DATA_DIR="/absolute/archive-directory" \
DISCWEAVE_DESKTOP_SETTINGS_DIR="/absolute/desktop-settings-directory" \
/path/to/DiscWeave.Api --upgrade-archive
```

An explicit database connection override or integration-settings path is not
supported by this automatic path. The command returns
`archive.configuration_unsupported` rather than backing up a different default
archive or silently changing configuration. Local desktop cover storage already
resolves to its canonical artifacts directory when no database override exists.
Use read-only status for the active backend to diagnose custom configurations;
do not clear or redirect them merely to make an upgrade run.

`--archive-status` is read-only and may run while the app is open. It returns
`current`, `upgradeRequired`, or `unsupported`. The upgrade returns one JSON
object with `status`, `code`, and `backupDirectory`; exit zero means `upgraded`
or an unchanged `current` archive. A nonzero exit means blocked or failed. Never
treat an `.incomplete` folder or a failed command as a usable backup.

## Failure, retry, and recovery

A busy application lease or database writer, unreadable paths, unsafe included
symlinks, backup errors, unknown schema, or integrity failure stops the action.
Schema changes and their ledger entry share one transaction. If interrupted,
SQLite rolls back uncommitted changes. Retrying inspects the actual schema: it
continues only from a known baseline and does nothing if already current.
A failed attempt may leave a clearly marked incomplete backup for inspection.
No automatic deletion or rollback of user files is performed.

For recovery, stop the application and all API processes. Preserve the current
data/settings directories separately before restoring anything. Use only a
completed, verified backup. Restore its database and artifacts and the explicit
settings entries to their original roots from the manifest; retain or move aside
current entries rather than deleting them blindly. Entries marked absent in the
manifest must not be reintroduced from post-backup state. Do not copy old WAL/SHM
files alongside the standalone snapshot. Start the application version compatible
with the restored schema. Keep both copies until the archive has been checked.
Changes made after the backup will not be present in the restored archive.
