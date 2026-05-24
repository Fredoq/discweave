# Cratebase Web

React/TypeScript web and desktop UI for Cratebase.

Cratebase is a personal music archive for collectors, DJs and deep music nerds. The web app is focused on catalog browsing, search, relation navigation, manual entry, import, export and collection management.

## Project Status

This repository is an alpha product slice. The shared React app now supports authenticated browser use, the Electron macOS desktop shell, server-backed catalog workspaces, search, graph detail panels, manual entry, import review, persistent playlists, rating showcases, settings, and portable export flows.

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

The desktop app packages the same UI through Electron and enables local folder import. It scans audio metadata and SHA-256 content hashes locally, then sends metadata, file identity, paths and cover artifacts to the API. It does not upload audio files.

Run the API first, then start the desktop app in development mode:

```sh
CRATEBASE_API_BASE_URL=http://localhost:5094 npm run desktop:dev
```

Build or package the macOS app:

```sh
npm run desktop:build:mac
npm run desktop:package:mac
```

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Implemented Alpha Workflows

- First-user bootstrap and cookie-authenticated API usage.
- Catalog search with saved views for physical/digital gaps, lossy/lossless gaps, wishlist gaps, digitization needs, remixes, productions and labels.
- Workspaces for artists, releases, tracks, owned items, labels, relations, playlists, imports, exports and settings.
- Server graph context in catalog detail panels, including credits, relations, media, collector signals and playlist backlinks.
- Persistent manual and smart playlists through `/api/playlists`.
- Desktop local folder import with streaming SHA-256 hashes and duplicate review warnings.
- JSON and CSV export downloads in browser and desktop modes.

See [docs/alpha-checklist.md](docs/alpha-checklist.md) for the shared acceptance path.

## Known Limits

- Smart playlist editing currently exposes simple rule text and preserves server rules when editing existing smart playlists.
- Manual playlist creation can persist ordered server catalog links; free-form draft links are kept client-side until linked to catalog IDs.
- The browser app can review import sessions but cannot browse arbitrary local folders.
- The desktop package is macOS-focused at this stage.
- There is no streaming player, social graph, marketplace, recommendation engine or external catalog integration.

## Product Boundaries

Cratebase Web should start as a working catalog, search and relation-navigation interface. It is not a streaming player, social network, marketplace, recommendation engine, public profile system, or mobile-first app.

## License

MIT
