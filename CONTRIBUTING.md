# Contributing to DiscWeave

DiscWeave is a local-first music archive for collectors, DJs, bloggers, researchers, and people with large private music collections. Contributions should keep the product focused on cataloging, search, relationships, ownership, imports, and exports.

## Scope guardrails

Please do not propose streaming, social feeds, marketplaces, public profiles, mobile-first rewrites, hosted SaaS assumptions, or recommendation engines unless a roadmap item explicitly scopes that work.

## Development setup

API checks:

```sh
cd api
dotnet restore DiscWeave.slnx
dotnet list DiscWeave.slnx package --vulnerable --include-transitive
dotnet build DiscWeave.slnx --configuration Release
dotnet test DiscWeave.slnx --configuration Release
```

App checks:

```sh
cd app
npm ci
npm audit --audit-level=high
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Dependency vulnerability checks are part of CI. The app audit fails on high and
critical npm advisories; NuGet packages are checked with `dotnet list package
--vulnerable --include-transitive`. Lower-severity development-tool advisories
should still be reviewed, but they are not a default CI blocker.

## Pull requests

- Use English for source, docs, tests, commits, issue metadata, and PR text.
- Keep changes small and tied to a roadmap issue or a clearly described bug.
- Add or update tests when behavior changes.
- Keep local private collection data, exports, logs, packaged builds, and secrets out of commits.
- Use Conventional Commit style for commit messages.
