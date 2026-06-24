# Discogs Artist Alias Of Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applying Discogs artist detail with a real name creates or reuses the real-name person and links the current artist to it with `aliasOf`.

**Architecture:** Extend the external metadata contract with `realName`, carry it through the frontend apply payload, and add a focused Discogs artist apply workflow method next to the existing member creation workflow. Keep relation type stability in the domain dictionary defaults and protected-code logic.

**Tech Stack:** ASP.NET Core API, EF Core SQLite, React/Vite/Electron, Vitest, xUnit.

---

### Task 1: Add Real Name To Discogs Artist Metadata

**Files:**
- Modify: `api/src/DiscWeave.Application/ExternalMetadata/ExternalMetadataContracts.cs`
- Modify: `api/src/DiscWeave.Infrastructure/ExternalMetadata/Discogs/DiscogsExternalMetadataProvider.Dtos.cs`
- Modify: `api/src/DiscWeave.Infrastructure/ExternalMetadata/Discogs/DiscogsExternalMetadataProvider.Mapping.cs`
- Modify: `api/src/DiscWeave.Api/Features/ExternalMetadata/ExternalMetadataArtistResponses.cs`
- Modify: `api/src/DiscWeave.Api/Features/ExternalMetadata/ExternalMetadataArtistEndpointRouteBuilderExtensions.cs`
- Test: `api/tests/DiscWeave.Infrastructure.Tests/DiscogsArtistMappingTests.cs`

- [ ] **Step 1: Add failing mapping assertions**

Add assertions that mapped artist detail exposes `RealName == "Mark Ellis"`.

- [ ] **Step 2: Run mapping tests**

Run: `dotnet test api/tests/DiscWeave.Infrastructure.Tests/DiscWeave.Infrastructure.Tests.csproj --filter "FullyQualifiedName~DiscogsArtistMappingTests"`

- [ ] **Step 3: Add `realName` to contracts and mapping**

Read Discogs `realname`, map it to `ExternalMetadataArtistDetail.RealName`, and return it in the API artist detail response.

- [ ] **Step 4: Re-run mapping tests**

Run the same infrastructure test command and expect pass.

### Task 2: Add Protected `aliasOf` Relation Type

**Files:**
- Modify: `api/src/DiscWeave.Domain/Relations/ArtistRelationType.cs`
- Modify: `api/src/DiscWeave.Domain/Relations/ArtistRelation.cs`
- Modify: `api/src/DiscWeave.Domain/Settings/CollectionDictionaryDefaults.cs`
- Modify: `api/src/DiscWeave.Domain/Settings/CollectionDictionaryEntry.cs`
- Modify: `app/src/features/catalog/api/catalogDefaults.ts`
- Modify: `app/src/features/catalog/catalogWorkspaceShared.ts`
- Test: `api/tests/DiscWeave.Domain.Tests/Settings/CollectionDictionaryEntryTests.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Relations/RelationTests.cs`

- [ ] **Step 1: Add failing domain tests**

Assert `aliasOf` is protected and `ArtistRelationType.AliasOf` maps to `aliasOf`.

- [ ] **Step 2: Run domain tests**

Run: `dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~CollectionDictionaryEntryTests|FullyQualifiedName~RelationTests"`

- [ ] **Step 3: Implement stable type**

Replace default `alias` with builtin `aliasOf` / `Alias of`, protect it, and expose the new enum mapping.

- [ ] **Step 4: Re-run domain tests**

Run the same domain test command and expect pass.

### Task 3: Apply Real Name As Alias Relation

**Files:**
- Modify: `api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplyRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplySummaryResponse.cs`
- Modify: `api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplyWorkflow.cs`
- Modify: `api/src/DiscWeave.Api/Features/Artists/ArtistsEndpointRouteBuilderExtensions.cs`
- Test: `api/tests/DiscWeave.Api.Tests/ArtistsEndpointTests.Discogs.cs`

- [ ] **Step 1: Add failing API tests**

Add tests for creating `Flood` with `realName = "Mark Ellis"` and for reapplying without duplicates.

- [ ] **Step 2: Run focused API tests**

Run: `dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~ArtistsEndpointTests"`

- [ ] **Step 3: Implement apply workflow**

Validate `RealName`, add `ApplyRealNameAliasAsync`, call it for both create and update, and include created/reused alias counts in the summary.

- [ ] **Step 4: Re-run focused API tests**

Run the same API test command and expect pass.

### Task 4: Show And Submit Real Name In Artist UI

**Files:**
- Modify: `app/src/features/catalog/api/externalMetadataClient.ts`
- Modify: `app/src/features/artists/DiscogsArtistLookupPanel.tsx`
- Modify: `app/src/features/catalog/api/catalogDefaults.ts`
- Modify: `app/src/features/catalog/catalogWorkspaceShared.ts`
- Test: `app/src/features/catalog/externalMetadataClient.test.ts`
- Test: `app/src/App.discogs-artist-autocomplete.test.tsx`

- [ ] **Step 1: Add failing frontend tests**

Assert Discogs artist detail parsing includes `realName`, review shows `Real name`, and apply submits `realName`.

- [ ] **Step 2: Run focused frontend tests**

Run: `npm --prefix app test -- externalMetadataClient.test.ts App.discogs-artist-autocomplete.test.tsx`

- [ ] **Step 3: Implement UI and payload**

Add `realName` to the client types and apply request, and render a `Real name` row in the review panel.

- [ ] **Step 4: Re-run focused frontend tests**

Run the same frontend command and expect pass.

### Task 5: Final Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run backend tests touched by this work**

Run:
`dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~CollectionDictionaryEntryTests|FullyQualifiedName~RelationTests"`
`dotnet test api/tests/DiscWeave.Infrastructure.Tests/DiscWeave.Infrastructure.Tests.csproj --filter "FullyQualifiedName~DiscogsArtistMappingTests"`
`dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~ArtistsEndpointTests"`

- [ ] **Step 2: Run frontend checks**

Run:
`npm --prefix app test -- externalMetadataClient.test.ts App.discogs-artist-autocomplete.test.tsx App.workspaces-artists.test.tsx`
`npm --prefix app run typecheck`

- [ ] **Step 3: Commit implementation**

Commit with message `feat: apply discogs artist real name aliases`.
