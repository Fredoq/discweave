# DiscWeave

Personal music archive for collectors, DJs, and deep music nerds.

DiscWeave helps maintain a local collection inventory: releases, tracks,
formats, owned copies, credits, artist relations, labels, tags, imports, search,
and portable exports. It is an archive, not a music player, social network, or
marketplace.

## Product Direction

DiscWeave v2 is a local-first open-source macOS desktop product. The target
desktop architecture is:

- Electron and React for the app shell and UI.
- A local ASP.NET Core API sidecar for domain logic, import, export, and search.
- SQLite and local artifact directories under macOS Application Support.
- No local login screen; local desktop mode provisions one owner and default
  collection.
- Apple Silicon signed and notarized DMG releases through GitHub Releases.

Hosted service, private-beta, SaaS, sync, donations, and App Store work are not
part of the active release path unless a future roadmap item explicitly scopes
them.

## Repository Layout

- `api/` - ASP.NET Core API, domain model, persistence, import, export, search,
  and tests.
- `app/` - React/Vite UI and Electron desktop shell.
- `.github/` - monorepo issue and pull request templates.
- `docs/` - future root-level product, release, and contributor documentation.

The former split repositories are historical:

- `Fredoq/discweave-api` moved under `api/`.
- `Fredoq/discweave-web` moved under `app/`.

Some imported subproject documentation still describes earlier hosted/private
beta assumptions. That language is historical until Roadmap 38 updates it.

## Local Development

API:

```sh
cd api
dotnet restore DiscWeave.slnx
dotnet build DiscWeave.slnx --configuration Release
```

App:

```sh
cd app
npm ci
npm run typecheck
npm test
npm run build
```

Desktop-local runtime, SQLite storage, backend lifecycle, unified CI, and DMG
release automation are tracked by later v2 roadmap issues.

## Roadmap

The canonical roadmap is the GitHub Project:

https://github.com/users/Fredoq/projects/2

Use the `Sequence` field as the intended implementation order. The active
release is `v2-local-first-desktop`.
