# Discogs Artist Member Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Discogs artist apply infer groups, persist external source automatically, create member artists and `memberOf` relations, and align the Artists Discogs review UI with the Releases review pattern.

**Architecture:** Keep the user interaction as a form-level apply followed by the existing `Add record` or `Save record` submit. The React form stores the selected Discogs detail until submit, and the ASP.NET Core artist create/update endpoints run one transactional workflow that updates the artist, creates or reuses member artists, and creates missing `memberOf` relations. UI review polish is gated through Superdesign before code changes.

**Tech Stack:** ASP.NET Core minimal APIs, EF Core SQLite, DiscWeave domain entities, React, TypeScript, Vite, Vitest, Testing Library, Superdesign CLI.

---

## File Structure

- Modify `api/src/DiscWeave.Api/Features/Artists/CreateArtistRequest.cs`
  - Add optional selected Discogs artist payload.
- Modify `api/src/DiscWeave.Api/Features/Artists/UpdateArtistRequest.cs`
  - Add required artist type and optional selected Discogs artist payload.
- Modify `api/src/DiscWeave.Api/Features/Artists/ArtistResponse.cs`
  - Add optional Discogs apply summary without breaking existing JSON readers.
- Create `api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplyRequest.cs`
  - Request contracts for selected Discogs artist detail.
- Create `api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplyWorkflow.cs`
  - Transactional helper that infers type, applies external source, creates or reuses members, and creates missing `memberOf` relations.
- Modify `api/src/DiscWeave.Api/Features/Artists/ArtistsEndpointRouteBuilderExtensions.cs`
  - Wire request type changes and workflow into create/update endpoints.
- Modify `api/src/DiscWeave.Domain/Settings/CollectionDictionaryEntry.cs`
  - Protect `memberOf` artist relation type dictionary entry.
- Modify `api/tests/DiscWeave.Domain.Tests/Settings/CollectionDictionaryEntryTests.cs`
  - Assert `memberOf` is protected.
- Modify `api/tests/DiscWeave.Api.Tests/ArtistsEndpointTests.cs`
  - Cover type changes and Discogs group member apply workflow.
- Modify `app/src/features/catalog/api/catalogTypes.ts` or existing external metadata DTO file location in `catalogApi.ts`
  - Add client request type for selected Discogs artist detail if no suitable type exists.
- Modify `app/src/features/catalog/api/artistLabelClient.ts`
  - Send `type` on update and selected Discogs artist payload on create/update.
- Modify `app/src/features/artists/ArtistsWorkspace.tsx`
  - Enable type select in edit mode, store selected Discogs detail, infer `Band`, and submit selected Discogs detail.
- Modify `app/src/features/artists/DiscogsArtistLookupPanel.tsx`
  - Render review inside selected candidate, remove apply group checkboxes, expose one `Apply Discogs data` action.
- Modify `app/src/features/releases/discogs-release-lookup.css`
  - Reuse and lightly extend existing Discogs review row styles only when needed.
- Modify `app/src/App.discogs-artist-autocomplete.test.tsx`
  - Update Discogs artist UI tests for no checkboxes, selected card review, and `Band` inference.
- Modify `app/src/App.workspaces-artists.test.tsx`
  - Add regression for editable type select on existing artists.

---

### Task 1: Protect `memberOf` Dictionary Type

**Files:**
- Modify: `api/src/DiscWeave.Domain/Settings/CollectionDictionaryEntry.cs`
- Modify: `api/tests/DiscWeave.Domain.Tests/Settings/CollectionDictionaryEntryTests.cs`

- [ ] **Step 1: Write the failing domain test**

Add this test to `CollectionDictionaryEntryTests`:

```csharp
[Fact(DisplayName = "Member of artist relation type is protected")]
public void Member_of_artist_relation_type_is_protected()
{
    var entry = CollectionDictionaryEntry.Create(
        CollectionDictionaryEntryId.New(),
        CollectionId.New(),
        DictionaryKind.ArtistRelationType,
        "memberOf",
        "Member of",
        20,
        isBuiltin: true);

    Assert.True(entry.IsProtected);
    Assert.Equal("dictionary_entry.protected", Assert.Throws<DomainException>(entry.Deactivate).Code);
    Assert.Equal("dictionary_entry.protected", Assert.Throws<DomainException>(entry.EnsureCanDelete).Code);
    Assert.Equal("dictionary_entry.protected", Assert.Throws<DomainException>(() => entry.Rename("Member")).Code);
    Assert.Equal("dictionary_entry.protected", Assert.Throws<DomainException>(() => entry.Reorder(25)).Code);
}
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~CollectionDictionaryEntryTests"
```

Expected: the new test fails because `memberOf` is not protected.

- [ ] **Step 3: Implement the protection rule**

In `CollectionDictionaryEntry.IsProtectedCode`, add the artist relation tuple:

