# Local Backup, Restore, and Recovery

DiscWeave local desktop data is user-owned archive data and must be recoverable without a hosted service.

## Backup scope

A complete local backup includes:

- `discweave.sqlite` from the data directory;
- cover artifacts under `artifacts/covers`;
- import artifacts under `artifacts/imports`;
- `integrations.local.json` when its local integration configuration must be recovered;
- portable JSON export for human-readable recovery;
- portable CSV ZIP export for spreadsheet inspection.

## Safe backup process

1. Quit DiscWeave so SQLite has no active writer.
2. Copy the full DiscWeave data directory.
3. Create a JSON export and CSV export when the app is healthy.
4. Store checksums with the backup bundle.

## Restore baseline

- Portable JSON restore targets an empty collection by default.
- Restoring over existing archive data is destructive and requires explicit confirmation text from the user.
- Recovery documentation must prefer copying a full backup into a new data directory over mutating a live database.
- Failed restore attempts must leave the source backup untouched.

## Pre-release SQLite schema reset

This procedure requires project-owner approval under the disposable
pre-release baseline exception. It does not authorize a reset and must not be
used for user-owned archives.

1. Finish import work that must be available after the reset. Archiving a
   session does not make it part of portable JSON. JSON restore never includes
   import sessions, drafts, draft issues, or import artifacts. Keep a full
   recovery copy and use it as a separate old archive if unfinished import work
   must be retained.
2. Use the old compatible DiscWeave build to create a JSON export while it can
   still open the existing archive. The export restores catalog data and
   supported collection settings into an empty collection, but does not restore
   accounts, incomplete imports, raw cover bytes, or audio bytes. Then fully
   quit DiscWeave again before copying or moving any data directory.
3. Copy the complete data directory to a dated, unchanged recovery location.
   On macOS the default is
   `~/Library/Application Support/DiscWeave`; `DISCWEAVE_DATA_DIR` can select
   another directory. Preserve the SQLite file, `artifacts/`, and
   `integrations.local.json` together.
4. Move the active data directory aside, start DiscWeave to create a fresh
   schema, and restore the JSON file into the empty collection. Do not merge
   the old SQLite file or import artifacts into the new directory.
5. Check startup, search, and a fresh JSON export. Retain the full directory
   copy until the new archive is accepted; use that copy in a separate data
   directory if incomplete imports or local artifacts must be recovered.

## Recovery smoke check

After recovery, verify app startup, health, search, imports list, covers, JSON export, CSV export, quit, and relaunch.
