# Local Desktop Release Smoke Checklist

Run this checklist on an Apple Silicon Mac before publishing a ready release.

## Install and first launch

- Install the DMG into `/Applications`.
- Launch DiscWeave without starting a separate API server.
- Confirm the app opens without login.
- Confirm diagnostics show the data directory, log directory, backend health, and backend process status.

## Archive workflows

- Import a small local folder containing at least one audio file and one cover image.
- Confirm import review shows parsed metadata and SHA-256 identity.
- Confirm search finds the imported artist, release, track, label, tag, and media status.
- Open Review Workbench and confirm generated catalog, file, and import cleanup signals load.
- Export JSON.
- Export CSV ZIP.
- Confirm the CSV ZIP contains `local_audio_files.csv`, `digital_track_file_links.csv`, and `review_report.csv`.

## Restart and recovery

- Quit DiscWeave.
- Relaunch DiscWeave.
- Confirm the same collection data is present.
- Confirm `logs/backend.log` and `logs/desktop.log` exist under the data directory.
- Confirm JSON and CSV exports still complete after relaunch.
