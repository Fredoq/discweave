# AGENTS.md

## Repository Purpose

The `app/` directory is the shared React/TypeScript client for DiscWeave. It ships as:

- the browser web app;
- the macOS desktop app packaged with Electron.

DiscWeave is a personal music archive for collectors, DJs and deep music nerds. The web app should help users browse, search, enter, import, export and understand their private music collection.

The UI must stay focused on the archive:

- catalog browsing;
- fast search across artists, releases, tracks, credits, labels, tags and media;
- relation navigation for artists, aliases, members, remixers, producers and other credits;
- manual entry with incomplete data;
- owned item status and physical copy details;
- local import and portable export workflows.

The browser web app and desktop app must share product semantics, API contracts, forms and review surfaces wherever practical. Do not fork the UI into unrelated web and desktop experiences unless a native desktop capability genuinely requires a separate boundary.

Do not design this repository around streaming, social feeds, public profiles, marketplace flows, recommendation engines, mobile-first apps, or replacing Discogs/MusicBrainz.

## Language Policy

Everything committed to this repository must be written in English:

- source code;
- comments;
- tests;
- fixtures;
- documentation;
- UI copy;
- commit messages;
- issue and pull request templates.

## Tech Stack

- React
- TypeScript
- Vite
- Electron for the macOS desktop package
- ESLint
- Prettier
- Vitest
- Testing Library

Use npm as the package manager unless the repository is intentionally migrated.

## Runtime Boundaries

The browser web app:

- uses relative API calls in browser development;
- can review existing import sessions;
- must not expose local absolute folder browsing or arbitrary local filesystem scan controls.

The macOS desktop app:

- packages the same Vite build through Electron;
- uses `nodeIntegration: false`, `contextIsolation: true`, and a narrow preload bridge;
- may use native directory selection and Node-side filesystem/audio metadata scanning;
- sends metadata, stable file identity, paths for inventory, and cover artifacts to the backend;
- must not upload audio files to the backend.

The backend remains responsible for collection scope, import pattern parsing,
release grouping, suggestions, deduplication, persisted review sessions,
confirmation and catalog writes.

## Development Commands

```sh
npm install
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run desktop:build:mac
npm run desktop:package:mac
```

## React and TypeScript Rules

- Prefer small, focused components with explicit props.
- Keep state local until there is a real shared-state need.
- Model constrained values with TypeScript unions or enums.
- Do not use `any` unless the boundary is genuinely unknown and the reason is documented.
- Keep API DTOs separate from view models when the shapes diverge.
- Keep collection data private in client state and URLs.
- Do not pass user-controlled `collectionId` values through normal catalog routes.
- Use semantic HTML and accessible native controls before custom widgets.
- Keep forms tolerant of incomplete music metadata.
- Keep visible UI copy precise, calm and collector-oriented.

## Styling Rules

- Prefer ordinary CSS modules or scoped component styles until a stronger design-system need appears.
- Keep dense catalog and table views readable; do not turn operational screens into marketing pages.
- Avoid nested cards and decorative layout noise.
- Ensure text fits on mobile and desktop viewports.
- Use stable dimensions for navigation, tables, lists, toolbars and repeated catalog rows.

## Testing Rules

Add tests for:

- search and filtering behavior;
- relation navigation;
- manual entry forms;
- import and export UI flows;
- desktop/web import mode differences;
- Electron bridge contracts when desktop-only features are added;
- authorization and collection isolation assumptions at API boundaries;
- regressions in data-heavy catalog views.

Use Testing Library for user-observable behavior. Avoid tests that only verify implementation details.

## API Integration Rules

- Call collection-relative API routes such as `/api/artists`, `/api/releases`, `/api/tracks` and `/api/owned-items`.
- Resolve the active collection on the backend from the authenticated user's default collection.
- Do not expose `collectionId` in normal UI responses or route parameters.
- Treat `404` for inaccessible collection data as expected behavior.
- Keep browser API transport compatible with same-origin cookies.
- Keep desktop API transport behind the Electron main/preload boundary when packaged local assets would otherwise run into browser CORS or cookie restrictions.

## Open Source Hygiene

- Do not commit secrets, personal exports, real private collection data, `dist`, `coverage`, packaged desktop output, or local environment files.
- Keep README, contributing, security and license files current when project behavior changes.
- Run format, lint, typecheck, tests, web build and desktop build/package checks before handing off substantial changes that affect shared client behavior.