```csharp
private static bool IsProtectedCode(DictionaryKind kind, string code)
{
    return (kind, code) is
        (DictionaryKind.ReleaseType, "unknown") or
        (DictionaryKind.CreditRole, "mainArtist") or
        (DictionaryKind.MediaType, "digital") or
        (DictionaryKind.MediaType, "other") or
        (DictionaryKind.ArtistRelationType, "memberOf");
}
```

- [ ] **Step 4: Run the focused passing test**

Run:

```bash
dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~CollectionDictionaryEntryTests"
```

Expected: all `CollectionDictionaryEntryTests` pass.

- [ ] **Step 5: Commit**

```bash
git add api/src/DiscWeave.Domain/Settings/CollectionDictionaryEntry.cs api/tests/DiscWeave.Domain.Tests/Settings/CollectionDictionaryEntryTests.cs
git commit -m "fix: protect memberOf relation type"
```

---

### Task 2: Add Artist Discogs Apply API Contract

**Files:**
- Create: `api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplyRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Artists/CreateArtistRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Artists/UpdateArtistRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Artists/ArtistResponse.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/ArtistsEndpointTests.cs`

- [ ] **Step 1: Add failing API contract tests**

Add two tests to `ArtistsEndpointTests`:

```csharp
[Fact(DisplayName = "Updating an artist can change artist type")]
public async Task Updating_an_artist_can_change_artist_type()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Depeche Mode"));

    using HttpResponseMessage response = await client.PutAsJsonAsync(
        $"/api/artists/{artistId}",
        new
        {
            name = "Depeche Mode",
            type = "group"
        });
    using JsonDocument document = await ReadJsonAsync(response);

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Equal(artistId.Value, document.RootElement.GetProperty("id").GetGuid());
    Assert.Equal("group", document.RootElement.GetProperty("type").GetString());
    Assert.Equal("Depeche Mode", document.RootElement.GetProperty("name").GetString());
}

[Fact(DisplayName = "Updating an artist with invalid type returns a validation error")]
public async Task Updating_an_artist_with_invalid_type_returns_a_validation_error()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Archive Artist"));

    using HttpResponseMessage response = await client.PutAsJsonAsync(
        $"/api/artists/{artistId}",
        new
        {
            name = "Archive Artist",
            type = "alias"
        });
    using JsonDocument document = await ReadJsonAsync(response);

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    Assert.Equal("artist.type_invalid", document.RootElement.GetProperty("code").GetString());
}
```

- [ ] **Step 2: Run the focused failing API tests**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~ArtistsEndpointTests"
```

Expected: the type-change test fails because `UpdateArtistRequest` does not accept or persist `type`.

- [ ] **Step 3: Add request and response contracts**

Create `DiscogsArtistApplyRequest.cs`:

```csharp
using DiscWeave.Api.Features.ExternalSources;

namespace DiscWeave.Api.Features.Artists;

public sealed record DiscogsArtistApplyRequest
{
    public required DiscogsArtistApplySourceRequest Source { get; init; }

    public required string Name { get; init; }

    public IReadOnlyList<string> Aliases { get; init; } = [];

    public IReadOnlyList<string> Members { get; init; } = [];

    public IReadOnlyList<string> NameVariations { get; init; } = [];

    public string? Profile { get; init; }
}

public sealed record DiscogsArtistApplySourceRequest(
    string ProviderName,
    string ResourceType,
    string ExternalId,
    string SourceUrl);

public sealed record DiscogsArtistApplySummaryResponse(
    int CreatedMemberArtists,
    int ReusedMemberArtists,
    int CreatedMemberRelations);
```

Modify `CreateArtistRequest.cs`:

```csharp
using DiscWeave.Api.Features.ExternalSources;

namespace DiscWeave.Api.Features.Artists;

public sealed record CreateArtistRequest(string Type, string Name)
{
    public IReadOnlyList<ExternalSourceReferenceRequest>? ExternalSources { get; init; }

    public DiscogsArtistApplyRequest? DiscogsArtist { get; init; }
}
```

Modify `UpdateArtistRequest.cs`:

```csharp
using DiscWeave.Api.Features.ExternalSources;

namespace DiscWeave.Api.Features.Artists;

public sealed record UpdateArtistRequest
{
    public required string Name { get; init; }

    public string? Type { get; init; }

    public IReadOnlyList<ExternalSourceReferenceRequest>? ExternalSources { get; init; }

    public DiscogsArtistApplyRequest? DiscogsArtist { get; init; }
}
```

Modify `ArtistResponse.cs`:

```csharp
using DiscWeave.Api.Features.ExternalSources;

namespace DiscWeave.Api.Features.Artists;

public sealed record ArtistResponse(
    Guid Id,
    string Type,
    string Name,
    IReadOnlyList<ExternalSourceReferenceResponse>? ExternalSources,
    DiscogsArtistApplySummaryResponse? DiscogsApply = null);
