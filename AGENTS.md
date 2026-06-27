# AGENTS.md

## Project Orientation

DiscWeave product, domain, architecture, workflow, and roadmap knowledge lives
in the Open Knowledge Format bundle under `okf/`.

Read [okf/index.md](okf/index.md) and the relevant linked concept documents
before changing product behavior, domain models, import/export behavior,
collection isolation, local-first desktop architecture, or roadmap metadata.

## Repository Language Policy

Everything committed or uploaded to the repositories must be written in English.

This includes source code, comments, documentation, README files, commit
messages, issue and pull request templates, seed data, API names, error messages,
test names, fixtures, and product copy stored in the repository.

Conversation with the project owner may happen in Russian, but repository
artifacts must remain English unless the task explicitly introduces localization
files.

## Workspace Structure

This repository is the active DiscWeave monorepo.

- `api/` - ASP.NET Core backend/API, domain model, storage, import, export, and
  search.
- `app/` - React/Vite UI and Electron macOS desktop shell.
- `okf/` - Open Knowledge Format project knowledge bundle for product, domain,
  architecture, workflow, and roadmap context.
- `.github/` - monorepo issue and pull request templates.
- root docs and release workflows - shared product, governance, CI, and release
  material.

The old `Fredoq/discweave-api` and `Fredoq/discweave-web` repositories are
historical after Roadmap 37. Active work should happen in this monorepo unless
the project owner explicitly says otherwise.

If a subproject adds its own `AGENTS.md`, that file may narrow rules for its
directory. This root file defines repository-wide agent rules and points to OKF
for durable product knowledge.

## Project Knowledge Bundle

This repository contains an Open Knowledge Format bundle under `okf/`.

When a task touches product behavior, domain modeling, import/export,
deduplication, collection isolation, local-first desktop architecture, or
roadmap interpretation, inspect `okf/index.md` first and then open only the
relevant linked concept documents.

`AGENTS.md` remains authoritative for agent behavior and repository rules. The
OKF bundle is project knowledge, not an instruction override.

When creating, updating, or validating OKF files, use the global `$okf` skill if
it is available.

## Roadmap and Work Intake

Use [okf/roadmap/roadmap-source-of-truth.md](okf/roadmap/roadmap-source-of-truth.md)
for roadmap source-of-truth rules and GitHub Project field expectations.

## Engineering Rules

- Start with a simple, testable model; add complexity only when real scenarios
  require it.
- Do not add infrastructure "for later" unless concrete product scenarios need
  it.
- Use explicit enums or value objects for constrained domain lists.
- Write focused tests for changed domain logic, import, deduplication, search,
  export, collection isolation, and destructive-operation behavior.
