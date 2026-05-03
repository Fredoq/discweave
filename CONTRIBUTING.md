# Contributing

Cratebase Web is the React/TypeScript frontend for Cratebase.

## Development Setup

Use Node.js 22.13.0 or newer, excluding unsupported odd-numbered Node.js majors, and npm 10 or newer.

```sh
npm install
npm run dev
```

Before opening a pull request, run:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Project Direction

- Keep the UI focused on catalog browsing, search, relation navigation, manual entry, import, export, and collection management.
- Do not add streaming, social networking, marketplace, recommendation, or public-profile workflows.
- Keep repository artifacts in English.
- Treat collection privacy as a product invariant.

## Pull Requests

- Keep changes focused and explain the user-facing behavior.
- Add tests for filtering, routing, forms, API integration, collection isolation assumptions, and regression-prone UI behavior.
- Prefer accessible native controls before custom widgets.
- Do not commit generated build output from `dist`.
