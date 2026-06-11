# Local Desktop Storage

Local desktop mode uses SQLite and local artifact folders under the DiscWeave Application Support data directory.

## Runtime switches

- `DISCWEAVE_RUNTIME_MODE=LocalDesktop` selects local desktop defaults.
- `DISCWEAVE_DATA_DIR` overrides the data directory for development, smoke tests, and support recovery.
- `DiscWeave:StorageProvider=Sqlite` explicitly selects SQLite.

## Directory layout

```text
DiscWeave/
  discweave.sqlite
  artifacts/
    covers/
    imports/
  logs/
```

On macOS, the default root is `~/Library/Application Support/DiscWeave`. Other operating systems use the platform application data directory so automated tests can run outside macOS.

PostgreSQL remains available as the default hosted/transitional provider until the historical hosted runtime is removed.
