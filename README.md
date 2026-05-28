# Cratebase Web

React/TypeScript web and desktop UI for Cratebase.

Cratebase is a personal music archive for collectors, DJs and deep music nerds. The web app is focused on catalog browsing, search, relation navigation, manual entry, import, export and collection management.

## Product Status

This repository is the shared React app for authenticated browser use and the Electron macOS desktop shell. It supports server-backed catalog workspaces, search, graph detail panels, manual entry, import review, persistent playlists, rating showcases, settings, portable export flows, and JSON restore into empty collections.

Runtime screens use collection-scoped API routes when the API is available. A test/fallback catalog state remains for unit tests and local UI coverage.

## Tech Stack

- React
- TypeScript
- Vite
- ESLint
- Prettier
- Vitest
- Testing Library
- Electron for the macOS desktop app

## Requirements

- Node.js 22.13.0 or newer, excluding unsupported odd-numbered Node.js majors
- npm 10 or newer

## Development

```sh
npm install
npm run dev
```

## Local API Auth Testing

Run the API with a configured local PostgreSQL connection string and the HTTP launch profile:

```sh
cd ../cratebase-api
ConnectionStrings__Cratebase="Host=localhost;Port=5432;Database=cratebase;Username=<postgres-user>;Password=<postgres-password>" \
  dotnet run --project src/Cratebase.Api/Cratebase.Api.csproj --launch-profile http
```

The HTTP profile listens on `http://localhost:5094`.

Run the web app with the same-origin Vite proxy. The proxy target defaults to `http://localhost:5094`, so the environment variable is only needed when the API uses a different local port:

```sh
cd ../cratebase-web
VITE_CRATEBASE_API_PROXY_TARGET=http://localhost:5094 npm run dev
```

The Vite dev server usually listens on `http://localhost:5173`. Open the web URL and use the first-user bootstrap form if the API database has no users.

## Desktop Development

The desktop app packages the same UI through Electron and enables local folder import. It scans audio metadata and SHA-256 content hashes locally, then sends metadata, file identity, paths and cover artifacts to the API. It does not upload audio files. The hosted desktop submission contract is documented in the sibling API repository at `cratebase-api/docs/imports/desktop-import-api-boundary.md`.

Run the API first, then start the desktop app in development mode:

```sh
CRATEBASE_API_BASE_URL=http://localhost:5094 npm run desktop:dev
```

Build or package the macOS app:

```sh
npm run desktop:build:mac
npm run desktop:package:mac
```

## Hosted Private Beta Baseline

The browser web app is deployed behind the same public origin as the API. It
uses relative `/api` requests, so hosted browser traffic does not require CORS.
The placeholder private beta origin is `https://cratebase.example.com` until the
real domain is chosen.

The web Docker image builds the Vite app and serves static assets on internal
HTTP port `8080`. A reverse proxy should route `/api/*` and `/health` to the API
container, route `/web-health` to the web container health check, and route every
other path to the web container.

The desktop app connects to the hosted API through the Electron local proxy.
Packaged builds default to `https://cratebase.example.com`, while development
builds default to `http://localhost:5094`. Set `CRATEBASE_API_BASE_URL` at
runtime when a desktop build must target another hosted origin.

Private beta users sign in with issued credentials. The first bootstrap setup
creates the first admin account and its default private collection.

The cross-repository compose and reverse proxy example lives in
`../cratebase-api/deploy`.
Private beta data handling, hosted backup ownership, and release readiness are
documented in
`../cratebase-api/docs/private-beta/data-handling-and-trust.md` and
`../cratebase-api/docs/private-beta/release-readiness.md`.

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Product Workflows

- First-user bootstrap and cookie-authenticated API usage.
- Catalog search with saved views for physical/digital gaps, lossy/lossless gaps, wishlist gaps, digitization needs, remixes, productions and labels.
- Workspaces for artists, releases, tracks, owned items, labels, relations, playlists, imports, exports and settings.
- Server graph context in catalog detail panels, including credits, relations, media, collector signals and playlist backlinks.
- Persistent manual and smart playlists through `/api/playlists`.
- Browser import review and desktop-only local folder scanning through the Electron preload bridge, with streaming SHA-256 hashes and duplicate review warnings.
- JSON and CSV export downloads in browser and desktop modes.
- JSON restore into an empty active collection.

The desktop import API boundary is documented in
`../cratebase-api/docs/imports/desktop-import-api-boundary.md`. The portable
export v1 contract is documented in
`../cratebase-api/docs/exports/portable-export-v1.md`. User-triggered JSON and
CSV exports are portability tools and personal backups; hosted service backups
are an operator-managed responsibility outside the export UI.
Private beta data handling and release readiness are tracked in
`../cratebase-api/docs/private-beta/data-handling-and-trust.md` and
`../cratebase-api/docs/private-beta/release-readiness.md`.

See [docs/acceptance-checklist.md](docs/acceptance-checklist.md) for the shared acceptance path.

## Product Boundaries

- Smart playlist editing currently exposes simple rule text and preserves server rules when editing existing smart playlists.
- Manual playlist creation can persist ordered server catalog links; free-form draft links are kept client-side until linked to catalog IDs.
- The browser app can review import sessions but cannot browse arbitrary local folders or show the desktop folder picker.
- There is no streaming player, social graph, marketplace, recommendation engine or external catalog integration.
- Cratebase Web is a working catalog, search and relation-navigation interface, not a public profile system or mobile-first app.

## License

MIT
