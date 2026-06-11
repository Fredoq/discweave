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

SQLite is the default local provider. Historical hosted storage profiles are not part of the local desktop baseline.
