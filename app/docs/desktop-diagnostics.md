# Desktop Diagnostics

The desktop preload exposes backend status through `discweaveDesktop.backend.status()`. This status includes health, data directory, log directory, backend base URL, backend executable, and process id when Electron owns the sidecar.

Users and support documentation should direct collectors to the log directory before asking them to rerun imports or recovery steps.

Diagnostics must not expose the per-launch local backend token to the renderer.
