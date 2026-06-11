# Local Desktop Runtime Contract

DiscWeave desktop owns the local API sidecar lifecycle when the app is packaged for macOS. The renderer stays on same-origin relative `/api/*` calls and never receives the sidecar token or raw backend port.

## Startup sequence

1. Electron main resolves the DiscWeave user data directory from macOS Application Support.
2. Electron main chooses an unused loopback port by binding `127.0.0.1:0` for the desktop HTTP proxy.
3. Electron main creates a per-launch random API token and starts the published API sidecar with:
   - `DISCWEAVE_RUNTIME_MODE=LocalDesktop`;
   - `DISCWEAVE_DATA_DIR=<Application Support>/DiscWeave`;
   - `DiscWeave__StorageProvider=Sqlite`;
   - `DiscWeave__LocalDesktop__Token=<per-launch token>`;
   - `ASPNETCORE_URLS=http://127.0.0.1:0` or the explicit packaged sidecar URL when the sidecar is pre-bound by the launcher.
4. Electron main waits for `/health` before showing the renderer.
5. If health does not become ready, Electron main renders a startup failure page with the log path and the sidecar exit code.

## Proxy and authentication boundary

- The desktop HTTP proxy is the only renderer-visible API origin.
- Electron main injects the per-launch token into sidecar-bound `/api/*` and `/health` requests.
- The token is never exposed through preload, renderer globals, query strings, local storage, or cookies.
- Existing same-origin cookie behavior remains valid behind the proxy.

## Logs and diagnostics

- Sidecar stdout and stderr are appended to `logs/backend.log` under the DiscWeave data directory.
- Electron main writes desktop lifecycle events to `logs/desktop.log`.
- Startup failures include the data directory, log directory, proxy port, backend status, and actionable next steps.

## Shutdown

- Electron main terminates the sidecar during `before-quit`.
- If graceful shutdown times out, Electron main kills the sidecar process and records that outcome in `desktop.log`.
- A relaunch creates a fresh token and does not reuse the previous token.
