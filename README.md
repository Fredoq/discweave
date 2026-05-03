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
