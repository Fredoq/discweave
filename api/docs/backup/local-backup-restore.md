# Local Backup, Restore, and Recovery

DiscWeave local desktop data is user-owned archive data and must be recoverable without a hosted service.

## Backup scope

A complete local backup includes:

- `discweave.sqlite` from the data directory;
- cover artifacts under `artifacts/covers`;
- import artifacts under `artifacts/imports`;
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

## Recovery smoke check

After recovery, verify app startup, health, search, imports list, covers, JSON export, CSV export, quit, and relaunch.
