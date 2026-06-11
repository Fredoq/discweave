# Local Backend Sidecar

Electron main can start a packaged DiscWeave API sidecar, pass local desktop runtime variables, wait for health, proxy relative `/api/*` renderer traffic, and inject the per-launch token outside the renderer boundary.

Development still supports `DISCWEAVE_API_BASE_URL` for an externally started API. Packaged builds can set `DISCWEAVE_API_EXECUTABLE` or include the API executable under `Resources/api/DiscWeave.Api`.