```

- [ ] **Step 4: Run build to expose constructor call sites**

Run:

```bash
dotnet build api/src/DiscWeave.Api/DiscWeave.Api.csproj
```

Expected: compile errors identify response call sites to update. After updating call sites, the command passes.

- [ ] **Step 5: Commit contracts**

```bash
git add api/src/DiscWeave.Api/Features/Artists/CreateArtistRequest.cs api/src/DiscWeave.Api/Features/Artists/UpdateArtistRequest.cs api/src/DiscWeave.Api/Features/Artists/ArtistResponse.cs api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplyRequest.cs api/tests/DiscWeave.Api.Tests/ArtistsEndpointTests.cs
git commit -m "feat: add Discogs artist apply contract"
```

---

### Task 3: Implement Transactional Discogs Artist Apply Workflow

**Files:**
- Create: `api/src/DiscWeave.Api/Features/Artists/DiscogsArtistApplyWorkflow.cs`
- Modify: `api/src/DiscWeave.Api/Features/Artists/ArtistsEndpointRouteBuilderExtensions.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/ArtistsEndpointTests.cs`

- [ ] **Step 1: Add failing member apply API tests**

Add this test to `ArtistsEndpointTests`:

```csharp
[Fact(DisplayName = "Creating a Discogs group creates member artists and memberOf relations")]
public async Task Creating_a_Discogs_group_creates_member_artists_and_member_relations()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    ArtistId existingMemberId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Martin L. Gore"));

    using HttpResponseMessage response = await client.PostAsJsonAsync(
        "/api/artists",
        new
        {
            name = "Depeche Mode",
            type = "person",
            discogsArtist = DiscogsGroupPayload("Depeche Mode", ["Dave Gahan", "Martin L. Gore", "Dave Gahan"])
        });
    using JsonDocument document = await ReadJsonAsync(response);

    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    Guid groupId = document.RootElement.GetProperty("id").GetGuid();
    Assert.Equal("group", document.RootElement.GetProperty("type").GetString());
    Assert.Equal(1, document.RootElement.GetProperty("discogsApply").GetProperty("createdMemberArtists").GetInt32());
    Assert.Equal(1, document.RootElement.GetProperty("discogsApply").GetProperty("reusedMemberArtists").GetInt32());
    Assert.Equal(2, document.RootElement.GetProperty("discogsApply").GetProperty("createdMemberRelations").GetInt32());

    using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Dave%20Gahan&limit=10&offset=0");
    using JsonDocument artistsDocument = await ReadJsonAsync(artistsResponse);
    Guid createdMemberId = artistsDocument.RootElement.GetProperty("items")[0].GetProperty("id").GetGuid();

    using HttpResponseMessage relationsResponse = await client.GetAsync($"/api/artist-relations?targetArtistId={groupId}&type=memberOf&limit=10&offset=0");
    using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

    Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
    Assert.Equal(2, relationsDocument.RootElement.GetProperty("total").GetInt32());
    Guid[] relationSourceIds = relationsDocument.RootElement.GetProperty("items").EnumerateArray()
        .Select(item => item.GetProperty("sourceArtistId").GetGuid())
        .ToArray();
    Assert.Contains(existingMemberId.Value, relationSourceIds);
    Assert.Contains(createdMemberId, relationSourceIds);
}
```

Add this helper near other private helpers:

```csharp
private static object DiscogsGroupPayload(string name, string[] members)
{
    return new
    {
        source = new
        {
            providerName = "discogs",
            resourceType = "artist",
            externalId = "2725",
            sourceUrl = "https://www.discogs.com/artist/2725"
        },
        name,
        profile = "English electronic music band.",
        aliases = Array.Empty<string>(),
        members,
        nameVariations = Array.Empty<string>()
    };
}
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~Creating_a_Discogs_group_creates_member_artists_and_member_relations"
```

Expected: FAIL because the workflow is not implemented.

- [ ] **Step 3: Implement workflow helper**

Create `DiscogsArtistApplyWorkflow.cs` with these public members and helper logic:

```csharp
using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Artists;

internal static class DiscogsArtistApplyWorkflow
{
    public const string MemberOfRelationType = "memberOf";

    public static bool IsDiscogsGroup(DiscogsArtistApplyRequest? request)
    {
        return request?.Members.Any(member => !string.IsNullOrWhiteSpace(member)) == true;
    }

    public static IReadOnlyList<ExternalSourceReferenceRequest> ExternalSourcesFromDiscogs(DiscogsArtistApplyRequest request)
    {
        return
        [
            new ExternalSourceReferenceRequest(
                request.Source.ProviderName,
                request.Source.ResourceType,
                request.Source.ExternalId,
                request.Source.SourceUrl)
        ];
    }

