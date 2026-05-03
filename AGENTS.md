# AGENTS.md

## Repository Purpose

`cratebase-web` is the React/TypeScript web UI for Cratebase.

Cratebase is a personal music archive for collectors, DJs and deep music nerds. The web app should help users browse, search, enter, import, export and understand their private music collection.

The UI must stay focused on the archive:

- catalog browsing;
- fast search across artists, releases, tracks, credits, labels, tags and media;
- relation navigation for artists, aliases, members, remixers, producers and other credits;
- manual entry with incomplete data;
- owned item status and physical copy details;
- local import and portable export workflows.

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
- ESLint
- Prettier
- Vitest
- Testing Library

Use npm as the package manager unless the repository is intentionally migrated.

## Development Commands

```sh
npm install
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
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
- authorization and collection isolation assumptions at API boundaries;
- regressions in data-heavy catalog views.

Use Testing Library for user-observable behavior. Avoid tests that only verify implementation details.

## API Integration Rules

- Call collection-relative API routes such as `/api/artists`, `/api/releases`, `/api/tracks` and `/api/owned-items`.
- Resolve the active collection on the backend from the authenticated user's default collection.
- Do not expose `collectionId` in normal UI responses or route parameters.
- Treat `404` for inaccessible collection data as expected behavior.

## Open Source Hygiene

- Do not commit secrets, personal exports, real private collection data, `dist`, `coverage`, or local environment files.
- Keep README, contributing, security and license files current when project behavior changes.
- Run format, lint, typecheck, tests and build before handing off substantial changes.
