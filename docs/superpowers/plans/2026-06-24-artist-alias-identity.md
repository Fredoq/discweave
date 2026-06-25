# Artist Alias Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present `aliasOf` as artist identity metadata and enforce one real-name alias target per artist.

**Architecture:** Keep `aliasOf` as the persisted relation code and add product-specific interpretation at the API validation and Artists UI presentation boundaries. The UI derives outgoing real-name and incoming alias lists from existing `ArtistRecord.relations` data.

**Tech Stack:** ASP.NET Core minimal APIs, EF Core SQLite tests, React/Vite/Vitest.

---

### Task 1: Backend Alias Limit

**Files:**
- Modify: `api/src/DiscWeave.Api/Features/ArtistRelations/ArtistRelationsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplyWorkflow.cs`
- Test: `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.cs`
- Test: `api/tests/DiscWeave.Api.Tests/ArtistsEndpointTests.Discogs.cs`

- [ ] Add failing API tests for rejecting a second outgoing `aliasOf`.
- [ ] Add failing Discogs apply test for conflicting real name.
- [ ] Add minimal validation helper in artist relation endpoints.
- [ ] Reuse the same rule in Discogs real-name apply.
- [ ] Run targeted API tests.

### Task 2: Artist Identity UI

**Files:**
- Modify: `app/src/features/artists/ArtistDetail.tsx`
- Modify: `app/src/features/artists/ArtistsWorkspace.tsx`
- Test: `app/src/App.workspaces-artists.test.tsx`

- [ ] Add failing UI tests for `Identity`, `Real name`, `Aliases`, and hidden technical `aliasOf`.
- [ ] Add relation-type normalization helpers that accept both `aliasOf` and `Alias of`.
- [ ] Render `Identity` for `Person` artists.
- [ ] Exclude `aliasOf` from `Other relations`.
- [ ] Update master-list relationship summaries.
- [ ] Run targeted UI tests and typecheck.

### Task 3: Verification And Desktop Build

**Files:**
- Verify changed backend and frontend tests.
- Build: `app/release/mac-arm64/DiscWeave.app`

- [ ] Run backend targeted tests.
- [ ] Run frontend targeted tests.
- [ ] Run frontend typecheck.
- [ ] Publish the local API sidecar for `osx-arm64`.
- [ ] Build the Electron macOS desktop app.
- [ ] Confirm the `.app` contains the API sidecar.