    public static async Task<DiscogsArtistApplySummaryResponse?> ApplyMembersAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Artist groupArtist,
        DiscogsArtistApplyRequest? request,
        CancellationToken cancellationToken)
    {
        if (!IsDiscogsGroup(request))
        {
            return null;
        }

        string[] memberNames = request!.Members
            .Select(member => member.Trim())
            .Where(member => member.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (memberNames.Length == 0)
        {
            return new DiscogsArtistApplySummaryResponse(0, 0, 0);
        }

        Artist[] collectionArtists = await context.Artists
            .Where(artist => artist.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        Dictionary<string, Artist> artistsByName = collectionArtists
            .GroupBy(artist => artist.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var memberIds = new List<ArtistId>();
        int createdMembers = 0;
        int reusedMembers = 0;
        foreach (string memberName in memberNames)
        {
            if (artistsByName.TryGetValue(memberName, out Artist? existing))
            {
                memberIds.Add(existing.Id);
                reusedMembers++;
                continue;
            }

            Artist member = Person.Create(collectionId, ArtistId.New(), memberName);
            _ = context.Artists.Add(member);
            artistsByName[member.Name] = member;
            memberIds.Add(member.Id);
            createdMembers++;
        }

        ArtistRelation[] existingRelations = await context.ArtistRelations
            .Where(relation =>
                relation.CollectionId == collectionId &&
                relation.TargetArtistId == groupArtist.Id &&
                relation.Type == MemberOfRelationType)
            .ToArrayAsync(cancellationToken);
        HashSet<ArtistId> existingMemberRelationSources = [.. existingRelations.Select(relation => relation.SourceArtistId)];

        int createdRelations = 0;
        foreach (ArtistId memberId in memberIds.Where(memberId => memberId != groupArtist.Id))
        {
            if (existingMemberRelationSources.Contains(memberId))
            {
                continue;
            }

            _ = context.ArtistRelations.Add(ArtistRelation.Create(
                ArtistRelationId.New(),
                collectionId,
                memberId,
                groupArtist.Id,
                MemberOfRelationType));
            existingMemberRelationSources.Add(memberId);
            createdRelations++;
        }

        return new DiscogsArtistApplySummaryResponse(createdMembers, reusedMembers, createdRelations);
    }

    public static string TypeFromRequest(string requestedType, DiscogsArtistApplyRequest? discogsArtist)
    {
        return IsDiscogsGroup(discogsArtist) ? "group" : requestedType;
    }

    public static string RequiredType(string? type)
    {
        string normalized = type?.Trim() ?? string.Empty;
        return normalized is "person" or "group"
            ? normalized
            : throw new DomainException("artist.type_invalid", "Artist type is invalid");
    }
}
```

- [ ] **Step 4: Wire create/update endpoints**

In `ArtistsEndpointRouteBuilderExtensions`:

- inject `DiscWeaveDbContext context` into create/update handlers;
- open a database transaction for create/update;
- compute `type = DiscogsArtistApplyWorkflow.TypeFromRequest(request.Type, request.DiscogsArtist)`;
- when `DiscogsArtist` is present, replace external sources with `DiscogsArtistApplyWorkflow.ExternalSourcesFromDiscogs(request.DiscogsArtist)`;
- call `ApplyMembersAsync` after the artist is added or updated;
- commit the transaction;
- return `ToResponse(artist, summary)`.

Use this response helper shape:

```csharp
private static ArtistResponse ToResponse(Artist artist, DiscogsArtistApplySummaryResponse? discogsApply = null)
{
    return artist switch
    {
        Person => new ArtistResponse(artist.Id.Value, "person", artist.Name, ExternalSourceReferenceMapper.ToResponses(artist.ExternalSources), discogsApply),
        Group => new ArtistResponse(artist.Id.Value, "group", artist.Name, ExternalSourceReferenceMapper.ToResponses(artist.ExternalSources), discogsApply),
        _ => throw new InvalidOperationException("Artist type is not supported")
    };
}
```

For type changes, update the EF discriminator shadow property and use a response overload that returns the requested type. This preserves rows referenced by alternate-key foreign keys.

```csharp
private static void UpdateArtistType(DiscWeaveDbContext context, Artist artist, string normalizedType)
{
    context.Entry(artist).Property("artist_type").CurrentValue = normalizedType;
}
```

Use this response helper for update paths:

```csharp
private static ArtistResponse ToResponse(Artist artist, string type, DiscogsArtistApplySummaryResponse? discogsApply = null)
{
    return new ArtistResponse(
        artist.Id.Value,
        type,
        artist.Name,
        ExternalSourceReferenceMapper.ToResponses(artist.ExternalSources),
        discogsApply);
}
```

- [ ] **Step 5: Run focused API tests**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~ArtistsEndpointTests"
```

Expected: all `ArtistsEndpointTests` pass.

- [ ] **Step 6: Commit backend workflow**

```bash
git add api/src/DiscWeave.Api/Features/Artists api/tests/DiscWeave.Api.Tests/ArtistsEndpointTests.cs
git commit -m "feat: apply Discogs artist members"
```

---

### Task 4: Run Superdesign For Artists Discogs Review UI

**Files:**
- Read context only: `.superdesign/design-system.md`
- Read context only: `app/src/index.css`
- Read context only: `app/src/App.css`
- Read context only: `app/src/app/AppShell.tsx`
- Read context only: `app/src/app/routes.ts`
- Read context only: `app/src/features/artists/ArtistsWorkspace.tsx`
- Read context only: `app/src/features/artists/DiscogsArtistLookupPanel.tsx`
- Read context only: `app/src/features/releases/DiscogsReleaseLookupPanel.tsx`
- Read context only: `app/src/features/releases/DiscogsCandidateReview.tsx`
- Read context only: `app/src/features/releases/discogs-release-lookup.css`
- Read context only: `app/src/features/releases/release-form.css`
- Read context only: `app/src/features/manualEntry/manual-entry.css`

- [ ] **Step 1: Verify Superdesign CLI**

Run:

```bash
superdesign --version
superdesign --help
```

Expected: version/help output with no auth error. If the command is missing, run:

```bash
npm install -g @superdesign/cli@latest
superdesign --version
superdesign --help
```

If `superdesign --help` reports an auth/login error, run:

```bash
superdesign login
```

Expected: login completes before any design command.

- [ ] **Step 2: Create Superdesign project**

Run:

```bash
superdesign create-project --title "DiscWeave Artists Discogs Apply"
```

Expected: command returns a project id. Export it before the next command:

```bash
export SUPERDESIGN_PROJECT_ID="returned-project-id"
```

- [ ] **Step 3: Create pixel-perfect current UI draft**

Run with the actual project id:

```bash
superdesign create-design-draft --project-id SUPERDESIGN_PROJECT_ID --title "Current Artists Discogs Lookup" \
  -p "Create a PIXEL-PERFECT reproduction of the current Artists page Discogs lookup and review UI. Match EXACTLY: all element sizes, colors, spacing, fonts, border-radius, shadows, sidebar, workspace header, manual artist form, Discogs candidate list, and the current review panel location below the candidate list. Use the provided source code as the single source of truth." \
  --context-file .superdesign/design-system.md \
  --context-file app/src/index.css \
  --context-file app/src/App.css \
  --context-file app/src/app/AppShell.tsx \
  --context-file app/src/app/routes.ts \
  --context-file app/src/features/artists/ArtistsWorkspace.tsx \
  --context-file app/src/features/artists/DiscogsArtistLookupPanel.tsx \
  --context-file app/src/features/releases/DiscogsReleaseLookupPanel.tsx \
  --context-file app/src/features/releases/DiscogsCandidateReview.tsx \
  --context-file app/src/features/releases/discogs-release-lookup.css \
  --context-file app/src/features/releases/release-form.css \
  --context-file app/src/features/manualEntry/manual-entry.css
```

Expected: command returns a draft id. Export it before the next command:

```bash
export SUPERDESIGN_CURRENT_DRAFT_ID="returned-draft-id"
```

- [ ] **Step 4: Create the approved UI variation**

Run:

```bash
superdesign iterate-design-draft --draft-id SUPERDESIGN_CURRENT_DRAFT_ID \
  -p "Move the Artists Discogs review into the selected candidate card, mark the selected candidate with the existing is-selected styling, remove all apply group checkboxes, show one primary button labelled Apply Discogs data, and present Core, Type, Aliases, Members, and External source as compact impact rows matching the release Discogs review density. Keep the existing DiscWeave sidebar, workspace, panel, button, form, border, radius, color, and Inter typography rules. Use ONLY the fonts, colors, spacing, and component styles defined in the design system. Do not introduce any fonts, colors, or visual styles not in the design system." \
  --mode branch \
  --context-file .superdesign/design-system.md \
  --context-file app/src/index.css \
  --context-file app/src/App.css \
  --context-file app/src/app/AppShell.tsx \
  --context-file app/src/app/routes.ts \
  --context-file app/src/features/artists/ArtistsWorkspace.tsx \
  --context-file app/src/features/artists/DiscogsArtistLookupPanel.tsx \
  --context-file app/src/features/releases/DiscogsReleaseLookupPanel.tsx \
  --context-file app/src/features/releases/DiscogsCandidateReview.tsx \
  --context-file app/src/features/releases/discogs-release-lookup.css \
  --context-file app/src/features/releases/release-form.css \
  --context-file app/src/features/manualEntry/manual-entry.css
```

Expected: command returns a branch draft id. Share the draft URL/title with the project owner and wait for approval before Task 5.

- [ ] **Step 5: Commit Superdesign artifacts if the CLI created repository files**

Run:

```bash
git status --short
```

When Superdesign writes project files under `.superdesign/`, commit the design artifacts:

```bash
git add .superdesign
git commit -m "design: draft Artists Discogs apply UI"
```

When `git status --short` shows no `.superdesign/` file changes, record the draft URL in the task notes and continue without a commit.

---

### Task 5: Update Client Contracts And Artist Submit Flow

**Files:**
- Modify: `app/src/features/catalog/api/catalogApi.ts`
- Modify: `app/src/features/catalog/api/artistLabelClient.ts`
- Modify: `app/src/features/artists/ArtistsWorkspace.tsx`
- Modify: `app/src/App.workspaces-artists.test.tsx`

- [ ] **Step 1: Write failing UI test for editable existing type**

Add this test to `App.workspaces-artists.test.tsx`:

```tsx
it('allows editing the type of an existing artist', async () => {
  window.history.pushState({}, '', '/artists?artist=new-order')
  const user = h.userEvent.setup()
  h.render(<h.App />)

  await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
  const form = h.screen.getByRole('form', { name: 'Edit artist' })
  const typeSelect = h.within(form).getByLabelText('Type')

  expect(typeSelect).toBeEnabled()
  await user.selectOptions(typeSelect, 'Person')
  await user.click(h.within(form).getByRole('button', { name: 'Save record' }))

  const updatedArtist = h
    .getInitialCatalogStateForTests()
    ?.artists.find((artist) => artist.id === 'new-order')
  expect(updatedArtist?.type).toBe('Person')
})
```

- [ ] **Step 2: Run the failing UI test**

Run:

```bash
cd app && npm test -- App.workspaces-artists.test.tsx
```

Expected: FAIL because the type select is disabled for existing artists.

- [ ] **Step 3: Add client Discogs apply type**

In `catalogApi.ts`, export a request type compatible with the backend:

```ts
export type DiscogsArtistApplyRequest = {
  source: {
    providerName: string
    resourceType: string
    externalId: string
    sourceUrl: string
  }
  name: string
  profile?: string | null
  aliases: string[]
  members: string[]
  nameVariations: string[]
}
```

Add a mapper near external metadata helpers:

```ts
export function toDiscogsArtistApplyRequest(
  detail: ExternalMetadataArtistDetailDto,
): DiscogsArtistApplyRequest {
  return {
    source: {
      providerName: detail.source.providerName,
      resourceType: detail.source.resourceType,
      externalId: detail.source.externalId,
      sourceUrl: detail.source.sourceUrl,
    },
    name: detail.draft.name || detail.name,
    profile: detail.profile,
    aliases: detail.aliases,
    members: detail.members,
    nameVariations: detail.nameVariations,
  }
}
```

- [ ] **Step 4: Send type and Discogs payload from artist client**

Change `createArtist` and `updateArtist` signatures in `artistLabelClient.ts`:

```ts
export async function createArtist(
  artist: ArtistRecord,
  discogsArtist?: DiscogsArtistApplyRequest | null,
) {
  // existing test store update remains first
  await sendJson('/api/artists', 'POST', {
    name: artist.name,
    type: toArtistTypeCode(artist.type),
    ...(artist.externalSources === undefined
      ? {}
      : { externalSources: artist.externalSources }),
    ...(discogsArtist ? { discogsArtist } : {}),
  })
}

export async function updateArtist(
  artist: ArtistRecord,
  discogsArtist?: DiscogsArtistApplyRequest | null,
) {
  // existing test store update remains first
  await sendJson(`/api/artists/${artist.id}`, 'PUT', {
    name: artist.name,
    type: toArtistTypeCode(artist.type),
    ...(artist.externalSources === undefined
      ? {}
      : { externalSources: artist.externalSources }),
    ...(discogsArtist ? { discogsArtist } : {}),
  })
}
```

Keep the existing `updateTestCatalogState` branches and add in-memory relation/member creation only if a frontend test depends on it. Server behavior is covered by API tests.

- [ ] **Step 5: Update Artists form submit callback**

In `ArtistsWorkspace.tsx`, change `ArtistEntryFormProps.onSubmit`:

```ts
onSubmit: (
  artist: ArtistRecord,
  discogsArtist?: DiscogsArtistApplyRequest | null,
) => void
```

Add state in `ArtistEntryForm`:

```ts
const [selectedDiscogsArtist, setSelectedDiscogsArtist] =
  useState<ExternalMetadataArtistDetailDto | null>(null)
```

In `handleSubmit`, pass the mapped request:

```ts
onSubmit(
  {
    id: initialArtist?.id ?? createManualRecordId('artist', artistName),
    name: artistName,
    type,
    aliases: [],
    members: [],
    relationHint: textOrFallback(relation, 'No relation hint recorded'),
    creditHint: isEditing
      ? (initialArtist?.creditHint ?? 'No credit appearances recorded')
      : 'No credit appearances recorded',
    relations: hasExplicitRelation
      ? [
          {
            type: 'Relation hint',
            target: relation,
            detail: summary,
          },
        ]
      : [],
    credits: isEditing ? (initialArtist?.credits ?? []) : [],
    tags: ['manual entry'],
    summary,
    externalSources,
  },
  selectedDiscogsArtist
    ? toDiscogsArtistApplyRequest(selectedDiscogsArtist)
    : null,
)
```

Remove the existing `disabled={Boolean(initialArtist)}` from the type `<select>`.

- [ ] **Step 6: Run UI test**

Run:

```bash
cd app && npm test -- App.workspaces-artists.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit client contract flow**

```bash
git add app/src/features/catalog/api/catalogApi.ts app/src/features/catalog/api/artistLabelClient.ts app/src/features/artists/ArtistsWorkspace.tsx app/src/App.workspaces-artists.test.tsx
git commit -m "feat: submit artist type and Discogs detail"
```

---

### Task 6: Implement Artists Discogs Review UI

**Files:**
- Modify: `app/src/features/artists/DiscogsArtistLookupPanel.tsx`
- Modify: `app/src/features/artists/ArtistsWorkspace.tsx`
- Modify: `app/src/features/releases/discogs-release-lookup.css`
- Modify: `app/src/App.discogs-artist-autocomplete.test.tsx`

- [ ] **Step 1: Write failing Discogs artist UI tests**

Update `App.discogs-artist-autocomplete.test.tsx`:

```tsx
expect(h.within(lookup).queryByLabelText('Apply External Source')).not.toBeInTheDocument()
expect(
  h.within(lookup).getByRole('button', { name: 'Apply Discogs data' }),
).toBeInTheDocument()
```

Add an assertion after reviewing the `New Order` candidate:

```tsx
const candidate = await h.within(lookup).findByRole('article', {
  name: /new order/i,
})
expect(
  h.within(candidate).getByRole('heading', { name: 'Review Discogs artist' }),
).toBeInTheDocument()
```

The implementation adds `aria-label={candidate.name}` to the candidate card, so assert against that accessible article name.

- [ ] **Step 2: Run the failing Discogs artist UI test**

Run:

```bash
cd app && npm test -- App.discogs-artist-autocomplete.test.tsx
```

Expected: FAIL because the current UI still has apply group checkboxes and renders review outside the selected candidate card.

- [ ] **Step 3: Simplify apply groups**

In `DiscogsArtistLookupPanel.tsx`, replace `DiscogsArtistApplyGroups` with:

```ts
export type DiscogsArtistApplyResult = {
  detail: ExternalMetadataArtistDetailDto
}
```

Change props:

```ts
onApplyDraft: (detail: ExternalMetadataArtistDetailDto) => void
```

Remove `applyGroups`, `emptyGroups`, `defaultGroups`, `updateApplyGroup`, `hasSelectedGroup`, and `ApplyGroup`.

- [ ] **Step 4: Render selected review inside candidate card**

Inside `candidates.map`, use the release pattern:

```tsx
<article
  aria-label={candidate.name}
  className={
    candidate.source.externalId === selectedExternalId
      ? 'discogs-candidate is-selected'
      : 'discogs-candidate'
  }
  key={candidate.source.externalId}
>
  <div className="discogs-candidate-summary">
    {/* existing candidate summary and actions */}
  </div>
  {selectedDetail?.source.externalId === candidate.source.externalId ? (
    <ArtistDiscogsCandidateReview
      current={current}
      detail={selectedDetail}
      onApplyDraft={handleApplyDraft}
    />
  ) : null}
</article>
```

Add:

```ts
const selectedExternalId = selectedDetail?.source.externalId ?? ''
```

- [ ] **Step 5: Add artist review component in the same file**

Add a local component:

```tsx
function ArtistDiscogsCandidateReview({
  current,
  detail,
  onApplyDraft,
}: {
  current: DiscogsCurrentArtist
  detail: ExternalMetadataArtistDetailDto
  onApplyDraft: (detail: ExternalMetadataArtistDetailDto) => void
}) {
  return (
    <div className="discogs-review-panel">
      <div className="release-form-section-header">
        <div>
          <h3>Review Discogs artist</h3>
          <p>
            {detail.source.attribution}{' '}
            <a className="detail-link" href={detail.source.sourceUrl} target="_blank" rel="noreferrer">
              Open Discogs artist source
            </a>
          </p>
        </div>
      </div>
      <div className="discogs-impact-list">
        <ReadOnlyImpactRow group="Core" currentValue={current.name || 'Not recorded'} nextValue={detail.draft.name || detail.name || 'Not recorded'} />
        <ReadOnlyImpactRow group="Type" currentValue={current.type || 'Not recorded'} nextValue={artistTypeFromDiscogs(detail)} />
        <ReadOnlyImpactRow group="Aliases" currentValue="Local aliases unchanged" nextValue={summaryList(detail.aliases)} />
        <ReadOnlyImpactRow group="Members" currentValue="Local member relations unchanged" nextValue={memberSummary(detail.members)} />
        <ReadOnlyImpactRow group="External source" currentValue={`${current.externalSourceCount} sources`} nextValue="Discogs source will be applied" />
      </div>
      <button className="button button-primary button-compact" type="button" onClick={() => onApplyDraft(detail)}>
        Apply Discogs data
      </button>
    </div>
  )
}
```

Add helpers:

```ts
function artistTypeFromDiscogs(detail: ExternalMetadataArtistDetailDto): ArtistType {
  return detail.members.some((member) => member.trim().length > 0)
    ? 'Band'
    : 'Person'
}

function summaryList(values: string[]) {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean)
  return cleanValues.length > 0 ? cleanValues.join(', ') : 'Not recorded'
}

function memberSummary(values: string[]) {
  const cleanValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
  if (cleanValues.length === 0) {
    return 'No Discogs members'
  }

  return `${cleanValues.length} member${cleanValues.length === 1 ? '' : 's'}: ${cleanValues.join(', ')}`
}
```

Add read-only row:

```tsx
function ReadOnlyImpactRow({
  currentValue,
  group,
  nextValue,
}: {
  currentValue: string
  group: string
  nextValue: string
}) {
  return (
    <div className="discogs-impact-row discogs-impact-row-readonly">
      <div className="discogs-impact-group">{group}</div>
      <div className="discogs-impact-value">
        <span>Current</span>
        <strong>{currentValue}</strong>
      </div>
      <div className="discogs-impact-value">
        <span>Discogs</span>
        <strong>{nextValue}</strong>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Apply inferred type and store selected detail**

In `ArtistsWorkspace.tsx` `handleApplyDiscogsDraft`, set all fields without groups:

```ts
function handleApplyDiscogsDraft(detail: ExternalMetadataArtistDetailDto) {
  setName(detail.draft.name)
  setType(detail.members.some((member) => member.trim().length > 0) ? 'Band' : 'Person')
  setExternalSources(
    detail.draft.externalSources.map((source) => ({
      ...source,
      appliedAt: new Date().toISOString(),
    })),
  )
  setSelectedDiscogsArtist(detail)
}
```

- [ ] **Step 7: Add CSS for read-only impact rows**

In `discogs-release-lookup.css`:

```css
.discogs-impact-row-readonly {
  grid-template-columns: minmax(84px, 110px) minmax(0, 1fr) minmax(0, 1.6fr);
}
```

In the mobile media query that already targets `.discogs-impact-row`, add `.discogs-impact-row-readonly` to the selector list so read-only rows collapse to one column with the same spacing.

- [ ] **Step 8: Run UI tests**

Run:

```bash
cd app && npm test -- App.discogs-artist-autocomplete.test.tsx App.workspaces-artists.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit UI changes**

```bash
git add app/src/features/artists/DiscogsArtistLookupPanel.tsx app/src/features/artists/ArtistsWorkspace.tsx app/src/features/releases/discogs-release-lookup.css app/src/App.discogs-artist-autocomplete.test.tsx app/src/App.workspaces-artists.test.tsx
git commit -m "feat: align artist Discogs review UI"
```

---

### Task 7: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run backend test suites touched by this work**

Run:

```bash
dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~CollectionDictionaryEntryTests"
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~ArtistsEndpointTests"
```

Expected: both commands pass.

- [ ] **Step 2: Run frontend targeted tests**

Run:

```bash
cd app && npm test -- App.discogs-artist-autocomplete.test.tsx App.workspaces-artists.test.tsx
```

Expected: targeted Vitest suites pass.

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd app && npm run typecheck
```

Expected: TypeScript passes with no errors.

- [ ] **Step 4: Run formatting/lint checks if targeted tests passed**

Run:

```bash
cd app && npm run lint
dotnet format api/src/DiscWeave.Api/DiscWeave.Api.csproj --verify-no-changes
```

- [ ] **Step 5: Inspect git diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only intended files are modified after the final task commits, or the working tree is clean if every task was committed.

- [ ] **Step 6: Final commit for verification-only fixes**

If verification required fixes, stage the exact files changed by those fixes. For this planned work, the expected file set is:

```bash
git add api/src/DiscWeave.Api/Features/Artists api/src/DiscWeave.Domain/Settings/CollectionDictionaryEntry.cs api/tests/DiscWeave.Api.Tests/ArtistsEndpointTests.cs api/tests/DiscWeave.Domain.Tests/Settings/CollectionDictionaryEntryTests.cs app/src/features/catalog/api/catalogApi.ts app/src/features/catalog/api/artistLabelClient.ts app/src/features/artists/ArtistsWorkspace.tsx app/src/features/artists/DiscogsArtistLookupPanel.tsx app/src/features/releases/discogs-release-lookup.css app/src/App.discogs-artist-autocomplete.test.tsx app/src/App.workspaces-artists.test.tsx
git commit -m "fix: stabilize Discogs artist member apply"
```

When verification requires no fixes, do not create an empty commit.
