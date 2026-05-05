# Cratebase Web

React/TypeScript web UI for Cratebase.

Cratebase is a personal music archive for collectors, DJs and deep music nerds. The web app is focused on catalog browsing, search, relation navigation, manual entry, import, export and collection management.

## Project Status

This repository is at the initial setup stage. The current app contains a small catalog workspace shell that establishes the frontend stack, quality gates and project direction.

## Tech Stack

- React
- TypeScript
- Vite
- ESLint
- Prettier
- Vitest
- Testing Library

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

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Product Boundaries

Cratebase Web should start as a working catalog, search and relation-navigation interface. It is not a streaming player, social network, marketplace, recommendation engine, public profile system, or mobile-first app.

## License

MIT
