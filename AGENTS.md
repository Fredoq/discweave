# AGENTS.md

## Project Purpose

DiscWeave is a personal music knowledge base and collection inventory.

Short product statement:

> Personal music archive for collectors, DJs and deep music nerds.

DiscWeave helps a collector understand what exists in their collection, which
formats and copies they own, and how artists, releases, tracks, labels, credits,
roles, aliases, versions, and media are connected.

## Core Principle

DiscWeave is a music archive, not a music player.

The product must keep answering this question:

> What do I have in my collection, and how is it connected?

Do not optimize product or architecture decisions for streaming, social
features, marketplace flows, recommendation engines, or replacing Discogs or
MusicBrainz.

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
- `.github/` - monorepo issue and pull request templates.
- root docs and release workflows - shared product, governance, CI, and release
  material.

The old `Fredoq/discweave-api` and `Fredoq/discweave-web` repositories are
historical after Roadmap 37. Active work should happen in this monorepo unless
the project owner explicitly says otherwise.

If a subproject adds its own `AGENTS.md`, that file may narrow rules for its
directory. This root file defines product invariants for all DiscWeave work.

## Active Product Direction

DiscWeave v2 is a local-first macOS desktop product.

Baseline direction:

- Electron and React app UI.
- Local ASP.NET Core API sidecar owned by the desktop app lifecycle.
- SQLite database and local artifact directories under macOS Application
  Support.
- No local login UI; local mode provisions one owner and default collection.
- Local API bound to loopback with per-launch token protection.
- Apple Silicon signed and notarized DMG releases through GitHub Releases.

Cloud service, SaaS, sync, donations, App Store distribution, mobile, and
public accounts are deferred unless a future roadmap item explicitly scopes
them.

## Roadmap and Work Intake

The canonical DiscWeave roadmap is the GitHub Project:

https://github.com/users/Fredoq/projects/2

Use this project as the source of truth for planned product work.

Baseline expectations:

- take ordinary roadmap tasks from the GitHub Project, not from a separate
  tracking issue;
- use the `Sequence` field as the intended roadmap order unless the project
  owner explicitly changes priority;
- keep `Status`, `Type`, `Area`, `Priority`, and `Release` fields current;
- leave unstarted work in `Todo`, move the card to `In Progress` when work
  starts, and move it to `Done` after the related pull request is merged or the
  issue is otherwise completed;
- if work is paused, blocked, split, or superseded, leave a short issue comment
  and update project fields if priority, scope, or release changed;
- keep issue titles, labels, bodies, comments, and project metadata in English;
- do not reopen the old v1 tracking issue unless the project owner explicitly
  asks for a tracking issue again.

## Target Audience

The initial audience is:

- people with large local music libraries;
- vinyl, CD, and cassette collectors;
- DJs;
- music bloggers, journalists, and researchers;
- users who currently maintain their collection in Excel, folders, Discogs,
  MusicBrainz, notes, or custom tables.

Do not design the product for the mass streaming audience.

## Product Scope

Core entities:

- Artist;
- Release;
- Track;
- Medium;
- Owned Item.

Core metadata includes artist, title, year or date, genre and user tags, label,
tracklist number, duration, file format, and media type.

The main product value is search and navigation through music relationships:
credits, aliases, memberships, remixes, producer roles, labels, versions,
formats, ownership statuses, and physical/digital gaps.

## Product Boundaries

Do not build streaming, cloud audio storage, a mobile app first, a social
network, a marketplace, a complex recommendation engine, Neo4j-first storage,
rights or DRM workflows, public profiles, or sharing flows.

External integrations may assist metadata entry later, but core entities must
not depend on Discogs or MusicBrainz identifiers.

## Engineering Rules

- Start with a simple, testable model; add complexity only when real scenarios
  require it.
- Do not add infrastructure "for later" unless concrete product scenarios need
  it.
- Use explicit enums or value objects for constrained domain lists.
- Do not mix reference release data with concrete user-owned copies.
- Preserve the ability to export data in a human-readable format.
- When choosing a schema, consider relationship and role queries, not only direct
  title search.
- Every import path must have a clear deduplication strategy.
- Treat all user data as important and require explicit confirmation for
  destructive operations.
- Write tests for domain logic, import, deduplication, search, export, and
  collection isolation.

## Product Tone

DiscWeave should feel like a tool for a careful collector: precise, calm, fast,
free from social noise, free from pressure to "listen now", and respectful of
incomplete, rare, and strange data.
