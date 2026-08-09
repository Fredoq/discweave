---
type: Architecture Decision
title: API Sidecar
description: The Electron desktop app owns a local ASP.NET Core API sidecar lifecycle.
tags: [architecture, api, electron, aspnetcore, sidecar]
timestamp: 2026-06-27T00:00:00Z
---

# API Sidecar

The DiscWeave desktop shell owns a local ASP.NET Core API sidecar lifecycle.

The API is a local companion process for the desktop app, not a public cloud
service by default.

## Constraints

- Bind local API access to loopback.
- Protect local API calls with a per-launch token.
- Avoid local login UI in baseline local mode.
- Keep sidecar lifecycle behavior aligned with the Electron app.
- The sidecar owns the authoritative external metadata workflow. MusicBrainz
  supplies explicit Recording lineage plus bounded Work, release, and
  release-group evidence for deterministic original-track inference; Discogs
  is an optional release-edition enrichment provider. Provider registries
  expose canonical identities, while collection IDs, ownership, notes, paths,
  credentials, and write authorization never enter public-provider cache keys.
- MusicBrainz discovery uses a shared request gate, cache, retry policy,
  operation timeout, and per-operation attempt budget. Partial or truncated
  lanes are surfaced as warnings and confidence caps, not hidden or promoted
  to authoritative lineage. No LLM credentials or semantic-search service is
  required.
- Discovery has two explicit read-only modes. The initial release-first mode
  follows bounded Recording and release-group routes to concrete editions and
  does not load Work performances. A user-triggered deep mode then evaluates
  the broader Recording, Work, chronology, and release context; its results
  append to, rather than replace, the initial release routes.
- Authoritative re-fetches occur during draft creation, preflight, typed rebind,
  and confirmation. Search remains read-only and cannot authorize a catalog
  mutation.

## Related Knowledge

- [Local-First Desktop Direction](../product/local-first-desktop.md)
- [SQLite Storage](sqlite-storage.md)
- [Collection Isolation](collection-isolation.md)
