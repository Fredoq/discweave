# Track Stack Search Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user add one selected standalone Track to an existing stack through a searchable, keyboard-accessible two-step dialog without changing the Tracks list position, filters, pagination, or expansion state.

**Architecture:** Keep stacks as a read projection over Track metadata and configured directed Track relations. Add a collection-scoped paginated stack-target endpoint, centralize stack graph traversal and write validation on the API, expose a cancellable typed client, and let `TracksWorkspace` orchestrate one shared identifier-based mutation while the picker and drag-and-drop retain different post-success effects.

**Tech Stack:** .NET 10, C# 14, ASP.NET Core minimal APIs, EF Core/SQLite, xUnit, React 19, TypeScript 6, Vite, Vitest, Testing Library, native HTML dialog/radio semantics, existing DiscWeave CSS tokens.

## Global Constraints

- Follow [the approved design specification](../specs/2026-07-16-track-stack-search-assignment-design.md) exactly; this plan does not reopen product choices.
- Keep every committed source file, test name, comment, error, and product string in English.
- Do not add a persisted `TrackStack` entity, schema change, migration, cache, background worker, or new infrastructure dependency.
- Never accept or expose a client-supplied `collectionId`; resolve and filter the active collection through `ICurrentCollection` on every server path.
- Keep API source and test files at or below the repository's 300-line architecture limit. Keep frontend `.ts`, `.tsx`, and `.css` files at or below 600 lines.
- Use one top-level C# type per new `.cs` file.
- Test behavior first in each task, observe the expected failure, add the smallest implementation, then rerun the focused tests before committing.
- Preserve the existing `POST /api/track-relations/stack` wire fields. The client-side command uses `targetRootTrackId` and maps it to the existing `targetTrackId` JSON field.
- Preserve drag-and-drop target expansion and row highlight. Picker success must not expand, collapse, scroll, navigate, filter, or page the underlying list.
- Treat an identical existing relation as idempotent success. Do not create a second relation row.
- Use existing CSS variables and button treatments. The approved SuperDesign drafts define hierarchy and density, not production utility classes.

---

## File Structure

### API production

- Create `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackGraph.cs`: shared in-memory graph behavior for stack projection and command validation; this is an application model, not a persisted entity.
- Create `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackProjection.cs`: projected root, members, and cycle paths.
- Create `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackMemberProjection.cs`: one transitive deduplicated member.
- Create `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackRelationValidationFailure.cs`: explicit application-level workflow-validation enum.
- Create `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackRelationValidator.cs`: authoritative new-relation workflow rules shared independently of HTTP.
- Modify `api/src/DiscWeave.Application/DependencyInjection.cs`: register the stateless validator.
- Modify `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.Stacks.cs`: map the existing `/stacks` response from `TrackStackGraph` so old and new projections share traversal semantics.
- Modify `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.cs`: register `GET /api/tracks/stack-targets` before the `/{trackId:guid}` route.
- Create `api/src/DiscWeave.Api/Features/Tracks/TrackStackTargetListRequest.cs`: query binding contract.
- Create `api/src/DiscWeave.Api/Features/Tracks/TrackStackTargetResponse.cs`: one destination-root response.
- Create `api/src/DiscWeave.Api/Features/Tracks/TrackStackTargetMatchedMemberResponse.cs`: optional member-context explanation.
- Create `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.StackTargets.cs`: request validation, source eligibility, matching, ranking, and pagination.
- Create `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.StackTargetArtists.cs`: artist-display loading without digital-file mapping.
- Modify `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.cs`: retain route registration and remove the moved stack method.
- Create `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.Stacks.cs`: transactional stack-relation command flow.
- Create `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.StackValidation.cs`: typed invariant checks for a new stack relation.
- Create `api/src/DiscWeave.Api/Features/TrackRelations/StackTrackRelationRequest.cs`: the existing four-field wire request in its own file.
- Modify `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.Management.cs`: remove the moved request record while retaining identity lookup helpers.

### API tests

- Create `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.cs`: search matching and response behavior.
- Create `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Validation.cs`: query validation, inaccessible-source equivalence, and source eligibility.
- Create `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Paging.cs`: deterministic ordering, stable pages, and collection-isolated results.
- Create `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Helpers.cs`: explicit HTTP setup helpers shared by the partial test class.
- Create `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Helpers.cs`: shared stack-command test helpers.
- Create `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Source.cs`: source, self, and cycle coverage.
- Create `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Target.cs`: target, promotion, and rollback coverage.
- Create `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Idempotency.cs`: retry and settings-change idempotency coverage.
- Modify `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStacks.cs`: only update assertions whose error precedence is intentionally strengthened; retain all existing success cases.

### Frontend production

- Modify `app/src/features/catalog/api/catalogDtoTypes.ts`: add stack-target response DTOs.
- Modify `app/src/features/catalog/api/httpClient.ts`: add cancellable list requests and opt out of legacy `404 -> empty list` conversion.
- Create `app/src/features/catalog/api/trackStackTargetsClient.ts`: build and send the stack-target query.
- Modify `app/src/features/catalog/api/ownedRelationsClient.ts`: replace the view-object mutation shape with `StackRelationCommand` and map it to the existing wire body.
- Modify `app/src/features/tracks/trackStackModel.ts`: export row types, centralize source eligibility, remove empty-settings fallbacks, and build identifier commands.
- Create `app/src/features/tracks/TrackStackFacts.tsx`: extract static root facts so `TrackStacksPanel.tsx` retains file-size headroom.
- Create `app/src/features/tracks/TrackStackPickerDialog.tsx`: semantic two-step modal presentation and public boundary.
- Create `app/src/features/tracks/useTrackStackPickerDialog.ts`: own picker query generations, paging, recovery, focus, and submission state.
- Create `app/src/features/tracks/track-stack-picker.css`: picker-only layout, states, focus, and responsive styles.
- Modify `app/src/features/tracks/tracks.css`: import the picker stylesheet.
- Modify `app/src/features/tracks/TrackDetailSections.tsx`: render the contextual entry button.
- Modify `app/src/features/tracks/TrackDetail.tsx`: pass presentation-only action props.
- Modify `app/src/features/tracks/TracksWorkspacePanels.tsx`: bridge action props to the detail component.
- Create `app/src/features/tracks/useTrackStackRelationTypeState.ts`: resolve server/local stack settings without optimistic defaults.
- Create `app/src/features/tracks/useTrackStackAssignment.ts`: own picker state, shared non-navigating persistence, source eligibility, refresh, and live announcement.
- Modify `app/src/features/tracks/TracksWorkspace.tsx`: connect the focused assignment hook to the detail, picker, and existing DnD adapter.
- Modify `app/src/features/tracks/TrackStacksPanel.tsx`: send the shared identifier command while retaining DnD-local chooser, error, and highlight behavior.
- Modify `app/src/features/tracks/TrackStackMemberGroups.tsx`: consume shared stack row/member types from the model rather than the panel.

### Frontend tests

- Create `app/src/features/catalog/api/trackStackTargetsClient.test.ts`: URL, signal, and typed `404` behavior.
- Create `app/src/features/tracks/trackStackModel.test.ts`: shared eligibility, relation options, and command mapping.
- Create `app/src/features/tracks/TrackStackPickerDialog.search.test.tsx`: threshold, debounce, stale responses, result rendering, and pagination.
- Create `app/src/features/tracks/TrackStackPickerDialog.testUtils.tsx`: shared picker fixtures, deferred promises, and render harness.
- Create `app/src/features/tracks/TrackStackPickerDialog.submit.test.tsx`: step transitions, explicit relation type, submission, and error recovery.
- Create `app/src/features/tracks/TrackStackPickerDialog.accessibility.test.tsx`: focus, Escape, radio keyboard semantics, and pending close lock.
- Modify `app/src/features/tracks/TrackDetailSections.test.tsx`: entry-button rendering and callback/ref behavior.
- Create `app/src/features/tracks/useTrackStackRelationTypeState.test.tsx`: local defaults, server loading, real empty settings, and failure behavior.
- Create `app/src/App.track-stack-picker.test.tsx`: end-to-end workspace orchestration with mocked HTTP.
- Modify `app/src/App.track-stacks.drop.test.tsx`: assert DnD still promotes standalone targets, expands/highlights destinations, and uses the shared command path.
- Modify `app/src/App.track-stacks.test.tsx`: retain server-projection and configured-type regressions.

---

### Task 1: Centralize the Stack Graph and Add Basic Target Search

**Files:**

- Create: `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackGraph.cs`
- Create: `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackProjection.cs`
- Create: `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackMemberProjection.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.Stacks.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.cs`
- Create: `api/src/DiscWeave.Api/Features/Tracks/TrackStackTargetListRequest.cs`
- Create: `api/src/DiscWeave.Api/Features/Tracks/TrackStackTargetResponse.cs`
- Create: `api/src/DiscWeave.Api/Features/Tracks/TrackStackTargetMatchedMemberResponse.cs`
- Create: `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.StackTargets.cs`
- Create: `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.StackTargetArtists.cs`
- Create: `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.cs`
- Create: `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Helpers.cs`

**Interfaces:**

- Consumes:
  - `DiscWeave.Domain.Catalog.Track`, `DiscWeave.Domain.Relations.TrackRelation`, `TrackId`, and `CollectionId`.
  - `TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(DiscWeaveDbContext, CollectionId, CancellationToken): Task<IReadOnlyList<string>>` and the existing Track credit/release/artist loaders.
  - `ICurrentCollection.CollectionId: CollectionId` and `ListResponse<T>`.
- Produces:
  - `TrackStackGraph(IReadOnlyCollection<Track> tracks, IReadOnlyCollection<TrackRelation> stackRelations)` in `DiscWeave.Application.Catalog.TrackStacks`.
  - `bool IsStandalone(TrackId trackId)`, `bool HasMembers(TrackId trackId)`, `bool IsMember(TrackId trackId)`, `bool WouldCreateCycle(TrackId sourceTrackId, TrackId targetTrackId)`, and `TrackStackProjection Project(Track original)`.
  - `TrackStackProjection` and `TrackStackMemberProjection` in the same Application namespace; none references ASP.NET Core, EF Core, Infrastructure, `IResult`, or `EndpointErrors`.
  - Unchanged `GET /api/tracks/stacks` semantics and `GET /api/tracks/stack-targets` returning `ListResponse<TrackStackTargetResponse>`.
  - `LoadTrackArtistDisplaysAsync(IReadOnlyCollection<TrackId>, DiscWeaveDbContext, CollectionId, CancellationToken): Task<IReadOnlyDictionary<TrackId, string>>`.

- [ ] **Step 1: Add failing search behavior tests**

Create `TrackStackTargetEndpointTests.cs` with these complete tests (the helper methods used here are defined immediately below in the companion partial file):

```csharp
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackStackTargetEndpointTests
{
    [Fact(DisplayName = "Stack target search matches root and member titles and artists")]
    public async Task Stack_target_search_matches_root_and_member_titles_and_artists()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming Dub");
        Guid rootId = await CreateTrackAsync(client, "Phat Bass");
        Guid memberId = await CreateTrackAsync(client, "Aquagen More Bass Mix");
        Guid otherRootId = await CreateTrackAsync(client, "Energy Flash");
        Guid otherMemberId = await CreateTrackAsync(client, "Energy Flash Edit");
        await MarkOriginalAsync(client, rootId, "Phat Bass", 2000);
        await MarkOriginalAsync(client, otherRootId, "Energy Flash", null);
        await AddMainArtistAsync(client, rootId, "Warp Brothers");
        await AddMainArtistAsync(client, memberId, "Aquagen");
        await AddMainArtistAsync(client, otherRootId, "Joey Beltram");
        await AddMainArtistAsync(client, otherMemberId, "Joey Beltram");
        await CreateRelationAsync(client, memberId, rootId, "remixOf");
        await CreateRelationAsync(client, otherMemberId, otherRootId, "versionOf");

        using JsonDocument rootTitle = await GetTargetsAsync(client, sourceId, "Phat");
        using JsonDocument rootArtist = await GetTargetsAsync(client, sourceId, "Warp");
        using JsonDocument memberTitle = await GetTargetsAsync(client, sourceId, "More Bass");
        using JsonDocument memberArtist = await GetTargetsAsync(client, sourceId, "Aquagen");

        foreach (JsonDocument rootMatch in new[] { rootTitle, rootArtist })
        {
            JsonElement item = Assert.Single(Items(rootMatch));
            Assert.Equal(rootId, item.GetProperty("rootTrackId").GetGuid());
            Assert.Equal("Phat Bass", item.GetProperty("title").GetString());
            Assert.Equal("Warp Brothers", item.GetProperty("artistDisplay").GetString());
            Assert.Equal(2000, item.GetProperty("versionYear").GetInt32());
            Assert.Equal(1, item.GetProperty("memberCount").GetInt32());
            Assert.Equal(JsonValueKind.Null, item.GetProperty("matchedMember").ValueKind);
        }

        foreach (JsonDocument memberMatch in new[] { memberTitle, memberArtist })
        {
            JsonElement item = Assert.Single(Items(memberMatch));
            JsonElement matchedMember = item.GetProperty("matchedMember");
            Assert.Equal(rootId, item.GetProperty("rootTrackId").GetGuid());
            Assert.Equal(memberId, matchedMember.GetProperty("trackId").GetGuid());
            Assert.Equal("Aquagen More Bass Mix", matchedMember.GetProperty("title").GetString());
            Assert.Equal("Aquagen", matchedMember.GetProperty("artistDisplay").GetString());
        }
    }

    [Fact(DisplayName = "Stack target search returns one root and a deterministic matching member")]
    public async Task Stack_target_search_returns_one_root_and_a_deterministic_matching_member()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming Version");
        Guid rootId = await CreateTrackAsync(client, "Destination Root");
        Guid firstMemberId = await CreateTrackAsync(client, "Matched Dub");
        Guid secondMemberId = await CreateTrackAsync(client, "Matched Dub");
        await MarkOriginalAsync(client, rootId, "Destination Root", null);
        await CreateRelationAsync(client, secondMemberId, rootId, "versionOf");
        await CreateRelationAsync(client, firstMemberId, rootId, "remixOf");

        using JsonDocument document = await GetTargetsAsync(client, sourceId, "matched");

        JsonElement item = Assert.Single(Items(document));
        Guid expectedMemberId = firstMemberId.CompareTo(secondMemberId) <= 0
            ? firstMemberId
            : secondMemberId;
        Assert.Equal(rootId, item.GetProperty("rootTrackId").GetGuid());
        Assert.Equal(2, item.GetProperty("memberCount").GetInt32());
        Assert.Equal(
            expectedMemberId,
            item.GetProperty("matchedMember").GetProperty("trackId").GetGuid());
    }

    [Fact(DisplayName = "Stack target search excludes standalone tracks and empty original roots")]
    public async Task Stack_target_search_excludes_standalone_tracks_and_empty_original_roots()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming Track");
        _ = await CreateTrackAsync(client, "Bass Standalone");
        Guid emptyRootId = await CreateTrackAsync(client, "Bass Empty Root");
        Guid realRootId = await CreateTrackAsync(client, "Bass Real Root");
        Guid memberId = await CreateTrackAsync(client, "Member");
        await MarkOriginalAsync(client, emptyRootId, "Bass Empty Root", null);
        await MarkOriginalAsync(client, realRootId, "Bass Real Root", null);
        await CreateRelationAsync(client, memberId, realRootId, "versionOf");

        using JsonDocument document = await GetTargetsAsync(client, sourceId, "Bass");

        JsonElement item = Assert.Single(Items(document));
        Assert.Equal(realRootId, item.GetProperty("rootTrackId").GetGuid());
    }
}
```

Create `TrackStackTargetEndpointTests.Helpers.cs` with the complete shared setup:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackStackTargetEndpointTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public TrackStackTargetEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    private static IEnumerable<JsonElement> Items(JsonDocument document) =>
        document.RootElement.GetProperty("items").EnumerateArray();

    private static async Task<JsonDocument> GetTargetsAsync(
        HttpClient client,
        Guid sourceTrackId,
        string search,
        int? offset = null,
        int? limit = null)
    {
        string query = $"sourceTrackId={sourceTrackId:D}&search={Uri.EscapeDataString(search)}";
        query += offset.HasValue ? $"&offset={offset.Value}" : string.Empty;
        query += limit.HasValue ? $"&limit={limit.Value}" : string.Empty;
        using HttpResponseMessage response = await client.GetAsync($"/api/tracks/stack-targets?{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    private static async Task<Guid> CreateTrackAsync(HttpClient client, string title)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title, genres = Array.Empty<string>(), tags = Array.Empty<string>() });
        using JsonDocument document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task MarkOriginalAsync(
        HttpClient client,
        Guid trackId,
        string title,
        int? versionYear)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/tracks/{trackId:D}",
            new
            {
                title,
                versionYear,
                isOriginal = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                credits = Array.Empty<object>(),
                releaseAppearances = Array.Empty<object>()
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task AddMainArtistAsync(
        HttpClient client,
        Guid trackId,
        string artistName)
    {
        using HttpResponseMessage artistResponse = await client.PostAsJsonAsync(
            "/api/artists",
            new { type = "person", name = artistName });
        using JsonDocument artistDocument = JsonDocument.Parse(
            await artistResponse.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Created, artistResponse.StatusCode);
        Guid artistId = artistDocument.RootElement.GetProperty("id").GetGuid();
        using HttpResponseMessage creditResponse = await client.PostAsJsonAsync(
            "/api/credits",
            new
            {
                contributorArtistId = artistId,
                targetType = "track",
                targetId = trackId,
                roles = new[] { "mainArtist" }
            });
        Assert.Equal(HttpStatusCode.Created, creditResponse.StatusCode);
    }

    private static async Task CreateRelationAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid targetTrackId,
        string type)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId, targetTrackId, type });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
```

- [ ] **Step 2: Run the new tests and confirm the missing route failure**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DiscWeave.Api.Tests.TrackStackTargetEndpointTests"
```

Expected: FAIL because `/api/tracks/stack-targets` does not exist or returns a payload without `items`.

- [ ] **Step 3: Add the shared projection types and graph**

Use these contracts in separate files:

```csharp
using DiscWeave.Domain.Catalog;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackMemberProjection
{
    public TrackStackMemberProjection(
        Track track,
        string relationType,
        int depth,
        bool isDirect)
    {
        Track = track;
        RelationType = relationType;
        Depth = depth;
        IsDirect = isDirect;
    }

    public Track Track { get; }
    public string RelationType { get; }
    public int Depth { get; }
    public bool IsDirect { get; }
}
```

```csharp
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackProjection
{
    public TrackStackProjection(
        Track original,
        IReadOnlyList<TrackStackMemberProjection> members,
        IReadOnlyList<IReadOnlyList<TrackId>> cyclePaths)
    {
        Original = original;
        Members = members;
        CyclePaths = cyclePaths;
    }

    public Track Original { get; }
    public IReadOnlyList<TrackStackMemberProjection> Members { get; }
    public IReadOnlyList<IReadOnlyList<TrackId>> CyclePaths { get; }
}
```

Implement `TrackStackGraph` as an application-layer projection helper, not a persisted entity:

```csharp
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackGraph
{
    private readonly IReadOnlyDictionary<TrackId, Track> _tracksById;
    private readonly ILookup<TrackId, TrackRelation> _incoming;
    private readonly ILookup<TrackId, TrackRelation> _outgoing;

    public TrackStackGraph(
        IReadOnlyCollection<Track> tracks,
        IReadOnlyCollection<TrackRelation> stackRelations)
    {
        _tracksById = tracks.ToDictionary(track => track.Id);
        TrackRelation[] orderedRelations =
        [
            .. stackRelations
                .OrderBy(relation => relation.RelationType, StringComparer.Ordinal)
                .ThenBy(relation => relation.SourceTrackId.Value)
                .ThenBy(relation => relation.TargetTrackId.Value)
        ];
        _incoming = orderedRelations.ToLookup(relation => relation.TargetTrackId);
        _outgoing = orderedRelations.ToLookup(relation => relation.SourceTrackId);
    }

    public bool IsStandalone(TrackId trackId) =>
        _tracksById.ContainsKey(trackId) &&
        !_incoming[trackId].Any() &&
        !_outgoing[trackId].Any();

    public bool HasMembers(TrackId trackId) => _incoming[trackId].Any();

    public bool IsMember(TrackId trackId) => _outgoing[trackId].Any();

    public bool WouldCreateCycle(TrackId sourceTrackId, TrackId targetTrackId) =>
        HasPath(targetTrackId, sourceTrackId);

    public TrackStackProjection Project(Track original)
    {
        List<TrackStackMemberProjection> members = [];
        List<IReadOnlyList<TrackId>> cyclePaths = [];
        HashSet<TrackId> visitedMembers = [];
        HashSet<string> cycleKeys = [];
        Queue<TraversalNode> queue = [];
        queue.Enqueue(new TraversalNode(original.Id, 0, [original.Id]));

        while (queue.TryDequeue(out TraversalNode node))
        {
            foreach (TrackRelation relation in _incoming[node.TrackId])
            {
                TrackId sourceTrackId = relation.SourceTrackId;
                if (sourceTrackId == original.Id || node.Path.Contains(sourceTrackId))
                {
                    IReadOnlyList<TrackId> path = [.. node.Path, sourceTrackId];
                    string key = string.Join(">", path.Select(id => id.Value));
                    if (cycleKeys.Add(key))
                    {
                        cyclePaths.Add(path);
                    }

                    continue;
                }

                if (!_tracksById.TryGetValue(sourceTrackId, out Track? sourceTrack) ||
                    !visitedMembers.Add(sourceTrackId))
                {
                    continue;
                }

                members.Add(new TrackStackMemberProjection(
                    sourceTrack,
                    relation.RelationType,
                    node.Depth + 1,
                    node.TrackId == original.Id));
                queue.Enqueue(new TraversalNode(
                    sourceTrackId,
                    node.Depth + 1,
                    [.. node.Path, sourceTrackId]));
            }
        }

        return new TrackStackProjection(
            original,
            [
                .. members
                    .OrderBy(member => member.Depth)
                    .ThenBy(member => member.Track.Title, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(member => member.Track.Id.Value)
            ],
            cyclePaths);
    }

    private bool HasPath(TrackId startTrackId, TrackId targetTrackId)
    {
        HashSet<TrackId> visited = [];
        Queue<TrackId> queue = [];
        queue.Enqueue(startTrackId);

        while (queue.TryDequeue(out TrackId trackId))
        {
            if (trackId == targetTrackId)
            {
                return true;
            }

            if (!visited.Add(trackId))
            {
                continue;
            }

            foreach (TrackRelation relation in _outgoing[trackId])
            {
                queue.Enqueue(relation.TargetTrackId);
            }
        }

        return false;
    }

    private readonly struct TraversalNode
    {
        public TraversalNode(
            TrackId trackId,
            int depth,
            IReadOnlyList<TrackId> path)
        {
            TrackId = trackId;
            Depth = depth;
            Path = path;
        }

        public TrackId TrackId { get; }
        public int Depth { get; }
        public IReadOnlyList<TrackId> Path { get; }
    }
}
```

Order `stackRelations` by relation type, source ID, and target ID before creating both lookups so traversal is deterministic independently of the caller's query ordering.

- [ ] **Step 4: Make the existing stack list consume the graph**

Update the imports in `TracksEndpointRouteBuilderExtensions.Stacks.cs`: the shared graph replaces every local `TrackId` traversal use, so add its namespace and remove the now-unused ID namespace.

```diff
+using DiscWeave.Application.Catalog.TrackStacks;
-using DiscWeave.Domain.SharedKernel.Ids;
```

In `ListTrackStacksAsync`, keep collection-scoped loading and ordering, construct one `TrackStackGraph`, and map each original through a renamed response mapper:

```csharp
var graph = new TrackStackGraph(tracks, relations);
TrackStackResponse[] responses =
[
    .. originals
        .Select(graph.Project)
        .Select(ToTrackStackResponse)
        .OrderBy(stack => stack.OriginalTitle, StringComparer.OrdinalIgnoreCase)
        .ThenBy(stack => stack.OriginalTrackId)
];
```

Replace the old traversal/issue helpers in the API file with this exact mapper; keep `VersionYear` unchanged:

```csharp
private static TrackStackResponse ToTrackStackResponse(
    TrackStackProjection projection)
{
    TrackStackMemberResponse[] members =
    [
        .. projection.Members.Select(member => new TrackStackMemberResponse(
            member.Track.Id.Value,
            member.Track.Title,
            VersionYear(member.Track),
            member.RelationType,
            member.Depth,
            member.IsDirect))
    ];
    TrackStackIssueResponse[] issues =
    [
        .. projection.CyclePaths.Select(path => new TrackStackIssueResponse(
            "track_stack.cycle",
            [.. path.Select(trackId => trackId.Value)]))
    ];

    return new TrackStackResponse(
        projection.Original.Id.Value,
        projection.Original.Title,
        VersionYear(projection.Original),
        members.Length,
        issues.Length > 0,
        members,
        issues);
}
```

Delete `BuildTrackStack`, `AddCycleIssue`, and `TrackStackTraversalNode`; traversal now exists only in Application. Do not change the `/api/tracks/stacks` contract.

- [ ] **Step 5: Add the stack-target request and response contracts**

Use one top-level type per file:

```csharp
namespace DiscWeave.Api.Features.Tracks;

public sealed class TrackStackTargetListRequest
{
    public Guid? SourceTrackId { get; init; }
    public string? Search { get; init; }
    public int? Offset { get; init; }
    public int? Limit { get; init; }
}
```

```csharp
namespace DiscWeave.Api.Features.Tracks;

public sealed class TrackStackTargetResponse
{
    public TrackStackTargetResponse(
        Guid rootTrackId,
        string title,
        string artistDisplay,
        int? versionYear,
        int memberCount,
        TrackStackTargetMatchedMemberResponse? matchedMember)
    {
        RootTrackId = rootTrackId;
        Title = title;
        ArtistDisplay = artistDisplay;
        VersionYear = versionYear;
        MemberCount = memberCount;
        MatchedMember = matchedMember;
    }

    public Guid RootTrackId { get; }
    public string Title { get; }
    public string ArtistDisplay { get; }
    public int? VersionYear { get; }
    public int MemberCount { get; }
    public TrackStackTargetMatchedMemberResponse? MatchedMember { get; }
}
```

```csharp
namespace DiscWeave.Api.Features.Tracks;

public sealed class TrackStackTargetMatchedMemberResponse
{
    public TrackStackTargetMatchedMemberResponse(
        Guid trackId,
        string title,
        string artistDisplay)
    {
        TrackId = trackId;
        Title = title;
        ArtistDisplay = artistDisplay;
    }

    public Guid TrackId { get; }
    public string Title { get; }
    public string ArtistDisplay { get; }
}
```

- [ ] **Step 6: Register and implement the endpoint**

Add this route before `/{trackId:guid}`:

```csharp
_ = group.MapGet("/stack-targets", ListTrackStackTargetsAsync)
    .WithName("ListTrackStackTargets");
```

Implement the handler with this exact top-level flow:

```csharp
private static async Task<IResult> ListTrackStackTargetsAsync(
    [AsParameters] TrackStackTargetListRequest request,
    DiscWeaveDbContext context,
    ICurrentCollection currentCollection,
    CancellationToken cancellationToken)
{
    if (!TryNormalizeStackTargetRequest(
        request,
        out Guid sourceTrackId,
        out string search,
        out int offset,
        out int limit,
        out IResult error))
    {
        return error;
    }

    Track? source = await context.Tracks.AsNoTracking().SingleOrDefaultAsync(
        track => track.CollectionId == currentCollection.CollectionId &&
            track.Id == new TrackId(sourceTrackId),
        cancellationToken);
    if (source is null)
    {
        return EndpointErrors.NotFound("track.not_found", "Track was not found");
    }

    IReadOnlyList<string> typeCodes =
        await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
            context,
            currentCollection.CollectionId,
            cancellationToken);
    Track[] tracks = await LoadStackTracksAsync(context, currentCollection.CollectionId, cancellationToken);
    TrackRelation[] relations = await LoadStackRelationsAsync(
        context,
        currentCollection.CollectionId,
        typeCodes,
        cancellationToken);
    var graph = new TrackStackGraph(tracks, relations);
    if (!graph.IsStandalone(source.Id))
    {
        return EndpointErrors.Conflict(
            "track_stack.source_not_standalone",
            "Track is not eligible for stack assignment");
    }

    TrackStackProjection[] stacks =
    [
        .. tracks
            .Where(track => track.Metadata.IsOriginal && track.Id != source.Id)
            .Select(graph.Project)
            .Where(stack => stack.Members.Count > 0)
    ];
    IReadOnlyDictionary<TrackId, string> artistDisplays =
        await LoadTrackArtistDisplaysAsync(
            [.. stacks.SelectMany(StackTrackIds).Distinct()],
            context,
            currentCollection.CollectionId,
            cancellationToken);
    StackTargetMatch[] matches =
    [
        .. stacks
            .Select(stack => MatchStackTarget(stack, artistDisplays, search))
            .OfType<StackTargetMatch>()
            .OrderBy(match => match.Rank)
            .ThenBy(match => match.Response.Title, StringComparer.OrdinalIgnoreCase)
            .ThenBy(match => match.Response.RootTrackId)
    ];

    return Results.Ok(new ListResponse<TrackStackTargetResponse>(
        [.. matches.Skip(offset).Take(limit).Select(match => match.Response)],
        limit,
        offset,
        matches.Length));
}
```

Add this minimal Task 1 normalizer so the handler compiles and the basic valid-query tests pass; Task 2 replaces it with the complete boundary implementation:

```csharp
private static bool TryNormalizeStackTargetRequest(
    TrackStackTargetListRequest request,
    out Guid sourceTrackId,
    out string search,
    out int offset,
    out int limit,
    out IResult error)
{
    sourceTrackId = request.SourceTrackId ?? Guid.Empty;
    search = request.Search?.Trim() ?? string.Empty;
    offset = request.Offset ?? 0;
    limit = request.Limit ?? 20;
    error = Results.Empty;

    if (sourceTrackId == Guid.Empty)
    {
        error = EndpointErrors.BadRequest(
            "track_stack.source_required",
            "Source track is required");
        return false;
    }

    if (search.Length < 2)
    {
        error = EndpointErrors.BadRequest(
            "track_stack.search_invalid",
            "Stack target search must contain at least 2 characters");
        return false;
    }

    return true;
}
```

`MatchStackTarget` must rank root-title `0`, root-artist `1`, and member-context `2`. Use trimmed case-insensitive substring matching with no fuzzy correction. If the root matches, return `MatchedMember = null`; otherwise choose the matching member by case-insensitive title and Track ID. Keep the private `StackTargetMatch` as a nested class in the endpoint partial class.

Add the collection-scoped loaders and matching helpers explicitly:

```csharp
private static async Task<Track[]> LoadStackTracksAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    CancellationToken cancellationToken) =>
    await context.Tracks.AsNoTracking()
        .Where(track => track.CollectionId == collectionId)
        .OrderBy(track => track.Title)
        .ThenBy(track => track.Id)
        .ToArrayAsync(cancellationToken);

private static async Task<TrackRelation[]> LoadStackRelationsAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    IReadOnlyList<string> relationTypeCodes,
    CancellationToken cancellationToken) =>
    relationTypeCodes.Count == 0
        ? []
        : await context.TrackRelations.AsNoTracking()
            .Where(relation =>
                relation.CollectionId == collectionId &&
                relationTypeCodes.Contains(relation.RelationType))
            .OrderBy(relation => relation.RelationType)
            .ThenBy(relation => relation.SourceTrackId)
            .ThenBy(relation => relation.TargetTrackId)
            .ToArrayAsync(cancellationToken);

private static IEnumerable<TrackId> StackTrackIds(TrackStackProjection stack)
{
    yield return stack.Original.Id;
    foreach (TrackStackMemberProjection member in stack.Members)
    {
        yield return member.Track.Id;
    }
}

private static StackTargetMatch? MatchStackTarget(
    TrackStackProjection stack,
    IReadOnlyDictionary<TrackId, string> artistDisplays,
    string search)
{
    string rootArtist = artistDisplays.GetValueOrDefault(
        stack.Original.Id,
        "Unknown artist");
    int? rootRank = stack.Original.Title.Contains(
        search,
        StringComparison.OrdinalIgnoreCase)
        ? 0
        : rootArtist.Contains(search, StringComparison.OrdinalIgnoreCase)
            ? 1
            : null;
    TrackStackMemberProjection? matchedMember = rootRank.HasValue
        ? null
        : stack.Members
            .Where(member =>
                member.Track.Title.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                artistDisplays.GetValueOrDefault(member.Track.Id, "Unknown artist")
                    .Contains(search, StringComparison.OrdinalIgnoreCase))
            .OrderBy(member => member.Track.Title, StringComparer.OrdinalIgnoreCase)
            .ThenBy(member => member.Track.Id.Value)
            .FirstOrDefault();
    if (!rootRank.HasValue && matchedMember is null)
    {
        return null;
    }

    TrackStackTargetMatchedMemberResponse? memberResponse = matchedMember is null
        ? null
        : new TrackStackTargetMatchedMemberResponse(
            matchedMember.Track.Id.Value,
            matchedMember.Track.Title,
            artistDisplays.GetValueOrDefault(
                matchedMember.Track.Id,
                "Unknown artist"));
    var response = new TrackStackTargetResponse(
        stack.Original.Id.Value,
        stack.Original.Title,
        rootArtist,
        VersionYear(stack.Original),
        stack.Members.Count,
        memberResponse);

    return new StackTargetMatch { Rank = rootRank ?? 2, Response = response };
}

private sealed class StackTargetMatch
{
    public required int Rank { get; init; }
    public required TrackStackTargetResponse Response { get; init; }
}
```

Put the handler, normalizer, loaders, mapper, and nested match class above into one complete `TracksEndpointRouteBuilderExtensions.StackTargets.cs` file with these imports and wrapper (do not duplicate any method):

```csharp
using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<IResult> ListTrackStackTargetsAsync(
        [AsParameters] TrackStackTargetListRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!TryNormalizeStackTargetRequest(
            request,
            out Guid sourceTrackId,
            out string search,
            out int offset,
            out int limit,
            out IResult error))
        {
            return error;
        }

        Track? source = await context.Tracks.AsNoTracking()
            .SingleOrDefaultAsync(
                track =>
                    track.CollectionId == currentCollection.CollectionId &&
                    track.Id == new TrackId(sourceTrackId),
                cancellationToken);
        if (source is null)
        {
            return EndpointErrors.NotFound(
                "track.not_found",
                "Track was not found");
        }

        IReadOnlyList<string> typeCodes =
            await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                context,
                currentCollection.CollectionId,
                cancellationToken);
        Track[] tracks = await LoadStackTracksAsync(
            context,
            currentCollection.CollectionId,
            cancellationToken);
        TrackRelation[] relations = await LoadStackRelationsAsync(
            context,
            currentCollection.CollectionId,
            typeCodes,
            cancellationToken);
        var graph = new TrackStackGraph(tracks, relations);
        if (!graph.IsStandalone(source.Id))
        {
            return EndpointErrors.Conflict(
                "track_stack.source_not_standalone",
                "Track is not eligible for stack assignment");
        }

        TrackStackProjection[] stacks =
        [
            .. tracks
                .Where(track =>
                    track.Metadata.IsOriginal &&
                    track.Id != source.Id)
                .Select(graph.Project)
                .Where(stack => stack.Members.Count > 0)
        ];
        IReadOnlyDictionary<TrackId, string> artistDisplays =
            await LoadTrackArtistDisplaysAsync(
                [.. stacks.SelectMany(StackTrackIds).Distinct()],
                context,
                currentCollection.CollectionId,
                cancellationToken);
        StackTargetMatch[] matches =
        [
            .. stacks
                .Select(stack =>
                    MatchStackTarget(stack, artistDisplays, search))
                .OfType<StackTargetMatch>()
                .OrderBy(match => match.Rank)
                .ThenBy(
                    match => match.Response.Title,
                    StringComparer.OrdinalIgnoreCase)
                .ThenBy(match => match.Response.RootTrackId)
        ];

        return Results.Ok(new ListResponse<TrackStackTargetResponse>(
            [
                .. matches
                    .Skip(offset)
                    .Take(limit)
                    .Select(match => match.Response)
            ],
            limit,
            offset,
            matches.Length));
    }

    private static bool TryNormalizeStackTargetRequest(
        TrackStackTargetListRequest request,
        out Guid sourceTrackId,
        out string search,
        out int offset,
        out int limit,
        out IResult error)
    {
        sourceTrackId = request.SourceTrackId ?? Guid.Empty;
        search = request.Search?.Trim() ?? string.Empty;
        offset = request.Offset ?? 0;
        limit = request.Limit ?? 20;
        error = Results.Empty;

        if (sourceTrackId == Guid.Empty)
        {
            error = EndpointErrors.BadRequest(
                "track_stack.source_required",
                "Source track is required");
            return false;
        }

        if (search.Length < 2)
        {
            error = EndpointErrors.BadRequest(
                "track_stack.search_invalid",
                "Stack target search must contain at least 2 characters");
            return false;
        }

        return true;
    }

    private static async Task<Track[]> LoadStackTracksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken) =>
        await context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId)
            .OrderBy(track => track.Title)
            .ThenBy(track => track.Id)
            .ToArrayAsync(cancellationToken);

    private static async Task<TrackRelation[]> LoadStackRelationsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<string> relationTypeCodes,
        CancellationToken cancellationToken) =>
        relationTypeCodes.Count == 0
            ? []
            : await context.TrackRelations.AsNoTracking()
                .Where(relation =>
                    relation.CollectionId == collectionId &&
                    relationTypeCodes.Contains(relation.RelationType))
                .OrderBy(relation => relation.RelationType)
                .ThenBy(relation => relation.SourceTrackId)
                .ThenBy(relation => relation.TargetTrackId)
                .ToArrayAsync(cancellationToken);

    private static IEnumerable<TrackId> StackTrackIds(
        TrackStackProjection stack)
    {
        yield return stack.Original.Id;
        foreach (TrackStackMemberProjection member in stack.Members)
        {
            yield return member.Track.Id;
        }
    }

    private static StackTargetMatch? MatchStackTarget(
        TrackStackProjection stack,
        IReadOnlyDictionary<TrackId, string> artistDisplays,
        string search)
    {
        string rootArtist = artistDisplays.GetValueOrDefault(
            stack.Original.Id,
            "Unknown artist");
        int? rootRank = stack.Original.Title.Contains(
            search,
            StringComparison.OrdinalIgnoreCase)
            ? 0
            : rootArtist.Contains(
                search,
                StringComparison.OrdinalIgnoreCase)
                ? 1
                : null;
        TrackStackMemberProjection? matchedMember = rootRank.HasValue
            ? null
            : stack.Members
                .Where(member =>
                    member.Track.Title.Contains(
                        search,
                        StringComparison.OrdinalIgnoreCase) ||
                    artistDisplays.GetValueOrDefault(
                        member.Track.Id,
                        "Unknown artist").Contains(
                            search,
                            StringComparison.OrdinalIgnoreCase))
                .OrderBy(
                    member => member.Track.Title,
                    StringComparer.OrdinalIgnoreCase)
                .ThenBy(member => member.Track.Id.Value)
                .FirstOrDefault();
        if (!rootRank.HasValue && matchedMember is null)
        {
            return null;
        }

        TrackStackTargetMatchedMemberResponse? memberResponse =
            matchedMember is null
                ? null
                : new TrackStackTargetMatchedMemberResponse(
                    matchedMember.Track.Id.Value,
                    matchedMember.Track.Title,
                    artistDisplays.GetValueOrDefault(
                        matchedMember.Track.Id,
                        "Unknown artist"));
        var response = new TrackStackTargetResponse(
            stack.Original.Id.Value,
            stack.Original.Title,
            rootArtist,
            VersionYear(stack.Original),
            stack.Members.Count,
            memberResponse);
        return new StackTargetMatch
        {
            Rank = rootRank ?? 2,
            Response = response
        };
    }

    private sealed class StackTargetMatch
    {
        public required int Rank { get; init; }
        public required TrackStackTargetResponse Response { get; init; }
    }
}
```

- [ ] **Step 7: Implement artist display without loading digital-file projections**

In `.StackTargetArtists.cs`, reuse `LoadTrackCreditsAsync`, `LoadAppearanceReleasesAsync`, `LoadReleaseCreditsAsync`, `LoadArtistsByIdAsync`, and `FormatReleaseArtists`. For each Track, use this precedence:

```text
direct credits whose roles include mainArtist
-> all direct Track credits
-> release artist displays for linked appearances
-> Unknown artist
```

Deduplicate names while preserving deterministic order, and join multiple names with `, `. A various-artists release contributes `Various Artists`. Do not call `ToTrackResponsesAsync`, because that would load unrelated digital-file and label projections for every candidate.

Implement the formatter around the existing loaders with this shape:

```csharp
private static async Task<IReadOnlyDictionary<TrackId, string>>
    LoadTrackArtistDisplaysAsync(
        IReadOnlyCollection<TrackId> requestedTrackIds,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
{
    TrackId[] trackIds = [.. requestedTrackIds.Distinct()];
    Credit[] trackCredits = await LoadTrackCreditsAsync(
        context,
        collectionId,
        trackIds,
        cancellationToken);
    Release[] releases = await LoadAppearanceReleasesAsync(
        context,
        collectionId,
        trackIds,
        cancellationToken);
    ReleaseId[] releaseIds = [.. releases.Select(release => release.Id).Distinct()];
    Credit[] releaseCredits = await LoadReleaseCreditsAsync(
        context,
        collectionId,
        releaseIds,
        cancellationToken);
    ArtistId[] artistIds =
    [
        .. trackCredits.Concat(releaseCredits)
            .Select(credit => credit.Contributor.ArtistId)
            .Distinct()
    ];
    Dictionary<ArtistId, Artist> artistsById = await LoadArtistsByIdAsync(
        context,
        collectionId,
        artistIds,
        cancellationToken);

    return trackIds.ToDictionary(
        trackId => trackId,
        trackId => TrackArtistDisplay(
            trackId,
            trackCredits,
            releases,
            releaseCredits,
            artistsById));
}

private static string TrackArtistDisplay(
    TrackId trackId,
    IReadOnlyList<Credit> trackCredits,
    IReadOnlyList<Release> releases,
    IReadOnlyList<Credit> releaseCredits,
    Dictionary<ArtistId, Artist> artistsById)
{
    Credit[] directCredits =
    [
        .. trackCredits.Where(credit =>
            credit.Target is TrackCreditTarget target &&
            target.TrackId == trackId)
    ];
    string[] mainArtists =
    [
        .. directCredits
            .Where(credit => credit.Roles.Contains("mainArtist", StringComparer.Ordinal))
            .Select(credit => ArtistName(credit, artistsById))
            .Distinct(StringComparer.OrdinalIgnoreCase)
    ];
    string[] creditArtists =
    [
        .. directCredits
            .Select(credit => ArtistName(credit, artistsById))
            .Distinct(StringComparer.OrdinalIgnoreCase)
    ];
    string[] releaseArtists =
    [
        .. releases
            .Where(release => release.Tracklist.Any(item => item.TrackId == trackId))
            .OrderBy(release => release.Summary.Title, StringComparer.OrdinalIgnoreCase)
            .ThenBy(release => release.Id.Value)
            .Select(release => release.IsVariousArtists
                ? "Various Artists"
                : FormatReleaseArtists(
                    [
                        .. releaseCredits.Where(credit =>
                            credit.Target is ReleaseCreditTarget target &&
                            target.ReleaseId == release.Id)
                    ],
                    artistsById))
            .Distinct(StringComparer.OrdinalIgnoreCase)
    ];
    string[] selected = mainArtists.Length > 0
        ? mainArtists
        : creditArtists.Length > 0
            ? creditArtists
            : releaseArtists;

    return selected.Length > 0
        ? string.Join(", ", selected)
        : "Unknown artist";
}

private static string ArtistName(
    Credit credit,
    IReadOnlyDictionary<ArtistId, Artist> artistsById) =>
    artistsById.TryGetValue(credit.Contributor.ArtistId, out Artist? artist)
        ? artist.Name
        : credit.Contributor.Name;
```

The resulting `TracksEndpointRouteBuilderExtensions.StackTargetArtists.cs` must be this complete file:

```csharp
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<IReadOnlyDictionary<TrackId, string>>
        LoadTrackArtistDisplaysAsync(
            IReadOnlyCollection<TrackId> requestedTrackIds,
            DiscWeaveDbContext context,
            CollectionId collectionId,
            CancellationToken cancellationToken)
    {
        TrackId[] trackIds = [.. requestedTrackIds.Distinct()];
        Credit[] trackCredits = await LoadTrackCreditsAsync(
            context,
            collectionId,
            trackIds,
            cancellationToken);
        Release[] releases = await LoadAppearanceReleasesAsync(
            context,
            collectionId,
            trackIds,
            cancellationToken);
        ReleaseId[] releaseIds =
        [
            .. releases
                .Select(release => release.Id)
                .Distinct()
        ];
        Credit[] releaseCredits = await LoadReleaseCreditsAsync(
            context,
            collectionId,
            releaseIds,
            cancellationToken);
        ArtistId[] artistIds =
        [
            .. trackCredits
                .Concat(releaseCredits)
                .Select(credit => credit.Contributor.ArtistId)
                .Distinct()
        ];
        Dictionary<ArtistId, Artist> artistsById =
            await LoadArtistsByIdAsync(
                context,
                collectionId,
                artistIds,
                cancellationToken);

        return trackIds.ToDictionary(
            trackId => trackId,
            trackId => TrackArtistDisplay(
                trackId,
                trackCredits,
                releases,
                releaseCredits,
                artistsById));
    }

    private static string TrackArtistDisplay(
        TrackId trackId,
        IReadOnlyList<Credit> trackCredits,
        IReadOnlyList<Release> releases,
        IReadOnlyList<Credit> releaseCredits,
        Dictionary<ArtistId, Artist> artistsById)
    {
        Credit[] directCredits =
        [
            .. trackCredits.Where(credit =>
                credit.Target is TrackCreditTarget target &&
                target.TrackId == trackId)
        ];
        string[] mainArtists =
        [
            .. directCredits
                .Where(credit =>
                    credit.Roles.Contains(
                        "mainArtist",
                        StringComparer.Ordinal))
                .Select(credit => ArtistName(credit, artistsById))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
        string[] creditArtists =
        [
            .. directCredits
                .Select(credit => ArtistName(credit, artistsById))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
        string[] releaseArtists =
        [
            .. releases
                .Where(release =>
                    release.Tracklist.Any(item =>
                        item.TrackId == trackId))
                .OrderBy(
                    release => release.Summary.Title,
                    StringComparer.OrdinalIgnoreCase)
                .ThenBy(release => release.Id.Value)
                .Select(release => release.IsVariousArtists
                    ? "Various Artists"
                    : FormatReleaseArtists(
                        [
                            .. releaseCredits.Where(credit =>
                                credit.Target is
                                    ReleaseCreditTarget target &&
                                target.ReleaseId == release.Id)
                        ],
                        artistsById))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
        string[] selected = mainArtists.Length > 0
            ? mainArtists
            : creditArtists.Length > 0
                ? creditArtists
                : releaseArtists;

        return selected.Length > 0
            ? string.Join(", ", selected)
            : "Unknown artist";
    }

    private static string ArtistName(
        Credit credit,
        IReadOnlyDictionary<ArtistId, Artist> artistsById) =>
        artistsById.TryGetValue(
            credit.Contributor.ArtistId,
            out Artist? artist)
            ? artist.Name
            : credit.Contributor.Name;
}
```

- [ ] **Step 8: Run old and new projection tests**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~TrackStackTargetEndpointTests|FullyQualifiedName~RelationEndpointTests.Track_stacks"
```

Expected: PASS, including the existing transitive/deduplicated/cycle-safe stack test.

- [ ] **Step 9: Commit the graph and basic search**

```bash
git add api/src/DiscWeave.Application/Catalog/TrackStacks api/src/DiscWeave.Api/Features/Tracks api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.cs api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Helpers.cs
git commit -m "feat(api): add searchable track stack targets"
```

Expected: commit succeeds and contains no persistence schema change.

---

### Task 2: Complete Search Validation, Isolation, Ranking, and Pagination

**Files:**

- Create: `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Validation.cs`
- Create: `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Paging.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Helpers.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.StackTargets.cs`

**Interfaces:**

- Consumes:
  - `GET /api/tracks/stack-targets`, `TrackStackGraph`, `TrackStackTargetListRequest`, and `TrackStackTargetResponse` from Task 1.
  - Authenticated collection-scoped test setup and structured `EndpointErrors`.
- Produces:
  - Required non-empty `sourceTrackId`; trimmed `search` length 2–200.
  - Defaults `offset = 0`, `limit = 20`; negative offset or non-positive limit maps to `400 pagination.invalid`; positive limits clamp to 50.
  - Unknown and foreign source Tracks map identically to `404 track.not_found`; a known non-standalone source maps to `409 track_stack.source_not_standalone`.
  - Ranking before pagination in the order root title, root artist, member context, with stable root/member tie-breakers and collection-isolated `items`/`total`.

- [ ] **Step 1: Add failing validation and ordering tests**

First append these exact helpers to `TrackStackTargetEndpointTests.Helpers.cs`:

```csharp
private static string TargetUrl(
    Guid? sourceTrackId,
    string? search,
    int? offset = null,
    int? limit = null)
{
    List<string> query = [];
    if (sourceTrackId is { } sourceId)
    {
        query.Add($"sourceTrackId={sourceId:D}");
    }
    if (search is not null)
    {
        query.Add($"search={Uri.EscapeDataString(search)}");
    }
    if (offset is { } actualOffset)
    {
        query.Add($"offset={actualOffset}");
    }
    if (limit is { } actualLimit)
    {
        query.Add($"limit={actualLimit}");
    }
    return $"/api/tracks/stack-targets?{string.Join("&", query)}";
}

private static async Task<(HttpStatusCode Status, JsonElement Body)> GetJsonAsync(
    HttpClient client,
    string uri)
{
    using HttpResponseMessage response = await client.GetAsync(uri);
    using JsonDocument document = await JsonDocument.ParseAsync(
        await response.Content.ReadAsStreamAsync());
    return (response.StatusCode, document.RootElement.Clone());
}

private static Guid[] RootIds(JsonDocument document) =>
[
    .. document.RootElement.GetProperty("items")
        .EnumerateArray()
        .Select(item => item.GetProperty("rootTrackId").GetGuid())
];

private static void AssertError(
    (HttpStatusCode Status, JsonElement Body) response,
    HttpStatusCode expectedStatus,
    string expectedCode)
{
    Assert.Equal(expectedStatus, response.Status);
    Assert.Equal(expectedCode, response.Body.GetProperty("code").GetString());
}

private static async Task<(Guid RootId, Guid MemberId)> CreateStackAsync(
    HttpClient client,
    string rootTitle,
    string memberTitle,
    string? rootArtist = null,
    string? memberArtist = null)
{
    Guid rootId = await CreateTrackAsync(client, rootTitle);
    Guid memberId = await CreateTrackAsync(client, memberTitle);
    await MarkOriginalAsync(client, rootId, rootTitle, 2000);
    if (rootArtist is not null)
    {
        await AddMainArtistAsync(client, rootId, rootArtist);
    }
    if (memberArtist is not null)
    {
        await AddMainArtistAsync(client, memberId, memberArtist);
    }
    await CreateRelationAsync(client, memberId, rootId, "versionOf");
    return (rootId, memberId);
}

private static async Task<(HttpClient Owner, HttpClient Other)>
    CreateAuthenticatedClientsAsync(ApiTestHost host)
{
    HttpClient owner = host.CreateClient();
    using HttpResponseMessage registerResponse = await owner.PostAsJsonAsync(
        "/api/auth/register",
        new { email = "owner@example.com", password = "Password1!" });
    Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);
    using HttpResponseMessage createUserResponse = await owner.PostAsJsonAsync(
        "/api/admin/users",
        new
        {
            email = "collector@example.com",
            password = "Password1!",
            isAdmin = false
        });
    Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);
    HttpClient other = host.CreateClient();
    using HttpResponseMessage loginResponse = await other.PostAsJsonAsync(
        "/api/auth/login",
        new { email = "collector@example.com", password = "Password1!" });
    Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
    return (owner, other);
}
```

Create `TrackStackTargetEndpointTests.Validation.cs`:

```csharp
using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackStackTargetEndpointTests
{
    [Fact(DisplayName = "Stack target search validates source query and pagination")]
    public async Task Stack_target_search_validates_source_query_and_pagination()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming Track");

        AssertError(
            await GetJsonAsync(client, TargetUrl(null, "ab")),
            HttpStatusCode.BadRequest,
            "track_stack.source_required");
        foreach (string invalidSearch in new[] { "", " ", "a", " a " })
        {
            AssertError(
                await GetJsonAsync(client, TargetUrl(sourceId, invalidSearch)),
                HttpStatusCode.BadRequest,
                "track_stack.search_invalid");
        }
        Assert.Equal(
            HttpStatusCode.OK,
            (await GetJsonAsync(
                client,
                TargetUrl(sourceId, new string('a', 200)))).Status);
        AssertError(
            await GetJsonAsync(
                client,
                TargetUrl(sourceId, new string('a', 201))),
            HttpStatusCode.BadRequest,
            "track_stack.search_invalid");
        foreach ((int? Offset, int? Limit) invalid in
            new (int?, int?)[] { (-1, 20), (0, 0), (0, -1) })
        {
            AssertError(
                await GetJsonAsync(
                    client,
                    TargetUrl(sourceId, "ab", invalid.Offset, invalid.Limit)),
                HttpStatusCode.BadRequest,
                "pagination.invalid");
        }

        using JsonDocument defaults = await GetTargetsAsync(client, sourceId, "zz");
        Assert.Equal(20, defaults.RootElement.GetProperty("limit").GetInt32());
        Assert.Equal(0, defaults.RootElement.GetProperty("offset").GetInt32());
        using JsonDocument clamped = await GetTargetsAsync(client, sourceId, "zz", 0, 51);
        Assert.Equal(50, clamped.RootElement.GetProperty("limit").GetInt32());
        _ = await CreateStackAsync(client, "Bass Root", "Root Member");
        using JsonDocument beyond = await GetTargetsAsync(client, sourceId, "Bass", 100, 10);
        Assert.Empty(Items(beyond));
        Assert.Equal(1, beyond.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Stack target search hides unknown and foreign source tracks identically")]
    public async Task Stack_target_search_hides_unknown_and_foreign_source_tracks_identically()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient owner, HttpClient other) = await CreateAuthenticatedClientsAsync(host);
        Guid foreignSource = await CreateTrackAsync(other, "Foreign Source");
        var unknown = await GetJsonAsync(
            owner,
            TargetUrl(Guid.CreateVersion7(), "ab"));
        var foreign = await GetJsonAsync(owner, TargetUrl(foreignSource, "ab"));
        AssertError(unknown, HttpStatusCode.NotFound, "track.not_found");
        AssertError(foreign, HttpStatusCode.NotFound, "track.not_found");
        Assert.Equal(
            unknown.Body.GetProperty("message").GetString(),
            foreign.Body.GetProperty("message").GetString());
    }

    [Fact(DisplayName = "Stack target search rejects a known ineligible source")]
    public async Task Stack_target_search_rejects_a_known_ineligible_source()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Member Source");
        Guid rootId = await CreateTrackAsync(client, "Existing Root");
        await MarkOriginalAsync(client, rootId, "Existing Root", 2000);
        await CreateRelationAsync(client, sourceId, rootId, "versionOf");
        AssertError(
            await GetJsonAsync(client, TargetUrl(sourceId, "ab")),
            HttpStatusCode.Conflict,
            "track_stack.source_not_standalone");
    }
}
```

Create `TrackStackTargetEndpointTests.Paging.cs`:

```csharp
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackStackTargetEndpointTests
{
    [Fact(DisplayName = "Stack target search orders and pages results deterministically")]
    public async Task Stack_target_search_orders_and_pages_results_deterministically()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming");
        (Guid firstRootId, _) = await CreateStackAsync(
            client,
            "Bass Alpha",
            "Alpha Member");
        (Guid secondRootId, _) = await CreateStackAsync(
            client,
            "Bass Beta",
            "Beta Member");
        (Guid artistRootId, _) = await CreateStackAsync(
            client,
            "Gamma Root",
            "Gamma Member",
            rootArtist: "Bass Artist");
        (Guid memberRootId, _) = await CreateStackAsync(
            client,
            "Delta Root",
            "Bass Member");
        Guid[] expected = [firstRootId, secondRootId, artistRootId, memberRootId];

        using JsonDocument all = await GetTargetsAsync(client, sourceId, "Bass", 0, 50);
        using JsonDocument firstPage = await GetTargetsAsync(client, sourceId, "Bass", 0, 2);
        using JsonDocument secondPage = await GetTargetsAsync(client, sourceId, "Bass", 2, 2);
        Guid[] combined = [.. RootIds(firstPage), .. RootIds(secondPage)];

        Assert.Equal(expected, RootIds(all));
        Assert.Equal(expected, combined);
        Assert.Equal(combined.Length, combined.Distinct().Count());
        Assert.Equal(4, all.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Stack target search is isolated to the active collection")]
    public async Task Stack_target_search_is_isolated_to_the_active_collection()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient owner, HttpClient other) = await CreateAuthenticatedClientsAsync(host);
        Guid ownerSource = await CreateTrackAsync(owner, "Owner Source");
        _ = await CreateTrackAsync(other, "Foreign Source");
        (Guid ownerRoot, Guid ownerMember) = await CreateStackAsync(
            owner,
            "Owner Root",
            "Shared Member");
        (Guid foreignRoot, Guid foreignMember) = await CreateStackAsync(
            other,
            "Foreign Root",
            "Shared Member");

        using JsonDocument response = await GetTargetsAsync(
            owner,
            ownerSource,
            "Shared Member");
        JsonElement item = Assert.Single(Items(response));
        Assert.Equal(ownerRoot, item.GetProperty("rootTrackId").GetGuid());
        Assert.Equal(
            ownerMember,
            item.GetProperty("matchedMember").GetProperty("trackId").GetGuid());
        Assert.NotEqual(foreignRoot, item.GetProperty("rootTrackId").GetGuid());
        Assert.NotEqual(
            foreignMember,
            item.GetProperty("matchedMember").GetProperty("trackId").GetGuid());
        Assert.Equal(1, response.RootElement.GetProperty("total").GetInt32());
    }
}
```

- [ ] **Step 2: Run the validation file and observe boundary failures**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~TrackStackTargetEndpointTests"
```

Expected: FAIL until all explicit error codes, limit clamping, and collection-isolation assertions are implemented.

- [ ] **Step 3: Implement the exact request normalizer**

Use a local normalizer rather than `Pagination.TryNormalize`, because the picker contract has different defaults and clamps oversized positive limits:

```csharp
private static bool TryNormalizeStackTargetRequest(
    TrackStackTargetListRequest request,
    out Guid sourceTrackId,
    out string search,
    out int offset,
    out int limit,
    out IResult error)
{
    sourceTrackId = request.SourceTrackId ?? Guid.Empty;
    search = request.Search?.Trim() ?? string.Empty;
    offset = request.Offset ?? 0;
    int requestedLimit = request.Limit ?? 20;
    limit = Math.Min(requestedLimit, 50);
    error = Results.Empty;

    if (sourceTrackId == Guid.Empty)
    {
        error = EndpointErrors.BadRequest(
            "track_stack.source_required",
            "Source track is required");
        return false;
    }

    if (search.Length is < 2 or > 200)
    {
        error = EndpointErrors.BadRequest(
            "track_stack.search_invalid",
            "Stack target search must contain between 2 and 200 characters");
        return false;
    }

    if (offset < 0 || requestedLimit <= 0)
    {
        error = EndpointErrors.BadRequest(
            "pagination.invalid",
            "Pagination values are invalid");
        return false;
    }

    return true;
}
```

- [ ] **Step 4: Confirm deterministic matching details**

Ensure rank and tie-breaking are applied before `Skip`/`Take`. Normalize only for comparison; preserve original title and artist strings in the response. Deduplicate roots before counting `total`, and select a member representative before pagination so it cannot change between pages.

- [ ] **Step 5: Run focused and architecture tests**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~TrackStackTargetEndpointTests"
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~SourceFileSizeTests"
```

Expected: PASS and every new API/test file is at most 300 lines.

- [ ] **Step 6: Commit the completed search contract**

```bash
git add api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.StackTargets.cs api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Validation.cs api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Paging.cs api/tests/DiscWeave.Api.Tests/TrackStackTargetEndpointTests.Helpers.cs
git commit -m "feat(api): complete stack target search contract"
```

---

### Task 3: Enforce Authoritative Stack Mutation Invariants

**Files:**

- Modify: `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.cs`
- Create: `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.Stacks.cs`
- Create: `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.StackValidation.cs`
- Create: `api/src/DiscWeave.Api/Features/TrackRelations/StackTrackRelationRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.Management.cs`
- Create: `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackRelationValidationFailure.cs`
- Create: `api/src/DiscWeave.Application/Catalog/TrackStacks/TrackStackRelationValidator.cs`
- Modify: `api/src/DiscWeave.Application/DependencyInjection.cs`
- Create: `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Helpers.cs`
- Create: `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Source.cs`
- Create: `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Target.cs`
- Create: `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Idempotency.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStacks.cs`

**Interfaces:**

- Consumes:
  - `TrackStackGraph` from `DiscWeave.Application.Catalog.TrackStacks`, `TrackRelationIdentity`, active dictionary validation, and `TrackStackSettingsReader`.
  - The active-collection EF Track/TrackRelation queries, transaction, and unique identity constraint.
- Produces:
  - `StackTrackRelationRequest` and one transactional, idempotent `POST /api/track-relations/stack` path.
  - `TrackStackRelationValidator.ValidateNew(Track source, Track target, string relationType, IReadOnlyCollection<string> configuredRelationTypeCodes, TrackStackGraph graph, bool markTargetAsOriginal): TrackStackRelationValidationFailure` in Application.
  - `TrackStackRelationValidationFailure` values `None`, `RelationTypeNotConfigured`, `Cycle`, `SourceNotStandalone`, `TargetNotOriginal`, and `TargetNotStandalone`.
  - HTTP request-shape validation and `EndpointErrors` mapping remain in API; Application references no `IResult`, HTTP status, EF type, or error string.

- [ ] **Step 1: Add failing mutation invariant tests**

Create `RelationEndpointTests.TrackStackValidation.Helpers.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    private static async Task<(HttpStatusCode Status, JsonElement Body)>
        PostStackRelationAsync(
            HttpClient client,
            Guid sourceTrackId,
            Guid targetTrackId,
            string type = "versionOf",
            bool markTargetAsOriginal = false)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations/stack",
            new { sourceTrackId, targetTrackId, type, markTargetAsOriginal });
        using JsonDocument document = await ReadJsonAsync(response);
        return (response.StatusCode, document.RootElement.Clone());
    }

    private static void AssertStackError(
        (HttpStatusCode Status, JsonElement Body) response,
        HttpStatusCode expectedStatus,
        string expectedCode)
    {
        Assert.Equal(expectedStatus, response.Status);
        Assert.Equal(expectedCode, response.Body.GetProperty("code").GetString());
    }

    private static async Task<Guid> CreateOriginalTrackAsync(
        HttpClient client,
        string title)
    {
        Guid trackId = await CreateTrackAsync(client, title);
        await MarkOriginalAsync(client, trackId, title, 2000);
        return trackId;
    }

    private static async Task<bool> GetTrackIsOriginalAsync(
        HttpClient client,
        Guid trackId)
    {
        using HttpResponseMessage response = await client.GetAsync(
            $"/api/tracks/{trackId:D}");
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return document.RootElement.GetProperty("isOriginal").GetBoolean();
    }

    private static async Task<int> GetTrackRelationTotalAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync(
            "/api/track-relations?limit=100&offset=0");
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return document.RootElement.GetProperty("total").GetInt32();
    }

    private static async Task SetStackRelationTypesAsync(
        HttpClient client,
        params string[] relationTypeCodes)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            "/api/settings/track-stack",
            new { defaultRelationTypeCodes = relationTypeCodes });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<(HttpClient AdminClient, HttpClient UserClient)>
        CreateStackRelationClientsAsync(ApiTestHost host)
    {
        HttpClient adminClient = host.CreateClient();
        using HttpResponseMessage registerResponse =
            await adminClient.PostAsJsonAsync(
                "/api/auth/register",
                new { email = "owner@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        using HttpResponseMessage createUserResponse =
            await adminClient.PostAsJsonAsync(
                "/api/admin/users",
                new
                {
                    email = "collector@example.com",
                    password = "Password1!",
                    isAdmin = false
                });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);

        HttpClient userClient = host.CreateClient();
        using HttpResponseMessage loginResponse =
            await userClient.PostAsJsonAsync(
                "/api/auth/login",
                new { email = "collector@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        return (adminClient, userClient);
    }
}
```

Create `RelationEndpointTests.TrackStackValidation.Source.cs`:

```csharp
using System.Net;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack relation rejects a source that is already a member")]
    public async Task Stack_relation_rejects_a_source_that_is_already_a_member()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Member Source");
        Guid currentRootId = await CreateOriginalTrackAsync(client, "Current Root");
        Guid destinationId = await CreateOriginalTrackAsync(client, "Destination");
        _ = await CreateTrackRelationAsync(
            client,
            sourceId,
            currentRootId,
            "versionOf");

        AssertStackError(
            await PostStackRelationAsync(client, sourceId, destinationId),
            HttpStatusCode.Conflict,
            "track_relation.stack_source_not_standalone");
    }

    [Fact(DisplayName = "Stack relation rejects a source that already has members")]
    public async Task Stack_relation_rejects_a_source_that_already_has_members()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source Root");
        Guid memberId = await CreateTrackAsync(client, "Existing Member");
        Guid destinationId = await CreateOriginalTrackAsync(client, "Destination");
        _ = await CreateTrackRelationAsync(
            client,
            memberId,
            sourceId,
            "versionOf");

        AssertStackError(
            await PostStackRelationAsync(client, sourceId, destinationId),
            HttpStatusCode.Conflict,
            "track_relation.stack_source_not_standalone");
    }

    [Fact(DisplayName = "Stack relation rejects self targets and cycles")]
    public async Task Stack_relation_rejects_self_targets_and_cycles()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid selfId = await CreateTrackAsync(client, "Self");
        AssertStackError(
            await PostStackRelationAsync(client, selfId, selfId),
            HttpStatusCode.BadRequest,
            "track_relation.stack_self_relation");

        Guid sourceId = await CreateTrackAsync(client, "Cycle Source");
        Guid targetId = await CreateTrackAsync(client, "Cycle Target");
        _ = await CreateTrackRelationAsync(
            client,
            targetId,
            sourceId,
            "versionOf");
        AssertStackError(
            await PostStackRelationAsync(client, sourceId, targetId),
            HttpStatusCode.Conflict,
            "track_relation.stack_cycle");
    }
}
```

Create `RelationEndpointTests.TrackStackValidation.Target.cs`:

```csharp
using System.Net;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack relation hides unknown and foreign tracks identically")]
    public async Task Stack_relation_hides_unknown_and_foreign_tracks_identically()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient adminClient, HttpClient userClient) =
            await CreateStackRelationClientsAsync(host);
        Guid sourceId = await CreateTrackAsync(adminClient, "Source");
        Guid foreignTargetId = await CreateTrackAsync(userClient, "Foreign Target");
        Guid foreignSourceId = await CreateTrackAsync(userClient, "Foreign Source");
        Guid ownTargetId = await CreateOriginalTrackAsync(adminClient, "Own Target");

        var unknown = await PostStackRelationAsync(
            adminClient,
            sourceId,
            Guid.CreateVersion7());
        var foreign = await PostStackRelationAsync(
            adminClient,
            sourceId,
            foreignTargetId);
        var unknownSource = await PostStackRelationAsync(
            adminClient,
            Guid.CreateVersion7(),
            ownTargetId);
        var foreignSource = await PostStackRelationAsync(
            adminClient,
            foreignSourceId,
            ownTargetId);

        AssertStackError(
            unknown,
            HttpStatusCode.Conflict,
            "track_relation.track_conflict");
        AssertStackError(
            foreign,
            HttpStatusCode.Conflict,
            "track_relation.track_conflict");
        AssertStackError(
            unknownSource,
            HttpStatusCode.Conflict,
            "track_relation.track_conflict");
        AssertStackError(
            foreignSource,
            HttpStatusCode.Conflict,
            "track_relation.track_conflict");
    }

    [Fact(DisplayName = "Stack relation requires an original target when promotion is false")]
    public async Task Stack_relation_requires_an_original_target_when_promotion_is_false()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Target");
        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: false),
            HttpStatusCode.Conflict,
            "track_relation.stack_target_not_original");
    }

    [Fact(DisplayName = "Stack relation accepts an empty original target without promotion")]
    public async Task Stack_relation_accepts_an_empty_original_target_without_promotion()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Empty Root");
        var response = await PostStackRelationAsync(
            client,
            sourceId,
            targetId,
            markTargetAsOriginal: false);
        Assert.Equal(HttpStatusCode.Created, response.Status);
        Assert.Equal(sourceId, response.Body.GetProperty("sourceTrackId").GetGuid());
        Assert.Equal(targetId, response.Body.GetProperty("targetTrackId").GetGuid());
    }

    [Fact(DisplayName = "Stack relation rejects promotion of a target that has members atomically")]
    public async Task Stack_relation_rejects_promotion_of_a_target_that_has_members_atomically()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Legacy Root");
        Guid memberId = await CreateTrackAsync(client, "Existing Member");
        _ = await CreateTrackRelationAsync(
            client,
            memberId,
            targetId,
            "versionOf");
        int beforeCount = await GetTrackRelationTotalAsync(client);

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.stack_target_not_standalone");
        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(beforeCount, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Failed stack relation validation leaves tracks and relations unchanged")]
    public async Task Failed_stack_relation_validation_leaves_tracks_and_relations_unchanged()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Member Source");
        Guid currentRootId = await CreateOriginalTrackAsync(client, "Current Root");
        Guid targetId = await CreateTrackAsync(client, "New Target");
        _ = await CreateTrackRelationAsync(
            client,
            sourceId,
            currentRootId,
            "versionOf");
        int beforeCount = await GetTrackRelationTotalAsync(client);

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.stack_source_not_standalone");
        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(beforeCount, await GetTrackRelationTotalAsync(client));
    }
}
```

Create `RelationEndpointTests.TrackStackValidation.Idempotency.cs`:

```csharp
using System.Net;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Api.Http;
using Microsoft.AspNetCore.Http;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack relation retries an identical relation idempotently")]
    public async Task Stack_relation_retries_an_identical_relation_idempotently()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Destination");
        var first = await PostStackRelationAsync(client, sourceId, targetId);
        var retry = await PostStackRelationAsync(client, sourceId, targetId);
        Assert.Equal(HttpStatusCode.Created, first.Status);
        Assert.Equal(HttpStatusCode.OK, retry.Status);
        Assert.Equal(
            first.Body.GetProperty("id").GetGuid(),
            retry.Body.GetProperty("id").GetGuid());
        Assert.Equal(1, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation retry succeeds after its type is removed from stack settings")]
    public async Task Stack_relation_retry_succeeds_after_its_type_is_removed_from_stack_settings()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Destination");
        var first = await PostStackRelationAsync(client, sourceId, targetId);
        await SetStackRelationTypesAsync(client);
        var retry = await PostStackRelationAsync(client, sourceId, targetId);
        Assert.Equal(HttpStatusCode.Created, first.Status);
        Assert.Equal(HttpStatusCode.OK, retry.Status);
        Assert.Equal(
            first.Body.GetProperty("id").GetGuid(),
            retry.Body.GetProperty("id").GetGuid());
        Assert.Equal(1, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation identity collisions map to the duplicate error")]
    public void Stack_relation_identity_collisions_map_to_the_duplicate_error()
    {
        IResult result = TrackRelationsEndpointRouteBuilderExtensions
            .StackRelationIdentityConflict();
        IStatusCodeHttpResult statusResult =
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        IValueHttpResult valueResult =
            Assert.IsAssignableFrom<IValueHttpResult>(result);
        ErrorResponse error = Assert.IsType<ErrorResponse>(valueResult.Value);

        Assert.Equal(StatusCodes.Status409Conflict, statusResult.StatusCode);
        Assert.Equal("track_relation.duplicate", error.Code);
        Assert.Equal("Track relation already exists", error.Message);
    }
}
```

Retain the existing `Stack relation endpoint reuses existing relation and marks target original` test unchanged; it proves that the exact-idempotency branch may still apply the requested promotion.

- [ ] **Step 2: Run relation tests and confirm invariant failures**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DiscWeave.Api.Tests.RelationEndpointTests"
```

Expected: FAIL because the current stack endpoint lacks standalone-source, original-target, target-members, and cycle guards.

- [ ] **Step 3: Move the request and transactional method without changing the route**

Move the request into its own file unchanged:

```csharp
namespace DiscWeave.Api.Features.TrackRelations;

internal sealed class StackTrackRelationRequest
{
    public Guid SourceTrackId { get; init; }
    public Guid TargetTrackId { get; init; }
    public string Type { get; init; } = string.Empty;
    public bool MarkTargetAsOriginal { get; init; }
}
```

Keep this route line in the main file:

```csharp
_ = group.MapPost("/stack", CreateStackTrackRelationAsync)
    .WithName("CreateStackTrackRelation");
```

Move the handler to `.Stacks.cs` so every API file stays below 300 lines.

After removing that handler from `TrackRelationsEndpointRouteBuilderExtensions.cs`, also remove its now-unused imports so warnings-as-errors remain clean:

```diff
-using DiscWeave.Application.Errors;
-using DiscWeave.Domain.Catalog;
```

- [ ] **Step 4: Implement validation in the required precedence order**

Create `TrackStackRelationValidationFailure.cs`:

```csharp
namespace DiscWeave.Application.Catalog.TrackStacks;

public enum TrackStackRelationValidationFailure
{
    None,
    RelationTypeNotConfigured,
    Cycle,
    SourceNotStandalone,
    TargetNotOriginal,
    TargetNotStandalone
}
```

Create the complete application validator in `TrackStackRelationValidator.cs`:

```csharp
using DiscWeave.Domain.Catalog;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackRelationValidator
{
    public TrackStackRelationValidationFailure ValidateNew(
        Track source,
        Track target,
        string relationType,
        IReadOnlyCollection<string> configuredRelationTypeCodes,
        TrackStackGraph graph,
        bool markTargetAsOriginal)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(target);
        ArgumentException.ThrowIfNullOrWhiteSpace(relationType);
        ArgumentNullException.ThrowIfNull(configuredRelationTypeCodes);
        ArgumentNullException.ThrowIfNull(graph);

        if (!configuredRelationTypeCodes.Contains(
            relationType,
            StringComparer.Ordinal))
        {
            return TrackStackRelationValidationFailure.RelationTypeNotConfigured;
        }

        if (graph.WouldCreateCycle(source.Id, target.Id))
        {
            return TrackStackRelationValidationFailure.Cycle;
        }

        if (!graph.IsStandalone(source.Id))
        {
            return TrackStackRelationValidationFailure.SourceNotStandalone;
        }

        if (!markTargetAsOriginal && !target.Metadata.IsOriginal)
        {
            return TrackStackRelationValidationFailure.TargetNotOriginal;
        }

        if (markTargetAsOriginal && graph.HasMembers(target.Id))
        {
            return TrackStackRelationValidationFailure.TargetNotStandalone;
        }

        return TrackStackRelationValidationFailure.None;
    }
}
```

Register it in `DiscWeave.Application.DependencyInjection.AddDiscWeaveApplication`:

```csharp
using DiscWeave.Application.Catalog.TrackStacks;

services.AddSingleton<TrackStackRelationValidator>();
```

Create `TrackRelationsEndpointRouteBuilderExtensions.Stacks.cs` as this complete file:

```csharp
using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DiscWeave.Api.Features.TrackRelations;

public static partial class TrackRelationsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> CreateStackTrackRelationAsync(
        StackTrackRelationRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        TrackStackRelationValidator validator,
        CancellationToken cancellationToken)
    {
        if (request.SourceTrackId == request.TargetTrackId)
        {
            return EndpointErrors.BadRequest(
                "track_relation.stack_self_relation",
                "Track relation cannot reference the same track twice");
        }

        await using IDbContextTransaction transaction =
            await context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            TrackId sourceId = new(request.SourceTrackId);
            TrackId targetId = new(request.TargetTrackId);
            Track? source = await context.Tracks.SingleOrDefaultAsync(
                track => track.CollectionId == currentCollection.CollectionId &&
                    track.Id == sourceId,
                cancellationToken);
            Track? target = await context.Tracks.SingleOrDefaultAsync(
                track => track.CollectionId == currentCollection.CollectionId &&
                    track.Id == targetId,
                cancellationToken);
            if (source is null || target is null)
            {
                return EndpointErrors.Conflict(
                    TrackRelationTrackConflictCode,
                    TrackRelationTrackConflictMessage);
            }

            string requestedType = TrackRelationMapper.ParseType(request.Type);
            string identityKey = TrackRelationIdentity.From(
                source.Id,
                target.Id,
                requestedType).Value;
            TrackRelation? existing = await FindTrackRelationByIdentityAsync(
                context,
                currentCollection.CollectionId,
                identityKey,
                cancellationToken);
            if (existing is not null)
            {
                if (request.MarkTargetAsOriginal)
                {
                    target.UpdateMetadata(
                        target.Metadata.WithOriginalMarker(true));
                }

                _ = await context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Results.Ok(
                    await ToResponseAsync(
                        existing,
                        context,
                        cancellationToken));
            }

            string relationType =
                await DictionaryValidation.RequireActiveCodeAsync(
                    context,
                    currentCollection.CollectionId,
                    DictionaryKind.TrackRelationType,
                    requestedType,
                    TrackRelationTypeInvalidCode,
                    TrackRelationTypeInvalidMessage,
                    cancellationToken);
            IReadOnlyList<string> configuredTypeCodes =
                await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                    context,
                    currentCollection.CollectionId,
                    cancellationToken);
            Track[] stackTracks = await context.Tracks.AsNoTracking()
                .Where(track =>
                    track.CollectionId == currentCollection.CollectionId)
                .ToArrayAsync(cancellationToken);
            TrackRelation[] stackRelations = configuredTypeCodes.Count == 0
                ? []
                : await context.TrackRelations.AsNoTracking()
                    .Where(relation =>
                        relation.CollectionId ==
                            currentCollection.CollectionId &&
                        configuredTypeCodes.Contains(
                            relation.RelationType))
                    .ToArrayAsync(cancellationToken);
            var graph = new TrackStackGraph(stackTracks, stackRelations);
            TrackStackRelationValidationFailure failure =
                validator.ValidateNew(
                    source,
                    target,
                    relationType,
                    configuredTypeCodes,
                    graph,
                    request.MarkTargetAsOriginal);
            if (failure != TrackStackRelationValidationFailure.None)
            {
                return MapStackValidationFailure(failure);
            }

            var relation = TrackRelation.Create(
                TrackRelationId.New(),
                currentCollection.CollectionId,
                source.Id,
                target.Id,
                relationType);
            _ = context.TrackRelations.Add(relation);
            if (request.MarkTargetAsOriginal)
            {
                target.UpdateMetadata(
                    target.Metadata.WithOriginalMarker(true));
            }

            _ = await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            TrackRelationResponse response = await ToResponseAsync(
                relation,
                context,
                cancellationToken);
            return Results.Created(
                $"/api/track-relations/{relation.Id.Value}",
                response);
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(
                exception.Code,
                exception.Message);
        }
        catch (ResourceConflictException)
        {
            return StackRelationIdentityConflict();
        }
    }
}
```

Create `TrackRelationsEndpointRouteBuilderExtensions.StackValidation.cs` as this complete file:

```csharp
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.TrackStacks;

namespace DiscWeave.Api.Features.TrackRelations;

public static partial class TrackRelationsEndpointRouteBuilderExtensions
{
    internal static IResult StackRelationIdentityConflict() =>
        EndpointErrors.Conflict(
            TrackRelationDuplicateCode,
            TrackRelationDuplicateMessage);

    private static IResult MapStackValidationFailure(
        TrackStackRelationValidationFailure failure) => failure switch
        {
            TrackStackRelationValidationFailure.RelationTypeNotConfigured =>
                EndpointErrors.BadRequest(
                    "track_relation.stack_type_invalid",
                    "Track relation type is not configured for track stacks"),
            TrackStackRelationValidationFailure.Cycle =>
                EndpointErrors.Conflict(
                    "track_relation.stack_cycle",
                    "Track relation would create a stack cycle"),
            TrackStackRelationValidationFailure.SourceNotStandalone =>
                EndpointErrors.Conflict(
                    "track_relation.stack_source_not_standalone",
                    "Source track is not standalone"),
            TrackStackRelationValidationFailure.TargetNotOriginal =>
                EndpointErrors.Conflict(
                    "track_relation.stack_target_not_original",
                    "Target track is not an original stack root"),
            TrackStackRelationValidationFailure.TargetNotStandalone =>
                EndpointErrors.Conflict(
                    "track_relation.stack_target_not_standalone",
                    "Target track already has stack members"),
            _ => throw new InvalidOperationException(
                "A successful stack validation cannot be mapped to an error")
        };
}
```

Do not reject a target merely because it is itself a member; nested/transitive original roots remain supported. Exact idempotency deliberately outranks dictionary deactivation, settings changes, and the source becoming a member after the first request.

- [ ] **Step 5: Verify atomic rollback**

For every early validation result, let transaction disposal roll back and do not call `SaveChangesAsync`. For persistence exceptions, do not commit. The rollback test must re-read both the target's `isOriginal` flag and relation count after failure.

- [ ] **Step 6: Run all relation and architecture tests**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~RelationEndpointTests"
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~SourceFileSizeTests"
```

Expected: PASS, including current atomic promotion, existing-relation promotion, configured-type, and transitive read tests.

- [ ] **Step 7: Commit authoritative mutation validation**

```bash
git add api/src/DiscWeave.Application/Catalog/TrackStacks api/src/DiscWeave.Application/DependencyInjection.cs api/src/DiscWeave.Api/Features/TrackRelations api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Helpers.cs api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Source.cs api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Target.cs api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStackValidation.Idempotency.cs api/tests/DiscWeave.Api.Tests/RelationEndpointTests.TrackStacks.cs
git commit -m "fix(api): enforce track stack relation invariants"
```

---

### Task 4: Add the Cancellable Stack-Target Client and Shared Command Contract

**Files:**

- Modify: `app/src/features/catalog/api/catalogDtoTypes.ts`
- Modify: `app/src/features/catalog/api/httpClient.ts`
- Create: `app/src/features/catalog/api/trackStackTargetsClient.ts`
- Modify: `app/src/features/catalog/api/ownedRelationsClient.ts`
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`
- Create: `app/src/features/catalog/api/trackStackTargetsClient.test.ts`

**Interfaces:**

- Consumes:
  - `ListResponse<T> = { items: T[]; limit: number; offset: number; total: number }`.
  - `getList<T>(path: string): Promise<ListResponse<T>>`.
  - `CatalogApiError.fromResponse(response: Response): Promise<CatalogApiError>`, where the error exposes `status: number`, `code: string | null`, and `message: string`.
  - `createStackRelation(request: StackRelationRequest): Promise<void>`, where `StackRelationRequest = { sourceTrackId: string; targetTrackId: string; type: string; markTargetAsOriginal: boolean }`.
- Produces:
  - `GetListOptions = Readonly<{ signal?: AbortSignal; treatNotFoundAsEmpty?: boolean }>` and `getList<T>(path: string, options?: GetListOptions): Promise<ListResponse<T>>`.
  - `TrackStackTargetSearchRequest = Readonly<{ sourceTrackId: string; search: string; offset?: number; limit?: number }>` and `searchTrackStackTargets(request: TrackStackTargetSearchRequest, options?: Readonly<{ signal?: AbortSignal }>): Promise<ListResponse<TrackStackTargetDto>>`.
  - `StackRelationCommand = Readonly<{ sourceTrackId: string; targetRootTrackId: string; relationTypeCode: string; markTargetAsOriginal: boolean }>` and `createStackRelation(command: StackRelationCommand): Promise<void>`.
  - The wire mapper sends `targetRootTrackId` as JSON field `targetTrackId`; no later frontend task consumes `StackRelationRequest`.

- [ ] **Step 1: Add failing transport tests**

Create `trackStackTargetsClient.test.ts` with these complete tests:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as h from '../../../test/appTestHarness'
import { CatalogApiError } from './httpClient'
import { searchTrackStackTargets } from './trackStackTargetsClient'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('track stack targets client', () => {
  it('encodes the stack target query and forwards the abort signal', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(
        h.jsonResponse({ items: [], limit: 12, offset: 4, total: 0 }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await searchTrackStackTargets(
      {
        sourceTrackId: 'source-track',
        search: 'Blue Monday & Friends',
        offset: 4,
        limit: 12,
      },
      { signal: controller.signal },
    )

    const [input, init] = fetchMock.mock.calls[0]
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()
    const url = new URL(rawUrl, window.location.origin)

    expect(rawUrl).toContain('search=Blue+Monday+%26+Friends')
    expect(url.pathname).toBe('/api/tracks/stack-targets')
    expect(url.searchParams.get('sourceTrackId')).toBe('source-track')
    expect(url.searchParams.get('search')).toBe('Blue Monday & Friends')
    expect(url.searchParams.get('offset')).toBe('4')
    expect(url.searchParams.get('limit')).toBe('12')
    expect(init).toMatchObject({
      credentials: 'include',
      method: 'GET',
      signal: controller.signal,
    })
    expect(init?.signal).toBe(controller.signal)
  })

  it('uses offset zero and limit twenty by default', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(
        h.jsonResponse({ items: [], limit: 20, offset: 0, total: 0 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await searchTrackStackTargets({
      sourceTrackId: 'source-track',
      search: 'bass',
    })

    const [input] = fetchMock.mock.calls[0]
    const url = new URL(String(input), window.location.origin)
    expect(url.searchParams.get('offset')).toBe('0')
    expect(url.searchParams.get('limit')).toBe('20')
  })

  it('throws the typed API error for an inaccessible source', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValue(
          h.jsonResponse(
            { code: 'track.not_found', message: 'Track was not found' },
            404,
          ),
        ),
    )

    const error = await searchTrackStackTargets({
      sourceTrackId: 'missing-track',
      search: 'bass',
    }).catch((value: unknown) => value)

    expect(error).toBeInstanceOf(CatalogApiError)
    expect(error).toMatchObject({
      status: 404,
      code: 'track.not_found',
      message: 'Track was not found',
    })
  })
})
```

- [ ] **Step 2: Run the client tests and confirm missing exports**

Run:

```bash
npm --prefix app test -- src/features/catalog/api/trackStackTargetsClient.test.ts
```

Expected: FAIL because the DTOs and client do not exist and `getList` cannot forward a signal.

- [ ] **Step 3: Add DTOs and request types**

Add to `catalogDtoTypes.ts`:

```ts
export type TrackStackTargetMatchedMemberDto = {
  trackId: string
  title: string
  artistDisplay: string
}

export type TrackStackTargetDto = {
  rootTrackId: string
  title: string
  artistDisplay: string
  versionYear?: number | null
  memberCount: number
  matchedMember?: TrackStackTargetMatchedMemberDto | null
}
```

Define the client request next to its transport:

```ts
export type TrackStackTargetSearchRequest = Readonly<{
  sourceTrackId: string
  search: string
  offset?: number
  limit?: number
}>
```

- [ ] **Step 4: Extend list transport without changing legacy callers**

Use this backward-compatible shape:

```ts
export type GetListOptions = Readonly<{
  signal?: AbortSignal
  treatNotFoundAsEmpty?: boolean
}>

export async function getList<T>(
  path: string,
  options: GetListOptions = {},
): Promise<ListResponse<T>> {
  const requestInit: RequestInit = {
    credentials: 'include',
    method: 'GET',
  }
  if (options.signal) {
    requestInit.signal = options.signal
  }

  const response = await fetch(path, requestInit)

  if (!response.ok) {
    if (response.status === 404 && options.treatNotFoundAsEmpty !== false) {
      return { items: [], limit: 0, offset: 0, total: 0 }
    }

    throw await CatalogApiError.fromResponse(response)
  }

  const body = (await response.json()) as ListResponse<T>
  assertNoCollectionIds(body)

  return body
}
```

Constructing `RequestInit` conditionally is required: existing protocol tests assert the exact legacy `fetch` options and must not start receiving `signal: undefined`. Do not change `getAllPages` behavior; existing list clients continue using the default `404 -> empty list` compatibility.

- [ ] **Step 5: Implement the stack-target client**

Create `trackStackTargetsClient.ts` as this complete file:

```ts
import type { ListResponse, TrackStackTargetDto } from './catalogTypes'
import { getList } from './httpClient'

export type TrackStackTargetSearchRequest = Readonly<{
  sourceTrackId: string
  search: string
  offset?: number
  limit?: number
}>

export async function searchTrackStackTargets(
  request: TrackStackTargetSearchRequest,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<ListResponse<TrackStackTargetDto>> {
  const params = new URLSearchParams({
    sourceTrackId: request.sourceTrackId,
    search: request.search,
    offset: String(request.offset ?? 0),
    limit: String(request.limit ?? 20),
  })

  return getList<TrackStackTargetDto>(
    `/api/tracks/stack-targets?${params.toString()}`,
    {
      signal: options.signal,
      treatNotFoundAsEmpty: false,
    },
  )
}
```

- [ ] **Step 6: Normalize the mutation command**

Replace `StackRelationRequest` with:

```ts
export type StackRelationCommand = Readonly<{
  sourceTrackId: string
  targetRootTrackId: string
  relationTypeCode: string
  markTargetAsOriginal: boolean
}>
```

Replace the complete old `createStackRelation` function so both the in-memory test catalog and server-backed catalog use the identifier command:

```ts
export async function createStackRelation(
  command: StackRelationCommand,
): Promise<void> {
  if (
    updateTestCatalogState((state) => {
      const sourceTrack = state.tracks.find(
        (track) => track.id === command.sourceTrackId,
      )
      const targetRootTrack = state.tracks.find(
        (track) => track.id === command.targetRootTrackId,
      )

      if (!sourceTrack || !targetRootTrack) {
        return state
      }

      const relationTypeCode = toTrackRelationTypeCode(command.relationTypeCode)
      const relationExists = state.relations.some(
        (relation) =>
          relation.sourceLink?.kind === 'track' &&
          relation.sourceLink.id === command.sourceTrackId &&
          relation.targetLink?.kind === 'track' &&
          relation.targetLink.id === command.targetRootTrackId &&
          toTrackRelationTypeCode(relation.relationType) === relationTypeCode,
      )
      const nextRelation: RelationRecord = {
        id: crypto.randomUUID(),
        source: sourceTrack.title,
        sourceLink: { kind: 'track', id: sourceTrack.id },
        sourceType: 'Track',
        target: targetRootTrack.title,
        targetLink: { kind: 'track', id: targetRootTrack.id },
        targetType: 'Track',
        relationType: relationTypeCode,
        role: '',
        context: '',
        evidence: '',
        linkedEntity: targetRootTrack.title,
        linkedEntityLink: { kind: 'track', id: targetRootTrack.id },
        linkedEntityType: 'Track',
        direction: '',
        searchHints: [
          sourceTrack.title,
          targetRootTrack.title,
          relationTypeCode,
        ],
      }

      return {
        ...state,
        tracks: state.tracks.map((track) =>
          track.id === command.targetRootTrackId && command.markTargetAsOriginal
            ? { ...track, isOriginal: true }
            : track,
        ),
        relations: relationExists
          ? state.relations
          : [...state.relations, nextRelation],
      }
    })
  ) {
    return
  }

  await sendJson<TrackRelationDto>('/api/track-relations/stack', 'POST', {
    sourceTrackId: command.sourceTrackId,
    targetTrackId: command.targetRootTrackId,
    type: toTrackRelationTypeCode(command.relationTypeCode),
    markTargetAsOriginal: command.markTargetAsOriginal,
  })
}
```

Update the current `TracksWorkspace.handleCreateStackRelation` call at the same time so the repository remains type-correct before the later DnD boundary refactor:

```ts
await createStackRelation({
  sourceTrackId: sourceTrack.id,
  targetRootTrackId: targetRootTrack.id,
  relationTypeCode,
  markTargetAsOriginal: targetWasStandalone && !targetRootTrack.isOriginal,
})
```

- [ ] **Step 7: Run the focused client test and typecheck**

```bash
npm --prefix app test -- \
  src/features/catalog/api/trackStackTargetsClient.test.ts \
  src/features/catalog/catalogApi.protocol.test.ts
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit the client boundary**

```bash
git add app/src/features/catalog/api/catalogDtoTypes.ts app/src/features/catalog/api/httpClient.ts app/src/features/catalog/api/trackStackTargetsClient.ts app/src/features/catalog/api/trackStackTargetsClient.test.ts app/src/features/catalog/api/ownedRelationsClient.ts app/src/features/tracks/TracksWorkspace.tsx
git commit -m "feat(app): add cancellable stack target client"
```

---

### Task 5: Share Source Eligibility, Stack Rows, Relation Options, and Command Construction

**Files:**

- Modify: `app/src/features/tracks/trackStackModel.ts`
- Modify: `app/src/features/tracks/TrackStacksPanel.tsx`
- Modify: `app/src/features/tracks/TrackStackMemberGroups.tsx`
- Create: `app/src/features/tracks/TrackStackFacts.tsx`
- Create: `app/src/features/tracks/trackStackModel.test.ts`

**Interfaces:**

- Consumes:
  - `buildTrackStacks(tracks: TrackRecord[], relations: RelationRecord[], relationTypeValues: Set<string>): TrackStackRow[]`.
  - `buildTrackStacksFromServer(stackDtos: TrackStackDto[], tracks: TrackRecord[]): TrackStackRow[]`.
  - `StackRelationCommand` from Task 4 plus `CatalogDictionaries`, `RelationRecord`, `TrackRecord`, and `TrackStackDto`.
- Produces:
  - Exported `TrackStackRow`, `TrackStackMember`, `TrackStackMemberGroup`, `ProductStackRelationTypeCode`, and `StackRelationTypeOption`.
  - `buildTrackStackRows(input: BuildTrackStackRowsInput): TrackStackRow[]`.
  - `isEligibleStackSource(track: TrackRecord, stacks: TrackStackRow[]): boolean`.
  - `canDragStackTrack(track: TrackRecord, row: TrackStackRow, stacks: TrackStackRow[]): boolean`.
  - `stackRelationTypeOptions(codes: string[], dictionaries: CatalogDictionaries): StackRelationTypeOption[]` and `stackRelationTypeValues(codes: string[], dictionaries: CatalogDictionaries): Set<string>`; empty `codes` remains empty.
  - `hasStackPath(sourceTrackId: string, targetTrackId: string, relations: RelationRecord[], codes: string[], dictionaries: CatalogDictionaries): boolean` and `existingStackRelationTypeCode(sourceTrackId: string, targetTrackId: string, relations: RelationRecord[], codes: string[], dictionaries: CatalogDictionaries): string | null`; empty `codes` disables both.
  - `buildStackRelationCommand(sourceTrackId: string, targetRootTrackId: string, relationTypeCode: string, markTargetAsOriginal: boolean): StackRelationCommand`.

- [ ] **Step 1: Add failing model tests**

Create `trackStackModel.test.ts` with this complete coverage:

```ts
import { describe, expect, it } from 'vitest'
import type { TrackStackDto } from '../catalog/api/catalogDtoTypes'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import type { RelationRecord } from '../relations/relationsData'
import {
  buildStackRelationCommand,
  buildTrackStackRows,
  canDragStackTrack,
  existingStackRelationTypeCode,
  hasStackPath,
  isEligibleStackSource,
  stackRelationTypeOptions,
  stackRelationTypeValues,
} from './trackStackModel'
import type { TrackRecord } from './tracksData'

describe('track stack assignment model', () => {
  it('allows a top-level track with no members to start stack assignment', () => {
    const { localRows, serverRows, source } = projections()
    expect(isEligibleStackSource(source, localRows)).toBe(true)
    expect(isEligibleStackSource(source, serverRows)).toBe(true)
  })

  it('rejects a stack root that has members', () => {
    const { localRows, root, serverRows } = projections()
    expect(isEligibleStackSource(root, localRows)).toBe(false)
    expect(isEligibleStackSource(root, serverRows)).toBe(false)
  })

  it('rejects a track that is a member of another stack', () => {
    const { localRows, member, serverRows } = projections()
    expect(isEligibleStackSource(member, localRows)).toBe(false)
    expect(isEligibleStackSource(member, serverRows)).toBe(false)
  })

  it('keeps all relation helpers disabled when stack settings are empty', () => {
    const { member, relations, root } = projections()
    expect(stackRelationTypeOptions([], defaultCatalogDictionaries)).toEqual([])
    expect([
      ...stackRelationTypeValues([], defaultCatalogDictionaries),
    ]).toEqual([])
    expect(
      hasStackPath(
        member.id,
        root.id,
        relations,
        [],
        defaultCatalogDictionaries,
      ),
    ).toBe(false)
    expect(
      hasStackPath(root.id, root.id, relations, [], defaultCatalogDictionaries),
    ).toBe(false)
    expect(
      existingStackRelationTypeCode(
        member.id,
        root.id,
        relations,
        [],
        defaultCatalogDictionaries,
      ),
    ).toBeNull()
  })

  it('only lets a standalone row original start a drag', () => {
    const { localRows, member, root, source } = projections()
    const sourceRow = localRows.find((row) => row.original.id === source.id)!
    const rootRow = localRows.find((row) => row.original.id === root.id)!

    expect(canDragStackTrack(source, sourceRow, localRows)).toBe(true)
    expect(canDragStackTrack(root, rootRow, localRows)).toBe(false)
    expect(canDragStackTrack(member, rootRow, localRows)).toBe(false)
  })

  it('builds the identifier command with an explicit promotion flag', () => {
    expect(
      buildStackRelationCommand(
        'source-track',
        'destination-root',
        'remixOf',
        false,
      ),
    ).toEqual({
      sourceTrackId: 'source-track',
      targetRootTrackId: 'destination-root',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: false,
    })
  })
})

function projections() {
  const source = track('source-track', 'Source Track')
  const root = track('destination-root', 'Destination Root', true)
  const member = track('destination-member', 'Destination Member')
  const tracks = [source, root, member]
  const relations = [relation(member, root)]
  const dto = stackDto(root, member)

  return {
    source,
    root,
    member,
    relations,
    localRows: buildTrackStackRows({
      dictionaries: defaultCatalogDictionaries,
      relations,
      serverStacks: null,
      stackRelationTypeCodes: ['versionOf'],
      tracks,
    }),
    serverRows: buildTrackStackRows({
      dictionaries: defaultCatalogDictionaries,
      relations,
      serverStacks: [dto],
      stackRelationTypeCodes: ['versionOf'],
      tracks,
    }),
  }
}

function track(id: string, title: string, isOriginal = false): TrackRecord {
  return {
    id,
    title,
    artist: 'Test Artist',
    release: {
      title: 'Test Release',
      artist: 'Test Artist',
      year: '1998',
      label: 'Test Label',
    },
    trackNumber: '1',
    duration: '3:46',
    isOriginal,
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
  }
}

function relation(source: TrackRecord, target: TrackRecord): RelationRecord {
  return {
    id: 'relation-version',
    source: source.title,
    sourceLink: { kind: 'track', id: source.id },
    sourceType: 'Track',
    target: target.title,
    targetLink: { kind: 'track', id: target.id },
    targetType: 'Track',
    relationType: 'versionOf',
    role: '',
    context: '',
    evidence: '',
    linkedEntity: target.title,
    linkedEntityLink: { kind: 'track', id: target.id },
    linkedEntityType: 'Track',
    direction: '',
    searchHints: [],
  }
}

function stackDto(root: TrackRecord, member: TrackRecord): TrackStackDto {
  return {
    originalTrackId: root.id,
    originalTitle: root.title,
    originalVersionYear: 1998,
    memberCount: 1,
    hasCycleIssue: false,
    members: [
      {
        trackId: member.id,
        title: member.title,
        versionYear: 1998,
        relationType: 'versionOf',
        depth: 1,
        isDirect: true,
      },
    ],
    issues: [],
  }
}
```

- [ ] **Step 2: Run the model test and observe missing helpers/fallback failure**

```bash
npm --prefix app test -- src/features/tracks/trackStackModel.test.ts
```

Expected: FAIL because row types are not exported, no shared eligibility helper exists, and empty settings currently fall back to product defaults.

- [ ] **Step 3: Export row types from the model and remove duplicates**

Replace the imports/product-code declarations at the top of `trackStackModel.ts` and move the panel-owned row types into the model using this exact block. Delete the duplicate `TrackStackRow`, `TrackStackMember`, `TrackStackMemberGroup`, and `ProductStackRelationTypeCode` declarations from `TrackStacksPanel.tsx`; `StackRelationTypeOption` already lives only in the model and becomes exported there.

```ts
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import type { CatalogDictionaries, TrackStackDto } from '../catalog/catalogApi'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from './tracksData'

export const productStackRelationTypeCodes = ['remixOf', 'versionOf'] as const
export const defaultTrackStackRelationTypeCodes = [
  ...productStackRelationTypeCodes,
]

export type ProductStackRelationTypeCode =
  (typeof productStackRelationTypeCodes)[number]

export type TrackStackMember = {
  track: TrackRecord
  relationType: string
  depth: number
  isDirect: boolean
}

export type TrackStackMemberGroup = {
  key: ProductStackRelationTypeCode | 'other'
  label: string
  members: TrackStackMember[]
}

export type TrackStackRow = {
  id: string
  original: TrackRecord
  members: TrackStackMember[]
  hasCycleIssue: boolean
}

export type StackRelationTypeOption = {
  code: string
  label: string
}
```

Keep the remaining existing imports that the model still uses; combine duplicate imports when formatting.

- [ ] **Step 4: Add one unfiltered builder and eligibility helper**

```ts
export type BuildTrackStackRowsInput = Readonly<{
  dictionaries: CatalogDictionaries
  relations: RelationRecord[]
  serverStacks?: TrackStackDto[] | null
  stackRelationTypeCodes: string[]
  tracks: TrackRecord[]
}>

export function buildTrackStackRows(
  input: BuildTrackStackRowsInput,
): TrackStackRow[] {
  const serverStacks = input.serverStacks
  if (serverStacks !== null && serverStacks !== undefined) {
    return buildTrackStacksFromServer(serverStacks, input.tracks)
  }

  return buildTrackStacks(
    input.tracks,
    input.relations,
    stackRelationTypeValues(input.stackRelationTypeCodes, input.dictionaries),
  )
}

export function isEligibleStackSource(
  track: TrackRecord,
  stacks: TrackStackRow[],
) {
  const ownRow = stacks.find((stack) => stack.original.id === track.id)
  const isMember = stacks.some((stack) =>
    stack.members.some((member) => member.track.id === track.id),
  )

  return ownRow !== undefined && ownRow.members.length === 0 && !isMember
}

export function canDragStackTrack(
  track: TrackRecord,
  stack: TrackStackRow,
  stacks: TrackStackRow[],
): boolean {
  return track.id === stack.original.id && isEligibleStackSource(track, stacks)
}
```

This exact function replaces the existing `(track, stack, stackMemberTrackIds)` implementation; do not retain both overload-shaped declarations.

Annotate the two existing builders so the shared return contract remains explicit:

```ts
export function buildTrackStacks(
  tracks: TrackRecord[],
  relations: RelationRecord[],
  relationTypeValues: Set<string>,
): TrackStackRow[] {
```

```ts
export function buildTrackStacksFromServer(
  stackDtos: TrackStackDto[],
  tracks: TrackRecord[],
): TrackStackRow[] {
```

- [ ] **Step 5: Remove the empty-settings fallback**

Replace the four helpers with these fallback-free implementations. The non-server workspace already supplies `defaultTrackStackRelationTypeCodes`; an empty server setting now means exactly “no enabled stack relation types.”

```ts
export function stackRelationTypeOptions(
  stackRelationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
): StackRelationTypeOption[] {
  const options: StackRelationTypeOption[] = []
  const seenCodes = new Set<string>()

  for (const relationTypeCode of stackRelationTypeCodes) {
    const code = normalizeTrackRelationTypeCode(relationTypeCode, dictionaries)
    if (seenCodes.has(code)) {
      continue
    }

    seenCodes.add(code)
    options.push({
      code,
      label: stackRelationTypeChoiceLabel(code, dictionaries),
    })
  }

  return options
}

export function hasStackPath(
  sourceTrackId: string,
  targetTrackId: string,
  relations: RelationRecord[],
  stackRelationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
): boolean {
  const stackRelationTypeCodeSet = new Set(
    stackRelationTypeCodes.map((code) =>
      normalizeTrackRelationTypeCode(code, dictionaries),
    ),
  )
  if (stackRelationTypeCodeSet.size === 0) {
    return false
  }

  const outgoing = new Map<string, string[]>()
  for (const relation of relations) {
    const relationTypeCode = normalizeTrackRelationTypeCode(
      relation.relationType,
      dictionaries,
    )
    if (!stackRelationTypeCodeSet.has(relationTypeCode)) {
      continue
    }

    const sourceId =
      relation.sourceLink?.kind === 'track' ? relation.sourceLink.id : null
    const targetId =
      relation.targetLink?.kind === 'track' ? relation.targetLink.id : null
    if (!sourceId || !targetId) {
      continue
    }

    outgoing.set(sourceId, [...(outgoing.get(sourceId) ?? []), targetId])
  }

  const visited = new Set<string>()
  const queue = [sourceTrackId]
  while (queue.length > 0) {
    const trackId = queue.shift()
    if (!trackId || visited.has(trackId)) {
      continue
    }
    if (trackId === targetTrackId) {
      return true
    }

    visited.add(trackId)
    queue.push(...(outgoing.get(trackId) ?? []))
  }

  return false
}

export function existingStackRelationTypeCode(
  sourceTrackId: string,
  targetTrackId: string,
  relations: RelationRecord[],
  stackRelationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
): string | null {
  const stackRelationTypeCodeSet = new Set(
    stackRelationTypeCodes.map((code) =>
      normalizeTrackRelationTypeCode(code, dictionaries),
    ),
  )
  if (stackRelationTypeCodeSet.size === 0) {
    return null
  }

  for (const relation of relations) {
    const sourceId =
      relation.sourceLink?.kind === 'track' ? relation.sourceLink.id : null
    const targetId =
      relation.targetLink?.kind === 'track' ? relation.targetLink.id : null
    if (sourceId !== sourceTrackId || targetId !== targetTrackId) {
      continue
    }

    const relationTypeCode = normalizeTrackRelationTypeCode(
      relation.relationType,
      dictionaries,
    )
    if (stackRelationTypeCodeSet.has(relationTypeCode)) {
      return relationTypeCode
    }
  }

  return null
}

export function stackRelationTypeValues(
  stackRelationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
): Set<string> {
  const values = new Set<string>()

  for (const relationTypeCode of stackRelationTypeCodes) {
    const code = normalizeTrackRelationTypeCode(relationTypeCode, dictionaries)
    values.add(code)

    const name = dictionaries.trackRelationType.find(
      (entry) => entry.code === code,
    )?.name
    if (name) {
      values.add(name)
    }
  }

  for (const entry of dictionaries.trackRelationType) {
    if (
      values.has(entry.code) ||
      values.has(normalizeTrackRelationTypeCode(entry.name, dictionaries))
    ) {
      values.add(entry.name)
    }
  }

  return values
}
```

- [ ] **Step 6: Add the command builder**

```ts
export function buildStackRelationCommand(
  sourceTrackId: string,
  targetRootTrackId: string,
  relationTypeCode: string,
  markTargetAsOriginal: boolean,
): StackRelationCommand {
  return {
    sourceTrackId,
    targetRootTrackId,
    relationTypeCode,
    markTargetAsOriginal,
  }
}
```

- [ ] **Step 7: Use the shared row builder in `TrackStacksPanel`**

In `TrackStacksPanel.tsx`, replace the affected imports with:

```ts
import { trackArtistDisplay, trackReleaseDisplay } from './trackDisplayHelpers'
import { TrackStackFacts } from './TrackStackFacts'
import { TrackStackMemberGroups } from './TrackStackMemberGroups'
import type { TrackRecord } from './tracksData'
import {
  buildTrackStackRows,
  canDragStackTrack,
  canDropOnStack,
  existingStackRelationTypeCode,
  hasStackPath,
  stackRelationTypeOptions,
  trackStackMemberGroups,
  trackStackRootClassName,
  type TrackStackRow,
} from './trackStackModel'
```

Remove the old direct `ratingValueFor`, `buildTrackStacks`, `buildTrackStacksFromServer`, and `stackRelationTypeValues` imports. Replace the projection section with:

```ts
const stackRows = useMemo(
  () =>
    buildTrackStackRows({
      dictionaries,
      relations,
      serverStacks,
      stackRelationTypeCodes,
      tracks,
    }),
  [dictionaries, relations, serverStacks, stackRelationTypeCodes, tracks],
)
const visibleTrackIds = useMemo(
  () => new Set(visibleTracks.map((track) => track.id)),
  [visibleTracks],
)
const stacks = useMemo(
  () =>
    stackRows.filter(
      (stack) =>
        visibleTrackIds.has(stack.original.id) ||
        stack.members.some((member) => visibleTrackIds.has(member.track.id)),
    ),
  [stackRows, visibleTrackIds],
)
```

Delete `stackMemberTrackIds`. Change both drag checks to use the unfiltered projection:

```ts
if (!canDragStackTrack(track, stack, stackRows)) {
```

```ts
const canDragRoot = canDragStackTrack(stack.original, stack, stackRows)
```

Keep all other DnD behavior unchanged in this task.

Because the row/member/group types now live in `trackStackModel.ts`, update the dependent import exactly:

```ts
import {
  trackRelationTypeDisplay,
  trackStackMemberClassName,
  type TrackStackMember,
  type TrackStackMemberGroup,
  type TrackStackRow,
} from './trackStackModel'
```

Delete the old inline `TrackStackFactsProps` and `TrackStackFacts` from the panel. Create `TrackStackFacts.tsx` as this complete file:

```tsx
import type { RatingCriterion } from '../catalog/catalogApi'
import { ratingValueFor } from '../ratings/ratingUtils'
import type { TrackStackRow } from './trackStackModel'
import type { TrackRecord } from './tracksData'

type TrackStackFactsProps = Readonly<{
  ratingCriteria: RatingCriterion[]
  stack: TrackStackRow
  track: TrackRecord
}>

export function TrackStackFacts({
  ratingCriteria,
  stack,
  track,
}: TrackStackFactsProps) {
  return (
    <div className="track-stack-facts">
      <span>{track.versionYear ?? 'No year'}</span>
      <span>{track.duration}</span>
      <span>{stack.members.length} versions</span>
      <span>{track.releaseAppearances.length} releases</span>
      {stack.hasCycleIssue ? <span>Cycle issue</span> : null}
      {ratingCriteria.map((criterion) => (
        <span key={criterion.id}>
          {criterion.name}: {ratingValueFor(track.ratings, criterion.id) ?? '-'}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Run model, panel, and size checks**

```bash
npm --prefix app test -- src/features/tracks/trackStackModel.test.ts src/features/tracks/TrackStacksPanel.test.tsx
npm --prefix app run typecheck
npm --prefix app run file-size:check
```

Expected: PASS and `TrackStacksPanel.tsx` remains below 600 lines.

- [ ] **Step 9: Commit the shared model**

```bash
git add app/src/features/tracks/trackStackModel.ts app/src/features/tracks/trackStackModel.test.ts app/src/features/tracks/TrackStacksPanel.tsx app/src/features/tracks/TrackStackMemberGroups.tsx app/src/features/tracks/TrackStackFacts.tsx
git commit -m "refactor(app): share track stack assignment model"
```

---

### Task 6: Write the Failing Search and Paging Contract (RED, No Production)

**Files:**

- Create: `app/src/features/tracks/TrackStackPickerDialog.search.test.tsx`
- Create: `app/src/features/tracks/TrackStackPickerDialog.testUtils.tsx`

**Interfaces:**

- Consumes:
  - `searchTrackStackTargets(request: TrackStackTargetSearchRequest, options?: Readonly<{ signal?: AbortSignal }>): Promise<ListResponse<TrackStackTargetDto>>`.
  - `useDebouncedValue<Value>(value: Value, delayMs: number): Value` and `trackArtistDisplay(track: TrackRecord): string`.
  - `TrackRecord`, `TrackStackTargetDto`, `StackRelationCommand`, and `StackRelationTypeOption`.
- Defines the production contract that the failing tests require from Task 7:
  - `TrackStackTargetSearch = typeof searchTrackStackTargets`.
  - `TrackStackPickerAssignedResult = Readonly<{ destination: TrackStackTargetDto; relationType: StackRelationTypeOption }>`.
  - Exported `TrackStackPickerDialogProps` with the exact prop signatures below and `TrackStackPickerDialog(props: TrackStackPickerDialogProps): ReactElement`.
  - Exact accessible names consumed by tests and Task 7: `Source track`, `Destination stack`, `Search stacks`, `Destination stack` radio group, `Relation type` radio group, `Close stack picker`, `Retry stack search`, and `Retry loading more stacks`.
  - Test helpers from `TrackStackPickerDialog.testUtils.tsx`: `renderPicker`, `openRelationStep`, `page`, `target`, `deferred`, and `apiError`.

- [ ] **Step 1: Define the dialog boundary and add failing Step 1 tests**

Use this prop contract:

```ts
export type TrackStackPickerAssignedResult = Readonly<{
  destination: TrackStackTargetDto
  relationType: StackRelationTypeOption
}>

export type TrackStackTargetSearch = typeof searchTrackStackTargets

export type TrackStackPickerDialogProps = Readonly<{
  sourceTrack: TrackRecord
  relationTypeOptions: readonly StackRelationTypeOption[]
  returnFocusRef: RefObject<HTMLButtonElement | null>
  searchTargets?: TrackStackTargetSearch
  onSubmit: (command: StackRelationCommand) => Promise<void>
  onAssigned: (result: TrackStackPickerAssignedResult) => void
  onSourceInvalid: () => void
  onClose: () => void
}>
```

Create `TrackStackPickerDialog.testUtils.tsx` so all picker tests use the same complete fixtures:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { vi } from 'vitest'
import type {
  ListResponse,
  TrackStackTargetDto,
} from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import {
  TrackStackPickerDialog,
  type TrackStackPickerDialogProps,
  type TrackStackTargetSearch,
} from './TrackStackPickerDialog'
import type { TrackRecord } from './tracksData'

type PickerOverrides = Partial<
  Omit<TrackStackPickerDialogProps, 'returnFocusRef'>
>

export function renderPicker(overrides: PickerOverrides = {}) {
  const returnFocusRef = createRef<HTMLButtonElement>()
  const searchTargets =
    overrides.searchTargets ??
    vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValue(page([target()], { total: 1 }))
  const onSubmit =
    overrides.onSubmit ??
    vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockResolvedValue(undefined)
  const onAssigned = overrides.onAssigned ?? vi.fn()
  const onSourceInvalid = overrides.onSourceInvalid ?? vi.fn()
  const onClose = overrides.onClose ?? vi.fn()

  let props: TrackStackPickerDialogProps = {
    sourceTrack: sourceTrack(),
    relationTypeOptions: [
      { code: 'remixOf', label: 'Remix' },
      { code: 'versionOf', label: 'Version' },
    ],
    returnFocusRef,
    searchTargets,
    onSubmit,
    onAssigned,
    onSourceInvalid,
    onClose,
    ...overrides,
  }

  const rendered = render(<PickerHarness props={props} />)

  return {
    ...rendered,
    entryButton: rendered.getByRole('button', { name: 'Add to stack...' }),
    onAssigned,
    onClose,
    onSourceInvalid,
    onSubmit,
    searchTargets,
    rerenderPicker(next: PickerOverrides) {
      props = { ...props, ...next }
      rendered.rerender(<PickerHarness props={props} />)
    },
  }
}

export async function openRelationStep(query = 'bass', view = renderPicker()) {
  const user = userEvent.setup()
  await user.type(
    screen.getByRole('searchbox', { name: 'Search stacks' }),
    query,
  )
  await user.click(
    await screen.findByRole('radio', { name: /Destination Root/ }),
  )
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  return { user, view }
}

export function sourceTrack(): TrackRecord {
  return {
    id: 'source-track',
    title: 'Source Track',
    artist: 'Source Artist',
    release: {
      id: 'source-release',
      title: 'Source Release',
      artist: 'Source Artist',
      year: '1998',
      label: 'Source Label',
    },
    trackNumber: '1',
    duration: '3:46',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
  }
}

export function target(
  overrides: Partial<TrackStackTargetDto> = {},
): TrackStackTargetDto {
  return {
    rootTrackId: 'destination-root',
    title: 'Destination Root',
    artistDisplay: 'Destination Artist',
    versionYear: 1994,
    memberCount: 2,
    matchedMember: null,
    ...overrides,
  }
}

export function page(
  items: TrackStackTargetDto[],
  overrides: Partial<Omit<ListResponse<TrackStackTargetDto>, 'items'>> = {},
): ListResponse<TrackStackTargetDto> {
  return {
    items,
    limit: 20,
    offset: 0,
    total: items.length,
    ...overrides,
  }
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

export function apiError(code: string, status = 409) {
  return CatalogApiError.fromResponse(
    new Response(JSON.stringify({ code, message: 'Server message' }), {
      headers: { 'Content-Type': 'application/json' },
      status,
    }),
  )
}

function PickerHarness({ props }: { props: TrackStackPickerDialogProps }) {
  return (
    <>
      <button ref={props.returnFocusRef} type="button">
        Add to stack...
      </button>
      <TrackStackPickerDialog {...props} />
    </>
  )
}
```

Create `TrackStackPickerDialog.search.test.tsx` with these runnable tests:

```tsx
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrackStackTargetSearch } from './TrackStackPickerDialog'
import {
  deferred,
  page,
  renderPicker,
  target,
} from './TrackStackPickerDialog.testUtils'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TrackStackPickerDialog search', () => {
  it('focuses search and shows the pinned source summary', async () => {
    renderPicker()
    const dialog = screen.getByRole('dialog', {
      name: 'Choose destination stack',
    })
    expect(within(dialog).getByText('Step 1 of 2')).toBeVisible()
    const source = within(dialog).getByRole('region', { name: 'Source track' })
    expect(source).toHaveTextContent('Source Track')
    expect(source).toHaveTextContent('Source Artist')
    await waitFor(() =>
      expect(
        within(dialog).getByRole('searchbox', { name: 'Search stacks' }),
      ).toHaveFocus(),
    )
  })

  it('does not search a trimmed query shorter than two characters', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const searchTargets = vi.fn<TrackStackTargetSearch>()
    renderPicker({ searchTargets })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      ' a ',
    )
    await advance(500)
    expect(searchTargets).not.toHaveBeenCalled()
  })

  it('debounces search by two hundred fifty milliseconds', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValue(page([]))
    renderPicker({ searchTargets })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    await advance(249)
    expect(searchTargets).not.toHaveBeenCalled()
    await advance(1)
    expect(searchTargets).toHaveBeenCalledWith(
      { sourceTrackId: 'source-track', search: 'bass', offset: 0, limit: 20 },
      { signal: expect.any(AbortSignal) },
    )
  })

  it('aborts the prior request and ignores a stale resolved response', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const first = deferred<ReturnType<typeof page>>()
    const second = deferred<ReturnType<typeof page>>()
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    renderPicker({ searchTargets })
    const input = screen.getByRole('searchbox', { name: 'Search stacks' })
    await user.type(input, 'old')
    await advance(250)
    const firstSignal = searchTargets.mock.calls[0][1]?.signal
    expect(firstSignal?.aborted).toBe(false)
    await user.clear(input)
    await user.type(input, 'new')
    expect(firstSignal?.aborted).toBe(true)
    await advance(250)
    await act(async () => {
      second.resolve(
        page([target({ rootTrackId: 'new-root', title: 'New destination' })]),
      )
      await second.promise
    })
    expect(screen.getByRole('radio', { name: /New destination/ })).toBeVisible()
    await act(async () => {
      first.resolve(
        page([target({ rootTrackId: 'old-root', title: 'Stale destination' })]),
      )
      await first.promise
    })
    expect(
      screen.queryByRole('radio', { name: /Stale destination/ }),
    ).not.toBeInTheDocument()
  })

  it('clears pages and selection only when the normalized query changes', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValue(page([target()]))
    renderPicker({ searchTargets })
    const input = screen.getByRole('searchbox', { name: 'Search stacks' })
    await user.type(input, 'bass')
    await advance(250)
    const destination = screen.getByRole('radio', { name: /Destination Root/ })
    await user.click(destination)
    fireEvent.change(input, { target: { value: ' BASS ' } })
    await advance(250)
    expect(searchTargets).toHaveBeenCalledTimes(1)
    expect(destination).toBeChecked()
    fireEvent.change(input, { target: { value: 'different' } })
    expect(
      screen.queryByRole('radio', { name: /Destination Root/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('renders member context once for a matching destination root', async () => {
    const user = userEvent.setup()
    renderPicker({
      searchTargets: vi.fn<TrackStackTargetSearch>().mockResolvedValue(
        page([
          target({
            matchedMember: {
              trackId: 'matched-member',
              title: 'Aquagen More Bass Mix',
              artistDisplay: 'Aquagen',
            },
          }),
        ]),
      ),
    })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'aquagen',
    )
    const radio = await screen.findByRole('radio', {
      name: /Destination Root/,
    })
    const row = radio.closest('label')
    expect(row).not.toBeNull()
    expect(
      within(row!).getAllByText('Matched member: Aquagen More Bass Mix'),
    ).toHaveLength(1)
  })

  it('retries a first-page failure without showing stale results', async () => {
    const user = userEvent.setup()
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([target()]))
    renderPicker({ searchTargets })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    expect(
      await screen.findByText('Could not search stacks. Try again.'),
    ).toBeVisible()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Retry stack search' }))
    expect(
      await screen.findByRole('radio', { name: /Destination Root/ }),
    ).toBeVisible()
    expect(searchTargets.mock.calls.map(([request]) => request.offset)).toEqual(
      [0, 0],
    )
  })

  it('keeps results and selection through load-more failure and retry', async () => {
    const user = userEvent.setup()
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      target({
        rootTrackId: `destination-${index}`,
        title: `Destination ${index}`,
        artistDisplay: `Artist ${index}`,
      }),
    )
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValueOnce(page(firstPage, { total: 21 }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        page(
          [target({ rootTrackId: 'destination-20', title: 'Destination 20' })],
          {
            offset: 20,
            total: 21,
          },
        ),
      )
    renderPicker({ searchTargets })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'destination',
    )
    const selected = await screen.findByRole('radio', {
      name: /Destination 0/,
    })
    await user.click(selected)
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(
      await screen.findByText(
        'Could not load more stacks. Existing results are still available.',
      ),
    ).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(20)
    expect(selected).toBeChecked()
    await user.click(
      screen.getByRole('button', { name: 'Retry loading more stacks' }),
    )
    expect(
      await screen.findByRole('radio', { name: /Destination 20/ }),
    ).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(21)
    expect(selected).toBeChecked()
    expect(searchTargets.mock.calls.map(([request]) => request.offset)).toEqual(
      [0, 20, 20],
    )
  })

  it('requires a destination before continuing', async () => {
    const user = userEvent.setup()
    renderPicker()
    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toBeDisabled()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    const destination = await screen.findByRole('radio', {
      name: /Destination Root/,
    })
    expect(continueButton).toBeDisabled()
    await user.click(destination)
    expect(continueButton).toBeEnabled()
  })
})

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}
```

- [ ] **Step 2: Run the search tests and confirm the missing component failure**

```bash
npm --prefix app test -- src/features/tracks/TrackStackPickerDialog.search.test.tsx
```

Expected: FAIL because the dialog does not exist.

No production picker file is created in this task. The failing search suite is
kept as the first half of the atomic RED -> GREEN picker change completed in
Task 7.

---

### Task 7: Complete the Atomic Picker Implementation (GREEN)

**Files:**

- Create: `app/src/features/tracks/TrackStackPickerDialog.tsx`
- Create: `app/src/features/tracks/useTrackStackPickerDialog.ts`
- Create: `app/src/features/tracks/TrackStackPickerDialog.submit.test.tsx`
- Create: `app/src/features/tracks/TrackStackPickerDialog.accessibility.test.tsx`

**Interfaces:**

- Consumes:
  - `TrackStackPickerDialogProps`, `TrackStackPickerAssignedResult`, `TrackStackTargetSearch`, and the shared test utilities from Task 6.
  - `buildStackRelationCommand(sourceTrackId: string, targetRootTrackId: string, relationTypeCode: string, markTargetAsOriginal: boolean): StackRelationCommand`.
  - `CatalogApiError` with `status: number`, `code: string | null`, and `message: string`.
  - The selected `TrackStackTargetDto` and one explicit `StackRelationTypeOption`.
- Produces:
  - The unchanged `TrackStackPickerDialog(props: TrackStackPickerDialogProps): ReactElement` boundary.
  - Exactly one `onSubmit(StackRelationCommand)` call per confirmation; success calls `onAssigned({ destination, relationType })` and then the common close path.
  - Recovery states `source-blocked`, `destination-invalid`, `relation-invalid`, and `retryable` with the exact copy below.
  - Close, Cancel, and Escape share one close path that invokes `onClose()` and prefers `returnFocusRef.current`, falling back to the stable `#track-detail-title` if external invalidation removed the trigger; successful assignment uses the same close mechanics but prefers `#track-detail-title` because refresh removes the now-ineligible trigger.

- [ ] **Step 1: Add failing Step 2 and submission tests**

Create `TrackStackPickerDialog.submit.test.tsx` with this complete suite:

```tsx
import { act, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import type { TrackStackTargetSearch } from './TrackStackPickerDialog'
import {
  apiError,
  deferred,
  openRelationStep,
  renderPicker,
} from './TrackStackPickerDialog.testUtils'

describe('TrackStackPickerDialog submission', () => {
  it('shows complete summaries on step two with no default relation', async () => {
    await openRelationStep()
    const dialog = screen.getByRole('dialog', { name: 'Choose relation type' })
    expect(within(dialog).getByText('Step 2 of 2')).toBeVisible()
    const route = within(dialog).getByRole('region', {
      name: 'Stack assignment route',
    })
    const source = within(route).getByRole('region', { name: 'Source track' })
    expect(within(source).getByText('Source Track')).toBeVisible()
    expect(within(source).getByText('Source Artist')).toBeVisible()
    const destination = within(route).getByRole('region', {
      name: 'Destination stack',
    })
    expect(within(destination).getByText('Destination Root')).toBeVisible()
    expect(within(destination).getByText('Destination Artist')).toBeVisible()
    expect(within(destination).getByText('1994 · 2 members')).toBeVisible()
    expect(route.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    for (const radio of within(dialog).getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
    expect(
      within(dialog).getByRole('button', { name: 'Add to stack' }),
    ).toBeDisabled()
  })

  it('preserves query results and destination when going back', async () => {
    const { user } = await openRelationStep()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
    ).toHaveValue('bass')
    expect(
      screen.getByRole('radio', { name: /Destination Root/ }),
    ).toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('submits the selected root and explicit relation with promotion false', async () => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockResolvedValue(undefined)
    const onAssigned = vi.fn()
    const view = renderPicker({ onAssigned, onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      sourceTrackId: 'source-track',
      targetRootTrackId: 'destination-root',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: false,
    })
    expect(onAssigned).toHaveBeenCalledWith({
      destination: expect.objectContaining({ rootTrackId: 'destination-root' }),
      relationType: { code: 'remixOf', label: 'Remix' },
    })
  })

  it('prevents duplicate submission and locks every close control while pending', async () => {
    const pending = deferred<void>()
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockReturnValue(pending.promise)
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    const add = screen.getByRole('button', { name: 'Add to stack' })
    await user.click(add)
    await user.click(add)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Close stack picker' }),
    ).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Remix' })).toBeDisabled()
    const cancelEvent = new Event('cancel', { cancelable: true })
    act(() => screen.getByRole('dialog').dispatchEvent(cancelEvent))
    expect(cancelEvent.defaultPrevented).toBe(true)
    await act(async () => {
      pending.resolve(undefined)
      await pending.promise
    })
  })

  it.each([
    [
      'track_relation.track_conflict',
      'Destination stack is no longer available. Choose another stack.',
    ],
    [
      'track_relation.stack_target_not_original',
      'Destination is no longer an original stack. Choose another stack.',
    ],
    [
      'track_relation.stack_cycle',
      'This assignment would create a stack cycle. Choose another stack.',
    ],
  ])('returns to search after destination-invalid %s', async (code, copy) => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(await apiError(code))
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(await screen.findByText(copy)).toBeVisible()
    expect(
      screen.getByRole('dialog', { name: 'Choose destination stack' }),
    ).toBeVisible()
    expect(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
    ).toHaveValue('bass')
    expect(
      screen.getByRole('radio', { name: /Destination Root/ }),
    ).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('keeps the selected values after a conflicting relation', async () => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(await apiError('track_relation.duplicate'))
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    const relation = screen.getByRole('radio', { name: 'Remix' })
    await user.click(relation)
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(
      await screen.findByText(
        'A conflicting stack relation already exists. Review the track and try again.',
      ),
    ).toBeVisible()
    expect(relation).toBeChecked()
    expect(screen.getByRole('button', { name: 'Add to stack' })).toBeEnabled()
  })

  it('keeps the selected values after a network or storage failure', async () => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(new Error('offline'))
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    const relation = screen.getByRole('radio', { name: 'Version' })
    await user.click(relation)
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(
      await screen.findByText(
        'Could not save the stack assignment. Check the connection or storage and try again.',
      ),
    ).toBeVisible()
    expect(relation).toBeChecked()
  })

  it.each(['track_relation.stack_type_invalid', 'track_relation.type_invalid'])(
    'clears a disabled relation after %s',
    async (code) => {
      const onSubmit = vi
        .fn<(command: StackRelationCommand) => Promise<void>>()
        .mockRejectedValue(await apiError(code))
      const view = renderPicker({ onSubmit })
      const { user } = await openRelationStep('bass', view)
      const relation = screen.getByRole('radio', { name: 'Remix' })
      await user.click(relation)
      await user.click(screen.getByRole('button', { name: 'Add to stack' }))
      expect(
        await screen.findByText(
          'This relation type is no longer enabled. Choose another type.',
        ),
      ).toBeVisible()
      expect(relation).not.toBeChecked()
      expect(
        screen.getByRole('button', { name: 'Add to stack' }),
      ).toBeDisabled()
    },
  )

  it('blocks a stale source mutation and requests a workspace refresh', async () => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(
        await apiError('track_relation.stack_source_not_standalone'),
      )
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(
      await screen.findByText(
        'Source track is no longer eligible for stack assignment.',
      ),
    ).toBeVisible()
    expect(view.onSourceInvalid).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Add to stack' })).toBeDisabled()
  })

  it.each([
    ['track.not_found', 404, 'Source track is no longer available.'],
    [
      'track_stack.source_not_standalone',
      409,
      'Source track is no longer eligible for stack assignment.',
    ],
  ])('blocks a stale source search after %s', async (code, status, copy) => {
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockRejectedValue(await apiError(String(code), Number(status)))
    const view = renderPicker({ searchTargets })
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    expect(await screen.findByText(String(copy))).toBeVisible()
    expect(view.onSourceInvalid).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('button', { name: 'Retry stack search' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('blocks submission when relation settings become empty', async () => {
    const view = renderPicker()
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    view.rerenderPicker({ relationTypeOptions: [] })
    expect(
      await screen.findByText('No stack relation types are enabled'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add to stack' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Add failing focus and cancellation tests**

Create `TrackStackPickerDialog.accessibility.test.tsx` with these complete tests:

```tsx
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import type { TrackStackTargetSearch } from './TrackStackPickerDialog'
import {
  deferred,
  openRelationStep,
  page,
  renderPicker,
  target,
} from './TrackStackPickerDialog.testUtils'

describe('TrackStackPickerDialog accessibility', () => {
  it('uses named radio groups for destinations and relation types', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    const destinations = await screen.findByRole('group', {
      name: 'Destination stack',
    })
    const destination = within(destinations).getByRole('radio', {
      name: /Destination Root/,
    })
    await user.click(destination)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const relations = screen.getByRole('group', { name: 'Relation type' })
    expect(
      within(relations).getByRole('radio', { name: 'Remix' }),
    ).toBeVisible()
  })

  it('supports arrow movement and Enter or Space selection', async () => {
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValue(
        page([
          target({ rootTrackId: 'first-root', title: 'First Root' }),
          target({ rootTrackId: 'second-root', title: 'Second Root' }),
        ]),
      )
    renderPicker({ searchTargets })
    const user = userEvent.setup()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'root',
    )
    const first = await screen.findByRole('radio', { name: /First Root/ })
    const second = screen.getByRole('radio', { name: /Second Root/ })
    first.focus()
    await user.keyboard('{Enter}')
    expect(first).toBeChecked()
    second.focus()
    await user.keyboard(' ')
    expect(second).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const remix = screen.getByRole('radio', { name: 'Remix' })
    const version = screen.getByRole('radio', { name: 'Version' })
    remix.focus()
    await user.keyboard('{ArrowRight}')
    expect(version).toBeChecked()
  })

  it('Cancel close and Escape do not mutate and restore entry focus', async () => {
    for (const method of ['Cancel', 'Close', 'Escape'] as const) {
      const onClose = vi.fn()
      const onSubmit = vi.fn<(command: StackRelationCommand) => Promise<void>>()
      const view = renderPicker({ onClose, onSubmit })
      const user = userEvent.setup()
      if (method === 'Escape') {
        act(() =>
          screen
            .getByRole('dialog')
            .dispatchEvent(new Event('cancel', { cancelable: true })),
        )
      } else {
        await user.click(
          screen.getByRole('button', {
            name: method === 'Close' ? 'Close stack picker' : 'Cancel',
          }),
        )
      }
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
      expect(onSubmit).not.toHaveBeenCalled()
      expect(view.entryButton).toHaveFocus()
      cleanup()
    }
  })

  it('does not close on Escape while submission is pending', async () => {
    const pending = deferred<void>()
    const onClose = vi.fn()
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockReturnValue(pending.promise)
    const view = renderPicker({ onClose, onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    const event = new Event('cancel', { cancelable: true })
    act(() => screen.getByRole('dialog').dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeVisible()
    await act(async () => {
      pending.resolve(undefined)
      await pending.promise
    })
  })

  it('announces loading and errors without relying on color', async () => {
    const pending = deferred<ReturnType<typeof page>>()
    renderPicker({
      searchTargets: vi
        .fn<TrackStackTargetSearch>()
        .mockReturnValue(pending.promise),
    })
    const user = userEvent.setup()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    const loading = await screen.findByText('Searching stacks...')
    expect(loading.closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    await act(async () => {
      pending.reject(new Error('offline'))
      await pending.promise.catch(() => undefined)
    })
    const failure = await screen.findByText(
      'Could not search stacks. Try again.',
    )
    expect(failure.closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })
})
```

- [ ] **Step 3: Run the complete picker suite and preserve the atomic RED checkpoint**

```bash
npm --prefix app test -- src/features/tracks/TrackStackPickerDialog.search.test.tsx src/features/tracks/TrackStackPickerDialog.submit.test.tsx src/features/tracks/TrackStackPickerDialog.accessibility.test.tsx
```

Expected: FAIL because neither `TrackStackPickerDialog.tsx` nor
`useTrackStackPickerDialog.ts` exists. This is the single RED checkpoint for
all search, paging, submission, recovery, focus, and keyboard behavior. Do not
create either production file before observing this failure.

- [ ] **Step 4: Implement the complete picker from the tested contract**

Keep presentation and state orchestration in two focused files so both remain
below the frontend 600-line limit. Create
`app/src/features/tracks/useTrackStackPickerDialog.ts` with this complete
implementation:

```ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from 'react'
import type { TrackStackTargetDto } from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import { searchTrackStackTargets } from '../catalog/api/trackStackTargetsClient'
import { useDebouncedValue } from '../catalog/useDebouncedValue'
import {
  buildStackRelationCommand,
  type StackRelationTypeOption,
} from './trackStackModel'
import type { TrackRecord } from './tracksData'

type PickerStep = 'destination' | 'relation'
type LoadMoreFailure = Readonly<{ offset: number; message: string }>
type MutationRecovery = Readonly<{
  kind:
    | 'destination-invalid'
    | 'relation-invalid'
    | 'retryable'
    | 'source-blocked'
  message: string
}>
type PickerState = Readonly<{
  step: PickerStep
  generation: number
  query: string
  items: TrackStackTargetDto[]
  total: number
  destination: TrackStackTargetDto | null
  selectionGeneration: number
  relationType: StackRelationTypeOption | null
  relationOptionsKey: string
  firstPageError: string
  destinationError: string
  mutationError: string
  sourceBlockedMessage: string
  loadMoreFailure: LoadMoreFailure | null
  loading: 'first' | 'more' | null
  submitting: boolean
}>
type RuntimeState = {
  request: AbortController | null
  generation: number
  appending: boolean
  submitting: boolean
  sourceBlocked: boolean
  sourceInvalidNotified: boolean
  closed: boolean
}

const initialState: PickerState = {
  step: 'destination',
  generation: 0,
  query: '',
  items: [],
  total: 0,
  destination: null,
  selectionGeneration: -1,
  relationType: null,
  relationOptionsKey: '',
  firstPageError: '',
  destinationError: '',
  mutationError: '',
  sourceBlockedMessage: '',
  loadMoreFailure: null,
  loading: null,
  submitting: false,
}
const firstPageReset: Partial<PickerState> = {
  items: [],
  total: 0,
  destination: null,
  selectionGeneration: -1,
  relationType: null,
  destinationError: '',
  mutationError: '',
  loadMoreFailure: null,
}

export type TrackStackPickerAssignedResult = Readonly<{
  destination: TrackStackTargetDto
  relationType: StackRelationTypeOption
}>
export type TrackStackTargetSearch = typeof searchTrackStackTargets
export type TrackStackPickerDialogProps = Readonly<{
  sourceTrack: TrackRecord
  relationTypeOptions: readonly StackRelationTypeOption[]
  returnFocusRef: RefObject<HTMLButtonElement | null>
  searchTargets?: TrackStackTargetSearch
  onSubmit: (command: StackRelationCommand) => Promise<void>
  onAssigned: (result: TrackStackPickerAssignedResult) => void
  onSourceInvalid: () => void
  onClose: () => void
}>

export function useTrackStackPickerDialog({
  sourceTrack,
  relationTypeOptions,
  returnFocusRef,
  searchTargets = searchTrackStackTargets,
  onSubmit,
  onAssigned,
  onSourceInvalid,
  onClose,
}: TrackStackPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const queryKeyRef = useRef('')
  const runtime = useRef<RuntimeState>({
    request: null,
    generation: 0,
    appending: false,
    submitting: false,
    sourceBlocked: false,
    sourceInvalidNotified: false,
    closed: false,
  })
  const relationOptionsKey = JSON.stringify(
    relationTypeOptions.map((option) => [option.code, option.label]),
  )
  const [state, setState] = useState(() => ({
    ...initialState,
    relationOptionsKey,
  }))
  const patch = useCallback((changes: Partial<PickerState>) => {
    setState((current) => ({ ...current, ...changes }))
  }, [])
  const queryKey = normalizeQuery(state.query)
  const debouncedQuery = useDebouncedValue(queryKey, 250)
  if (state.relationOptionsKey !== relationOptionsKey) {
    setState((current) => ({
      ...current,
      relationOptionsKey,
      relationType: current.relationType
        ? (relationTypeOptions.find(
            (option) => option.code === current.relationType?.code,
          ) ?? null)
        : null,
    }))
  }

  const finishClose = useCallback(
    (focusTarget: 'trigger' | 'detail') => {
      if (runtime.current.closed) return
      runtime.current.closed = true
      runtime.current.request?.abort()
      const dialog = dialogRef.current
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close()
        else dialog.removeAttribute('open')
      }
      onClose()
      queueMicrotask(() => {
        const detailTitle = document.querySelector<HTMLElement>(
          '#track-detail-title',
        )
        const focusTargetElement =
          focusTarget === 'detail'
            ? (detailTitle ?? returnFocusRef.current)
            : (returnFocusRef.current ?? detailTitle)
        focusTargetElement?.focus()
      })
    },
    [onClose, returnFocusRef],
  )

  const blockSource = useCallback(
    (message: string) => {
      const current = runtime.current
      current.sourceBlocked = true
      current.generation += 1
      current.request?.abort()
      current.request = null
      current.appending = false
      patch({
        generation: current.generation,
        sourceBlockedMessage: message,
        firstPageError: '',
        loadMoreFailure: null,
        loading: null,
      })
      if (!current.sourceInvalidNotified) {
        current.sourceInvalidNotified = true
        onSourceInvalid()
      }
    },
    [onSourceInvalid, patch],
  )

  const loadPage = useCallback(
    async (offset: number, append: boolean, key = queryKeyRef.current) => {
      const current = runtime.current
      if (key.length < 2 || current.sourceBlocked || current.appending) return
      current.request?.abort()
      const controller = new AbortController()
      const generation = current.generation
      current.request = controller
      current.appending = append
      if (append) patch({ loading: 'more', loadMoreFailure: null })
      else {
        patch({
          ...firstPageReset,
          firstPageError: '',
          loading: 'first',
        })
      }

      try {
        const response = await searchTargets(
          {
            sourceTrackId: sourceTrack.id,
            search: key,
            offset,
            limit: 20,
          },
          { signal: controller.signal },
        )
        if (
          !isCurrentRequest(controller, generation, key, runtime, queryKeyRef)
        )
          return
        setState((latest) => ({
          ...latest,
          items: append ? [...latest.items, ...response.items] : response.items,
          total: response.total,
          loading: null,
        }))
      } catch (error) {
        if (
          isAbortError(error) ||
          !isCurrentRequest(controller, generation, key, runtime, queryKeyRef)
        )
          return
        const blockedMessage = searchSourceErrorMessage(error)
        if (blockedMessage) {
          patch({ ...firstPageReset, firstPageError: '' })
          blockSource(blockedMessage)
        } else if (append) {
          patch({
            loadMoreFailure: {
              offset,
              message:
                'Could not load more stacks. Existing results are still available.',
            },
            loading: null,
          })
        } else {
          patch({
            items: [],
            total: 0,
            firstPageError: 'Could not search stacks. Try again.',
            loading: null,
          })
        }
      } finally {
        if (current.request === controller) {
          current.request = null
          current.appending = false
          patch({ loading: null })
        }
      }
    },
    [blockSource, patch, searchTargets, sourceTrack.id],
  )

  useEffect(() => {
    const current = runtime.current
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    return () => current.request?.abort()
  }, [])
  useEffect(() => {
    if (state.step === 'destination' && !runtime.current.closed)
      queueMicrotask(() => searchInputRef.current?.focus())
  }, [state.step])
  useEffect(() => {
    if (
      debouncedQuery.length >= 2 &&
      debouncedQuery === queryKeyRef.current &&
      !runtime.current.sourceBlocked
    )
      void loadPage(0, false, debouncedQuery)
  }, [debouncedQuery, loadPage])
  function changeQuery(nextQuery: string) {
    const nextKey = normalizeQuery(nextQuery)
    if (nextKey !== queryKeyRef.current) {
      const current = runtime.current
      current.generation += 1
      current.request?.abort()
      current.request = null
      current.appending = false
      queryKeyRef.current = nextKey
      patch({
        ...firstPageReset,
        step: 'destination',
        generation: current.generation,
        query: nextQuery,
        firstPageError: '',
        loading: null,
      })
    } else patch({ query: nextQuery })
  }

  function selectDestination(destination: TrackStackTargetDto) {
    if (runtime.current.sourceBlocked) return
    patch({
      destination,
      selectionGeneration: runtime.current.generation,
      relationType:
        state.destination?.rootTrackId === destination.rootTrackId
          ? state.relationType
          : null,
      destinationError: '',
      mutationError: '',
    })
  }

  function recoverMutation(error: unknown) {
    const recovery = mutationRecovery(error)
    if (recovery.kind === 'destination-invalid') {
      patch({
        destination: null,
        selectionGeneration: -1,
        relationType: null,
        destinationError: recovery.message,
        mutationError: '',
        step: 'destination',
      })
    } else if (recovery.kind === 'relation-invalid') {
      patch({ relationType: null, mutationError: recovery.message })
    } else if (recovery.kind === 'source-blocked') {
      patch({ mutationError: recovery.message })
      blockSource(recovery.message)
    } else patch({ mutationError: recovery.message })
  }

  async function submitAssignment() {
    const { destination, relationType } = state
    const typeEnabled = relationTypeOptions.some(
      (option) => option.code === relationType?.code,
    )
    if (
      runtime.current.submitting ||
      runtime.current.sourceBlocked ||
      !destination ||
      !relationType ||
      !typeEnabled ||
      state.selectionGeneration !== state.generation
    )
      return
    runtime.current.submitting = true
    patch({ submitting: true, mutationError: '' })
    try {
      await onSubmit(
        buildStackRelationCommand(
          sourceTrack.id,
          destination.rootTrackId,
          relationType.code,
          false,
        ),
      )
    } catch (error) {
      recoverMutation(error)
      return
    } finally {
      runtime.current.submitting = false
      patch({ submitting: false })
    }
    onAssigned({ destination, relationType })
    finishClose('detail')
  }

  const hasCurrentDestination = Boolean(
    state.destination &&
    state.selectionGeneration === state.generation &&
    state.items.some(
      (item) => item.rootTrackId === state.destination?.rootTrackId,
    ),
  )
  const typeEnabled = relationTypeOptions.some(
    (option) => option.code === state.relationType?.code,
  )
  const blocked = state.sourceBlockedMessage.length > 0

  return {
    state,
    dialogRef,
    searchInputRef,
    blocked,
    hasCurrentDestination,
    typeEnabled,
    status: searchStatus(state, queryKey, debouncedQuery),
    relationError: relationError(state, relationTypeOptions),
    changeQuery,
    selectDestination,
    selectRelationType(option: StackRelationTypeOption) {
      patch({ relationType: option, mutationError: '' })
    },
    destinationIsSelected(item: TrackStackTargetDto) {
      return (
        state.destination?.rootTrackId === item.rootTrackId &&
        state.selectionGeneration === state.generation
      )
    },
    loadFirstPage() {
      return loadPage(0, false)
    },
    loadNextPage(offset: number) {
      return loadPage(offset, true)
    },
    continueToRelation() {
      patch({ step: 'relation', mutationError: '' })
    },
    backToDestination() {
      patch({ step: 'destination', mutationError: '' })
    },
    requestClose() {
      if (!runtime.current.submitting) finishClose('trigger')
    },
    handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
      event.preventDefault()
      if (!runtime.current.submitting) finishClose('trigger')
    },
    submitAssignment,
  }
}

function normalizeQuery(value: string) {
  return value.trim().toLocaleLowerCase()
}
function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}
function isCurrentRequest(
  controller: AbortController,
  generation: number,
  key: string,
  runtime: RefObject<RuntimeState>,
  queryKey: RefObject<string>,
) {
  return (
    !controller.signal.aborted &&
    runtime.current.generation === generation &&
    queryKey.current === key
  )
}
function searchSourceErrorMessage(error: unknown) {
  if (!(error instanceof CatalogApiError)) return null
  if (error.code === 'track.not_found')
    return 'Source track is no longer available.'
  if (error.code === 'track_stack.source_not_standalone')
    return 'Source track is no longer eligible for stack assignment.'
  return null
}
function searchStatus(state: PickerState, key: string, debounced: string) {
  if (state.sourceBlockedMessage) return state.sourceBlockedMessage
  if (key.length < 2)
    return 'Enter at least two characters to search existing stacks.'
  if (state.firstPageError) return state.firstPageError
  if (key !== debounced || state.loading === 'first')
    return 'Searching stacks...'
  if (state.items.length === 0) return 'No matching existing stacks.'
  return `${state.items.length} of ${state.total} matching stacks.`
}
function relationError(
  state: PickerState,
  options: readonly StackRelationTypeOption[],
) {
  if (state.sourceBlockedMessage)
    return state.mutationError || state.sourceBlockedMessage
  if (options.length === 0) return 'No stack relation types are enabled'
  return state.mutationError
}

const destinationMissing: MutationRecovery = {
  kind: 'destination-invalid',
  message: 'Destination stack is no longer available. Choose another stack.',
}
const destinationChanged: MutationRecovery = {
  kind: 'destination-invalid',
  message: 'Destination is no longer an original stack. Choose another stack.',
}
const recoveries: Readonly<Record<string, MutationRecovery>> = {
  'track_relation.track_conflict': destinationMissing,
  'track_relation.stack_target_not_original': destinationChanged,
  'track_relation.stack_target_not_standalone': destinationChanged,
  'track_relation.stack_cycle': {
    kind: 'destination-invalid',
    message:
      'This assignment would create a stack cycle. Choose another stack.',
  },
  'track_relation.stack_type_invalid': {
    kind: 'relation-invalid',
    message: 'This relation type is no longer enabled. Choose another type.',
  },
  'track_relation.type_invalid': {
    kind: 'relation-invalid',
    message: 'This relation type is no longer enabled. Choose another type.',
  },
  'track_relation.stack_source_not_standalone': {
    kind: 'source-blocked',
    message: 'Source track is no longer eligible for stack assignment.',
  },
  'track_relation.duplicate': {
    kind: 'retryable',
    message:
      'A conflicting stack relation already exists. Review the track and try again.',
  },
}
function mutationRecovery(error: unknown): MutationRecovery {
  const code = error instanceof CatalogApiError ? error.code : null
  return code && recoveries[code]
    ? recoveries[code]
    : {
        kind: 'retryable',
        message:
          'Could not save the stack assignment. Check the connection or storage and try again.',
      }
}
```

Create `app/src/features/tracks/TrackStackPickerDialog.tsx` with this complete
implementation:

```tsx
import { ArrowRight } from 'lucide-react'
import { type KeyboardEvent, type ReactElement } from 'react'
import type { TrackStackTargetDto } from '../catalog/api/catalogDtoTypes'
import { trackArtistDisplay } from './trackDisplayHelpers'
import type { TrackRecord } from './tracksData'
import {
  useTrackStackPickerDialog,
  type TrackStackPickerDialogProps,
} from './useTrackStackPickerDialog'

export type {
  TrackStackPickerAssignedResult,
  TrackStackPickerDialogProps,
  TrackStackTargetSearch,
} from './useTrackStackPickerDialog'

export function TrackStackPickerDialog(
  props: TrackStackPickerDialogProps,
): ReactElement {
  const {
    state,
    dialogRef,
    searchInputRef,
    blocked,
    hasCurrentDestination,
    typeEnabled,
    status,
    relationError,
    changeQuery,
    selectDestination,
    selectRelationType,
    destinationIsSelected,
    loadFirstPage,
    loadNextPage,
    continueToRelation,
    backToDestination,
    requestClose,
    handleCancel,
    submitAssignment,
  } = useTrackStackPickerDialog(props)
  const loadMoreFailure = state.loadMoreFailure

  return (
    <dialog
      aria-labelledby="track-stack-picker-title"
      aria-modal="true"
      className="track-stack-picker-dialog"
      ref={dialogRef}
      onCancel={handleCancel}
    >
      {state.step === 'destination' ? (
        <>
          <DialogHeader step="Step 1 of 2" title="Choose destination stack">
            <button
              aria-label="Close stack picker"
              className="icon-button"
              type="button"
              onClick={requestClose}
            >
              Close
            </button>
          </DialogHeader>
          <section
            aria-label="Source track"
            className="track-stack-picker-source"
          >
            <strong>{props.sourceTrack.title}</strong>
            <span>{trackArtistDisplay(props.sourceTrack)}</span>
          </section>
          <label className="track-stack-picker-search">
            <span>Search stacks</span>
            <input
              disabled={blocked}
              ref={searchInputRef}
              type="search"
              value={state.query}
              onChange={(event) => changeQuery(event.currentTarget.value)}
            />
          </label>
          <p
            aria-live="polite"
            className={
              state.firstPageError || blocked
                ? 'track-stack-picker-error'
                : 'track-stack-picker-state'
            }
            role="status"
          >
            {status}
          </p>
          {state.destinationError ? (
            <p className="track-stack-picker-error" role="alert">
              {state.destinationError}
            </p>
          ) : null}
          {state.firstPageError && !blocked ? (
            <button
              aria-label="Retry stack search"
              className="button button-secondary"
              disabled={state.loading === 'first'}
              type="button"
              onClick={() => void loadFirstPage()}
            >
              Retry stack search
            </button>
          ) : null}
          {state.items.length > 0 ? (
            <fieldset className="track-stack-picker-results">
              <legend className="visually-hidden">Destination stack</legend>
              {state.items.map((item) => (
                <DestinationOption
                  blocked={blocked}
                  checked={destinationIsSelected(item)}
                  item={item}
                  key={item.rootTrackId}
                  select={() => selectDestination(item)}
                />
              ))}
            </fieldset>
          ) : null}
          {state.loading === 'more' ? (
            <p
              aria-live="polite"
              className="track-stack-picker-state"
              role="status"
            >
              Loading more stacks...
            </p>
          ) : null}
          {loadMoreFailure ? (
            <div>
              <p
                aria-live="polite"
                className="track-stack-picker-error"
                role="status"
              >
                {loadMoreFailure.message}
              </p>
              <button
                aria-label="Retry loading more stacks"
                className="button button-secondary"
                type="button"
                onClick={() => void loadNextPage(loadMoreFailure.offset)}
              >
                Retry loading more stacks
              </button>
            </div>
          ) : state.items.length < state.total ? (
            <button
              className="button button-secondary"
              disabled={state.loading === 'more' || blocked}
              type="button"
              onClick={() => void loadNextPage(state.items.length)}
            >
              Load more
            </button>
          ) : null}
          <footer className="track-stack-picker-footer">
            <button
              className="button button-secondary"
              type="button"
              onClick={requestClose}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={!hasCurrentDestination || blocked}
              type="button"
              onClick={continueToRelation}
            >
              Continue
            </button>
          </footer>
        </>
      ) : state.destination ? (
        <>
          <DialogHeader step="Step 2 of 2" title="Choose relation type">
            <button
              aria-label="Close stack picker"
              className="icon-button"
              disabled={state.submitting}
              type="button"
              onClick={requestClose}
            >
              Close
            </button>
          </DialogHeader>
          <AssignmentRoute
            destination={state.destination}
            sourceTrack={props.sourceTrack}
          />
          <fieldset className="track-stack-picker-relation-options">
            <legend>Relation type</legend>
            {props.relationTypeOptions.map((option) => (
              <label key={option.code}>
                <input
                  checked={state.relationType?.code === option.code}
                  disabled={state.submitting || blocked}
                  name="stack-relation-type"
                  type="radio"
                  value={option.code}
                  onChange={() => selectRelationType(option)}
                  onKeyDown={(event) =>
                    selectRadioOnEnter(event, () => selectRelationType(option))
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          {relationError ? (
            <p className="track-stack-picker-error" role="alert">
              {relationError}
            </p>
          ) : null}
          <footer className="track-stack-picker-footer">
            <button
              className="button button-secondary"
              disabled={state.submitting}
              type="button"
              onClick={backToDestination}
            >
              Back
            </button>
            <button
              className="button button-secondary"
              disabled={state.submitting}
              type="button"
              onClick={requestClose}
            >
              Cancel
            </button>
            <button
              aria-live="polite"
              className="button button-primary"
              disabled={
                !hasCurrentDestination ||
                !typeEnabled ||
                state.submitting ||
                blocked
              }
              type="button"
              onClick={() => void submitAssignment()}
            >
              {state.submitting ? 'Adding...' : 'Add to stack'}
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  )
}

function DialogHeader({
  step,
  title,
  children,
}: Readonly<{ step: string; title: string; children: ReactElement }>) {
  return (
    <header className="track-stack-picker-header">
      <div>
        <span className="track-stack-picker-kicker">{step}</span>
        <h2 id="track-stack-picker-title">{title}</h2>
      </div>
      {children}
    </header>
  )
}

function DestinationOption({
  blocked,
  checked,
  item,
  select,
}: Readonly<{
  blocked: boolean
  checked: boolean
  item: TrackStackTargetDto
  select: () => void
}>) {
  return (
    <label className="track-stack-picker-result">
      <input
        checked={checked}
        disabled={blocked}
        name="stack-destination"
        type="radio"
        value={item.rootTrackId}
        onChange={select}
        onKeyDown={(event) => selectRadioOnEnter(event, select)}
      />
      <span>
        <strong>{item.title}</strong>
        <span>{item.artistDisplay}</span>
        <span className="track-stack-picker-result-meta">
          {item.versionYear == null ? null : <span>{item.versionYear}</span>}
          <span>
            {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
          </span>
        </span>
        {item.matchedMember ? (
          <span className="track-stack-picker-match">
            Matched member: {item.matchedMember.title}
          </span>
        ) : null}
      </span>
    </label>
  )
}

function AssignmentRoute({
  destination,
  sourceTrack,
}: Readonly<{
  destination: TrackStackTargetDto
  sourceTrack: TrackRecord
}>) {
  return (
    <section
      aria-label="Stack assignment route"
      className="track-stack-picker-route"
    >
      <section aria-label="Source track">
        <span>Source track</span>
        <strong>{sourceTrack.title}</strong>
        <span>{trackArtistDisplay(sourceTrack)}</span>
      </section>
      <ArrowRight aria-hidden="true" size={18} />
      <section aria-label="Destination stack">
        <span>Destination stack</span>
        <strong>{destination.title}</strong>
        <span>{destination.artistDisplay}</span>
        <span>
          {destination.versionYear == null
            ? null
            : `${destination.versionYear} · `}
          {destination.memberCount}{' '}
          {destination.memberCount === 1 ? 'member' : 'members'}
        </span>
      </section>
    </section>
  )
}

function selectRadioOnEnter(
  event: KeyboardEvent<HTMLInputElement>,
  select: () => void,
) {
  if (event.key === 'Enter' && !event.currentTarget.disabled) {
    event.preventDefault()
    select()
  }
}
```

The hook owns normalized query generations, abort and stale-response guards,
offset-specific append retry, typed recovery, source invalidation, native-dialog
focus, and the synchronous submission lock. The component owns the exact
semantic classes and accessible names. Cancel, Close, and Escape prefer the
entry trigger and fall back to `#track-detail-title` if it disappeared; success
prefers `#track-detail-title` because the refreshed workspace removes the
trigger.

- [ ] **Step 5: Run the complete picker suite and static checks to GREEN**

```bash
npm --prefix app test -- src/features/tracks/TrackStackPickerDialog.search.test.tsx src/features/tracks/TrackStackPickerDialog.submit.test.tsx src/features/tracks/TrackStackPickerDialog.accessibility.test.tsx
npm --prefix app run typecheck
npm --prefix app run lint
npm --prefix app run format:check
npm --prefix app run file-size:check
```

Expected: all commands PASS. `TrackStackPickerDialog.tsx` and
`useTrackStackPickerDialog.ts` each remain below 600 lines.

- [ ] **Step 6: Commit the atomic RED -> GREEN picker change**

```bash
git add app/src/features/tracks/TrackStackPickerDialog.tsx app/src/features/tracks/useTrackStackPickerDialog.ts app/src/features/tracks/TrackStackPickerDialog.search.test.tsx app/src/features/tracks/TrackStackPickerDialog.submit.test.tsx app/src/features/tracks/TrackStackPickerDialog.accessibility.test.tsx app/src/features/tracks/TrackStackPickerDialog.testUtils.tsx
git commit -m "feat(app): add searchable track stack picker"
```

---

### Task 8: Wire the Eligible Detail Action and Workspace Success Behavior

**Files:**

- Modify: `app/src/features/tracks/TrackDetailSections.tsx`
- Modify: `app/src/features/tracks/TrackDetailSections.test.tsx`
- Modify: `app/src/features/tracks/TrackDetail.tsx`
- Modify: `app/src/features/tracks/TracksWorkspacePanels.tsx`
- Create: `app/src/features/tracks/useTrackStackRelationTypeState.ts`
- Create: `app/src/features/tracks/useTrackStackRelationTypeState.test.tsx`
- Create: `app/src/features/tracks/useTrackStackAssignment.ts`
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`
- Create: `app/src/App.track-stack-picker.test.tsx`

**Interfaces:**

- Consumes:
  - `isEligibleStackSource(track: TrackRecord, stacks: TrackStackRow[]): boolean`, `buildTrackStackRows(input: BuildTrackStackRowsInput): TrackStackRow[]`, and `stackRelationTypeOptions(codes: string[], dictionaries: CatalogDictionaries): StackRelationTypeOption[]` from Task 5.
  - `TrackStackPickerDialog`, `TrackStackPickerAssignedResult`, and `TrackStackPickerDialogProps` from Tasks 6–7.
  - `createStackRelation(command: StackRelationCommand): Promise<void>` from Task 4.
  - Existing `selectedTrack`, complete `tracks`, `relations`, `activeServerStacks`, `expandedStackIds`, `onCatalogChanged`, and stack-refresh state owned by `TracksWorkspace`.
- Produces:
  - Optional presentation props propagated unchanged through `TrackWorkspaceDetail`, `TrackDetail`, and `TrackDetailHeader`: `onAddToStack?: () => void` and `addToStackButtonRef?: Ref<HTMLButtonElement>`.
  - `useTrackStackRelationTypeState(serverBackedCatalog: boolean): TrackStackRelationTypeState`, where `TrackStackRelationTypeState = Readonly<{ codes: string[]; status: 'loading' | 'ready' | 'error' }>`.
  - `useTrackStackAssignment(input: UseTrackStackAssignmentInput): UseTrackStackAssignmentResult` with the exact contracts in Step 7.
  - Picker persistence through `handlePickerCommand(command)` with no navigation, selection, expansion, filter, query, scroll, or history side effect.
  - DnD persistence through `handleDropCommand(command)` with destination expansion in the hook and current source selection in a DnD-only workspace adapter; Task 9 changes only that adapter's input contract.
  - One persistent `role="status"` workspace announcement containing the successful source, destination, and relation label.
  - Cancel, Close, and Escape restore the entry button; successful assignment focuses the stable selected-Track heading after the now-ineligible entry action disappears.

- [ ] **Step 1: Add failing detail-header tests**

Replace the test imports with this exact set, then add these complete tests to `TrackDetailSections.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TrackDetailHeader } from './TrackDetailSections'
import type { TrackRecord } from './tracksData'
```

```tsx
it('renders the add to stack action only when a callback is supplied', () => {
  const { rerender } = render(
    <TrackDetailHeader
      canUpdateViaDiscogs={false}
      localFileCount={0}
      track={trackRecord()}
    />,
  )
  expect(
    screen.queryByRole('button', { name: 'Add to stack...' }),
  ).not.toBeInTheDocument()

  rerender(
    <TrackDetailHeader
      canUpdateViaDiscogs={false}
      localFileCount={0}
      track={trackRecord()}
      onAddToStack={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Add to stack...' })).toHaveClass(
    'button',
    'button-primary',
  )
})

it('forwards the add to stack button ref and click', async () => {
  const user = userEvent.setup()
  const onAddToStack = vi.fn()
  const addToStackButtonRef = createRef<HTMLButtonElement>()
  render(
    <TrackDetailHeader
      addToStackButtonRef={addToStackButtonRef}
      canUpdateViaDiscogs={false}
      localFileCount={0}
      track={trackRecord()}
      onAddToStack={onAddToStack}
    />,
  )
  const button = screen.getByRole('button', { name: 'Add to stack...' })
  expect(addToStackButtonRef.current).toBe(button)
  await user.click(button)
  expect(onAddToStack).toHaveBeenCalledTimes(1)
})
```

The button must have accessible name `Add to stack...` and classes `button button-primary`.

- [ ] **Step 2: Add failing workspace integration tests**

Create `App.track-stack-picker.test.tsx` with the following complete integration suite and local fetch fixture:

```tsx
import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import {
  listResponse,
  trackRelationResponse,
  trackResponse,
} from './test/trackStacksTestFixtures'

h.setupAppTestHooks()

describe('App track stack picker', () => {
  it('shows assignment for an eligible standalone selected track', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    installPickerCatalog()
    h.render(<h.App />)
    const detail = await h.screen.findByRole('complementary', {
      name: 'Incoming Mix',
    })
    expect(
      await h.within(detail).findByRole('button', {
        name: 'Add to stack...',
      }),
    ).toBeVisible()
  })

  it('omits assignment for a stack root and member', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    installPickerCatalog()
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await h.screen.findByRole('complementary', { name: 'Incoming Mix' })
    await h.screen.findByRole('button', { name: 'Add to stack...' })

    await user.click(
      h.screen.getByRole('button', { name: /Expanded Mix Root/ }),
    )
    expect(
      h
        .within(
          h.screen.getByRole('complementary', { name: 'Expanded Mix Root' }),
        )
        .queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()

    await user.click(
      h.screen.getAllByRole('button', { name: 'Expand stack' })[0],
    )
    await user.click(
      await h.screen.findByRole('button', { name: /Expanded Mix Member/ }),
    )
    expect(
      h
        .within(
          h.screen.getByRole('complementary', { name: 'Expanded Mix Member' }),
        )
        .queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()
  })

  it('omits assignment when stack relation settings are empty', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    const fixture = installPickerCatalog([])
    h.render(<h.App />)
    const detail = await h.screen.findByRole('complementary', {
      name: 'Incoming Mix',
    })
    await h.waitFor(() => {
      expect(
        fixture.fetchMock.mock.calls.some(([input]) => {
          const url = typeof input === 'string' ? input : (input as Request).url
          return url.startsWith('/api/settings/track-stack')
        }),
      ).toBe(true)
    })
    const settingsCallIndex = fixture.fetchMock.mock.calls.findIndex(
      ([input]) => {
        const url = typeof input === 'string' ? input : (input as Request).url
        return url.startsWith('/api/settings/track-stack')
      },
    )
    const settingsRequest =
      fixture.fetchMock.mock.results[settingsCallIndex]?.value
    if (!(settingsRequest instanceof Promise)) {
      throw new Error('The stack settings request was not started')
    }
    await h.act(async () => {
      await settingsRequest
    })
    expect(
      h.within(detail).queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()
  })

  it('assigns to a destination absent from the visible tracks list', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    const fixture = installPickerCatalog()
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await user.type(
      await h.screen.findByRole('searchbox', { name: 'Search tracks' }),
      'Mix',
    )
    const workspace = h.screen.getByRole('region', {
      name: 'Tracks workspace',
    })
    expect(
      h.within(workspace).queryByRole('button', { name: /Remote Destination/ }),
    ).not.toBeInTheDocument()

    await user.click(
      await h.screen.findByRole('button', { name: 'Add to stack...' }),
    )
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search stacks' }),
      'remote',
    )
    await user.click(
      await h.screen.findByRole('radio', { name: /Remote Destination/ }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Continue' }))
    await user.click(h.screen.getByRole('radio', { name: 'Remix' }))
    await user.click(h.screen.getByRole('button', { name: 'Add to stack' }))

    await h.waitFor(() => expect(fixture.postBodies).toHaveLength(1))
    expect(JSON.parse(fixture.postBodies[0])).toEqual({
      sourceTrackId: 'source-track',
      targetTrackId: 'remote-root',
      type: 'remixOf',
      markTargetAsOriginal: false,
    })
  })

  it('announces success removes the stale action and preserves workspace state', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    installPickerCatalog()
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const trackSearch = await h.screen.findByRole('searchbox', {
      name: 'Search tracks',
    })
    await user.type(trackSearch, 'Mix')
    await user.click(
      h.screen.getAllByRole('button', { name: 'Expand stack' })[0],
    )
    expect(
      h.screen.getByRole('button', { name: 'Collapse stack' }),
    ).toBeVisible()
    const workspace = h.screen.getByRole('region', {
      name: 'Tracks workspace',
    })
    const scrollContainer = workspace.querySelector(
      '.catalog-main',
    ) as HTMLElement
    scrollContainer.scrollTop = 320
    const locationBefore = window.location.href

    await user.click(
      await h.screen.findByRole('button', { name: 'Add to stack...' }),
    )
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search stacks' }),
      'remote',
    )
    await user.click(
      await h.screen.findByRole('radio', { name: /Remote Destination/ }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Continue' }))
    await user.click(h.screen.getByRole('radio', { name: 'Remix' }))
    await user.click(h.screen.getByRole('button', { name: 'Add to stack' }))

    expect(
      await h.screen.findByText(
        'Added Incoming Mix to Remote Destination as Remix.',
      ),
    ).toBeInTheDocument()
    expect(trackSearch).toHaveValue('Mix')
    expect(scrollContainer.scrollTop).toBe(320)
    expect(
      h.screen.getByRole('button', { name: 'Collapse stack' }),
    ).toBeVisible()
    const sourceDetail = h.screen.getByRole('complementary', {
      name: 'Incoming Mix',
    })
    const sourceHeading = h
      .within(sourceDetail)
      .getByRole('heading', { name: 'Incoming Mix' })
    expect(sourceHeading).toBeVisible()
    await h.waitFor(() => expect(sourceHeading).toHaveFocus())
    expect(
      h.within(sourceDetail).queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()
    expect(window.location.href).toBe(locationBefore)
  })
})

function installPickerCatalog(relationTypeCodes = ['remixOf', 'versionOf']) {
  let assigned = false
  const postBodies: string[] = []
  const fetchMock = h.vi.fn<Window['fetch']>(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    await Promise.resolve()

    if (url === '/api/track-relations/stack' && init?.method === 'POST') {
      assigned = true
      postBodies.push(typeof init.body === 'string' ? init.body : '')
      return h.jsonResponse({}, 201)
    }

    if (url.startsWith('/api/tracks/stack-targets')) {
      return h.jsonResponse({
        items: [
          {
            rootTrackId: 'remote-root',
            title: 'Remote Destination',
            artistDisplay: 'Remote Artist',
            versionYear: 1994,
            memberCount: 3,
            matchedMember: null,
          },
        ],
        limit: 20,
        offset: 0,
        total: 1,
      })
    }

    if (url.startsWith('/api/tracks/stacks')) {
      return listResponse([
        {
          originalTrackId: 'expanded-root',
          originalTitle: 'Expanded Mix Root',
          originalVersionYear: 1993,
          memberCount: 1,
          hasCycleIssue: false,
          members: [
            {
              trackId: 'expanded-member',
              title: 'Expanded Mix Member',
              versionYear: 1993,
              relationType: 'versionOf',
              depth: 1,
              isDirect: true,
            },
          ],
          issues: [],
        },
        ...(assigned
          ? [
              {
                originalTrackId: 'remote-root',
                originalTitle: 'Remote Destination',
                originalVersionYear: 1994,
                memberCount: 1,
                hasCycleIssue: false,
                members: [
                  {
                    trackId: 'source-track',
                    title: 'Incoming Mix',
                    versionYear: 1993,
                    relationType: 'remixOf',
                    depth: 1,
                    isDirect: true,
                  },
                ],
                issues: [],
              },
            ]
          : []),
      ])
    }

    if (url.startsWith('/api/settings/track-stack')) {
      return h.jsonResponse({ relationTypeCodes })
    }

    if (url.startsWith('/api/tracks?')) {
      return listResponse([
        trackResponse('source-track', 'Incoming Mix'),
        trackResponse('expanded-root', 'Expanded Mix Root', true),
        trackResponse('expanded-member', 'Expanded Mix Member'),
        trackResponse('remote-root', 'Remote Destination', true),
      ])
    }

    if (url.startsWith('/api/track-relations?')) {
      return listResponse([
        trackRelationResponse(
          'existing-relation',
          'expanded-member',
          'expanded-root',
          'versionOf',
        ),
        ...(assigned
          ? [
              trackRelationResponse(
                'created-relation',
                'source-track',
                'remote-root',
                'remixOf',
              ),
            ]
          : []),
      ])
    }

    if (url.startsWith('/api/settings/dictionaries?')) {
      return h.defaultDictionaryListResponse()
    }
    if (url.startsWith('/api/rating-criteria?')) {
      return h.defaultRatingCriteriaListResponse()
    }
    return h.emptyCatalogListResponse()
  })

  h.vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, postBodies }
}
```

- [ ] **Step 3: Run the header and integration tests and confirm missing action failures**

```bash
npm --prefix app test -- src/features/tracks/TrackDetailSections.test.tsx src/App.track-stack-picker.test.tsx
```

Expected: FAIL because the entry action and workspace dialog state are not wired.

- [ ] **Step 4: Propagate presentation-only detail props**

Apply this exact presentation-only diff. Retain all unrelated declarations, destructuring entries, and call props unchanged:

```diff
*** Update File: app/src/features/tracks/TrackDetailSections.tsx
@@
+import type { Ref } from 'react'
 import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
@@
 type TrackDetailHeaderProps = Readonly<{
+  addToStackButtonRef?: Ref<HTMLButtonElement>
   canUpdateViaDiscogs: boolean
@@
+  onAddToStack?: () => void
@@
 export function TrackDetailHeader({
+  addToStackButtonRef,
   canUpdateViaDiscogs,
@@
+  onAddToStack,
@@
-    onEdit || onUpdateViaDiscogs || onDelete || hasLocalFileActions,
+    onAddToStack ||
+      onEdit ||
+      onUpdateViaDiscogs ||
+      onDelete ||
+      hasLocalFileActions,
@@
-      <h2 id="track-detail-title">{track.title}</h2>
+      <h2 id="track-detail-title" tabIndex={-1}>
+        {track.title}
+      </h2>
@@
       {hasActions ? (
         <div className="detail-actions">
+          {onAddToStack ? (
+            <button
+              className="button button-primary"
+              ref={addToStackButtonRef}
+              type="button"
+              onClick={onAddToStack}
+            >
+              Add to stack...
+            </button>
+          ) : null}
*** Update File: app/src/features/tracks/TrackDetail.tsx
@@
+import type { Ref } from 'react'
 import { playlistTouchesTrack } from '../catalog/catalogGraph'
@@
 type TrackDetailProps = Readonly<{
+  addToStackButtonRef?: Ref<HTMLButtonElement>
@@
+  onAddToStack?: () => void
@@
 export function TrackDetail({
+  addToStackButtonRef,
@@
+  onAddToStack,
@@
       <TrackDetailHeader
+        addToStackButtonRef={addToStackButtonRef}
@@
+        onAddToStack={onAddToStack}
*** Update File: app/src/features/tracks/TracksWorkspacePanels.tsx
@@
+import type { Ref } from 'react'
 import type {
@@
 type TrackWorkspaceDetailProps = Readonly<{
+  addToStackButtonRef?: Ref<HTMLButtonElement>
@@
+  onAddToStack?: () => void
@@
 export function TrackWorkspaceDetail({
+  addToStackButtonRef,
@@
+  onAddToStack,
@@
     <TrackDetail
+      addToStackButtonRef={addToStackButtonRef}
@@
+      onAddToStack={onAddToStack}
```

The detail layer must not inspect relations, stacks, source eligibility, or settings.

- [ ] **Step 5: Model resolved settings without optimistic defaults**

Create `useTrackStackRelationTypeState.test.tsx` with this complete focused suite:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import { defaultTrackStackRelationTypeCodes } from './trackStackModel'
import { useTrackStackRelationTypeState } from './useTrackStackRelationTypeState'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useTrackStackRelationTypeState', () => {
  it('returns explicit product defaults immediately for the local catalog', () => {
    const { result } = renderHook(() => useTrackStackRelationTypeState(false))

    expect(result.current).toEqual({
      codes: defaultTrackStackRelationTypeCodes,
      status: 'ready',
    })
  })

  it('does not expose optimistic server defaults and preserves a real empty response', async () => {
    const response = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>(() => response.promise),
    )
    const { result } = renderHook(() => useTrackStackRelationTypeState(true))

    expect(result.current).toEqual({ codes: [], status: 'loading' })

    await act(async () => {
      response.resolve(h.jsonResponse({ defaultRelationTypeCodes: [] }))
      await response.promise
    })
    await waitFor(() => {
      expect(result.current).toEqual({ codes: [], status: 'ready' })
    })
  })

  it('keeps the server action disabled after a settings failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockRejectedValue(new Error('offline')),
    )
    const { result } = renderHook(() => useTrackStackRelationTypeState(true))

    await waitFor(() => {
      expect(result.current).toEqual({ codes: [], status: 'error' })
    })
  })

  it('accepts the legacy settings response without optimistic fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValue(h.jsonResponse({ relationTypeCodes: ['remixOf'] })),
    )
    const { result } = renderHook(() => useTrackStackRelationTypeState(true))

    expect(result.current).toEqual({ codes: [], status: 'loading' })
    await waitFor(() => {
      expect(result.current).toEqual({
        codes: ['remixOf'],
        status: 'ready',
      })
    })
  })
})

type Deferred<Value> = Readonly<{
  promise: Promise<Value>
  resolve: (value: Value) => void
}>

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
```

Run it before implementation:

```bash
npm --prefix app test -- src/features/tracks/useTrackStackRelationTypeState.test.tsx
```

Expected: FAIL because the extracted hook does not exist.

Create `useTrackStackRelationTypeState.ts` with the complete implementation:

```ts
import { useEffect, useState } from 'react'
import { loadTrackStackSettings } from '../catalog/api/settingsClient'
import { defaultTrackStackRelationTypeCodes } from './trackStackModel'

export type TrackStackRelationTypeState = Readonly<{
  codes: string[]
  status: 'loading' | 'ready' | 'error'
}>

const localState: TrackStackRelationTypeState = {
  codes: [...defaultTrackStackRelationTypeCodes],
  status: 'ready',
}

const initialServerState: TrackStackRelationTypeState = {
  codes: [],
  status: 'loading',
}

export function useTrackStackRelationTypeState(
  serverBackedCatalog: boolean,
): TrackStackRelationTypeState {
  const [serverState, setServerState] =
    useState<TrackStackRelationTypeState>(initialServerState)

  useEffect(() => {
    if (!serverBackedCatalog) {
      return
    }

    let isActive = true
    void loadTrackStackSettings()
      .then((settings) => {
        if (!isActive) {
          return
        }
        if (!settings) {
          setServerState({ codes: [], status: 'error' })
          return
        }

        const response = settings as {
          defaultRelationTypeCodes?: string[]
          relationTypeCodes?: string[]
        }
        setServerState({
          codes: [
            ...(response.defaultRelationTypeCodes ??
              response.relationTypeCodes ??
              []),
          ],
          status: 'ready',
        })
      })
      .catch(() => {
        if (isActive) {
          setServerState({ codes: [], status: 'error' })
        }
      })

    return () => {
      isActive = false
    }
  }, [serverBackedCatalog])

  return serverBackedCatalog ? serverState : localState
}
```

Run the focused test again:

```bash
npm --prefix app test -- src/features/tracks/useTrackStackRelationTypeState.test.tsx
```

Expected: PASS. A server-backed catalog never flashes default options before settings resolve.

- [ ] **Step 6: Compute eligibility from the unfiltered projection**

Apply these import changes in `TracksWorkspace.tsx`:

```diff
-import { createStackRelation } from '../catalog/api/ownedRelationsClient'
-import { loadTrackStackSettings } from '../catalog/api/settingsClient'
@@
-import { defaultTrackStackRelationTypeCodes } from './trackStackModel'
+import {
+  buildStackRelationCommand,
+  buildTrackStackRows,
+  stackRelationTypeOptions,
+} from './trackStackModel'
+import { TrackStackPickerDialog } from './TrackStackPickerDialog'
+import { useTrackStackAssignment } from './useTrackStackAssignment'
+import { useTrackStackRelationTypeState } from './useTrackStackRelationTypeState'
```

Keep `type StackRelationMutation` imported from `TrackStacksPanel` through Task 8. Replace the old server-stack/settings declarations with:

```ts
const stackProjection = useServerTrackStacks(
  serverBackedCatalog,
  stackRefreshKey,
  stackRefreshNonce,
)
const activeServerStacks = stackProjection.stacks
const stackProjectionReady = stackProjection.status === 'ready'
const stackRelationTypes = useTrackStackRelationTypeState(serverBackedCatalog)
```

Immediately after `useCatalogSelection(...)`, build the unfiltered projection and assignment ownership from all `tracks`, never `visibleTracks`:

```ts
const unfilteredStackRows = useMemo(
  () =>
    buildTrackStackRows({
      dictionaries,
      relations,
      serverStacks: activeServerStacks,
      stackRelationTypeCodes: stackRelationTypes.codes,
      tracks,
    }),
  [
    activeServerStacks,
    dictionaries,
    relations,
    stackRelationTypes.codes,
    tracks,
  ],
)
const enabledStackRelationTypeOptions = useMemo(
  () => stackRelationTypeOptions(stackRelationTypes.codes, dictionaries),
  [dictionaries, stackRelationTypes.codes],
)
const {
  actionStatus,
  canOpenPicker,
  entryButtonRef,
  pickerSource,
  closePicker,
  handleAssigned,
  handleDropCommand,
  handlePickerCommand,
  handleSourceInvalid,
  openPicker,
} = useTrackStackAssignment({
  selectedTrack: selectedTrack ?? null,
  stackRows: unfilteredStackRows,
  relationTypeOptions: enabledStackRelationTypeOptions,
  relationTypesReady: stackRelationTypes.status === 'ready',
  stackProjectionReady,
  onCatalogChanged,
  onExpandDropTarget: (trackId) => {
    setExpandedStackIds((current) => new Set(current).add(trackId))
  },
  onRefreshStacks: () => {
    setStackRefreshNonce((current) => current + 1)
  },
})
```

Replace the existing bottom-level `useServerTrackStacks` with this keyed implementation. It retains the prior rows in the DOM during a refresh, but exposes `loading` for eligibility until those rows match the current Track key and refresh nonce:

```ts
type TrackStackProjection = Readonly<{
  stacks: TrackStackDto[] | null
  status: 'loading' | 'ready' | 'error'
}>

type TrackStackProjectionResolution = Readonly<{
  requestKey: string
  stacks: TrackStackDto[] | null
  status: 'ready' | 'error'
}>

function useServerTrackStacks(
  serverBackedCatalog: boolean,
  stackRefreshKey: string,
  stackRefreshNonce: number,
): TrackStackProjection {
  const requestKey = `${stackRefreshNonce}:${stackRefreshKey}`
  const [resolution, setResolution] =
    useState<TrackStackProjectionResolution | null>(null)

  useEffect(() => {
    if (!serverBackedCatalog) {
      return
    }

    let isActive = true
    void loadTrackStacks()
      .then((response) => {
        if (isActive) {
          setResolution({
            requestKey,
            stacks: response.items,
            status: 'ready',
          })
        }
      })
      .catch(() => {
        if (isActive) {
          setResolution((current) => ({
            requestKey,
            stacks: current?.stacks ?? null,
            status: 'error',
          }))
        }
      })

    return () => {
      isActive = false
    }
  }, [requestKey, serverBackedCatalog])

  if (!serverBackedCatalog) {
    return { stacks: null, status: 'ready' }
  }

  if (resolution?.requestKey !== requestKey) {
    return {
      stacks: resolution?.stacks ?? null,
      status: 'loading',
    }
  }

  return {
    stacks: resolution.stacks,
    status: resolution.status,
  }
}
```

The captured picker source is retained separately from projection readiness, so later filtering or projection refresh cannot silently change or close the source while the dialog is open.

- [ ] **Step 7: Extract shared non-navigating persistence from entry-specific effects**

Create `useTrackStackAssignment.ts` so `TracksWorkspace.tsx` stays comfortably below 600 lines. Give the hook this exact boundary:

```ts
type UseTrackStackAssignmentInput = Readonly<{
  selectedTrack: TrackRecord | null
  stackRows: TrackStackRow[]
  relationTypeOptions: StackRelationTypeOption[]
  relationTypesReady: boolean
  stackProjectionReady: boolean
  onCatalogChanged?: () => void
  onExpandDropTarget: (trackId: string) => void
  onRefreshStacks: () => void
}>

type UseTrackStackAssignmentResult = Readonly<{
  actionStatus: string
  canOpenPicker: boolean
  entryButtonRef: RefObject<HTMLButtonElement | null>
  pickerSource: TrackRecord | null
  closePicker: () => void
  handleAssigned: (result: TrackStackPickerAssignedResult) => void
  handleDropCommand: (command: StackRelationCommand) => Promise<void>
  handlePickerCommand: (command: StackRelationCommand) => Promise<void>
  handleSourceInvalid: () => void
  openPicker: () => void
}>
```

Create `useTrackStackAssignment.ts` with this complete implementation:

```ts
import { useRef, useState, type RefObject } from 'react'
import {
  createStackRelation,
  type StackRelationCommand,
} from '../catalog/api/ownedRelationsClient'
import type { TrackStackPickerAssignedResult } from './TrackStackPickerDialog'
import {
  isEligibleStackSource,
  type StackRelationTypeOption,
  type TrackStackRow,
} from './trackStackModel'
import type { TrackRecord } from './tracksData'

export type UseTrackStackAssignmentInput = Readonly<{
  selectedTrack: TrackRecord | null
  stackRows: TrackStackRow[]
  relationTypeOptions: StackRelationTypeOption[]
  relationTypesReady: boolean
  stackProjectionReady: boolean
  onCatalogChanged?: () => void
  onExpandDropTarget: (trackId: string) => void
  onRefreshStacks: () => void
}>

export type UseTrackStackAssignmentResult = Readonly<{
  actionStatus: string
  canOpenPicker: boolean
  entryButtonRef: RefObject<HTMLButtonElement | null>
  pickerSource: TrackRecord | null
  closePicker: () => void
  handleAssigned: (result: TrackStackPickerAssignedResult) => void
  handleDropCommand: (command: StackRelationCommand) => Promise<void>
  handlePickerCommand: (command: StackRelationCommand) => Promise<void>
  handleSourceInvalid: () => void
  openPicker: () => void
}>

type PickerState = Readonly<{
  sourceTrackId: string
  sourceSnapshot: TrackRecord
}>

export function useTrackStackAssignment({
  selectedTrack,
  stackRows,
  relationTypeOptions,
  relationTypesReady,
  stackProjectionReady,
  onCatalogChanged,
  onExpandDropTarget,
  onRefreshStacks,
}: UseTrackStackAssignmentInput): UseTrackStackAssignmentResult {
  const entryButtonRef = useRef<HTMLButtonElement>(null)
  const [actionStatus, setActionStatus] = useState('')
  const [pickerState, setPickerState] = useState<PickerState | null>(null)
  const pickerSource = pickerState
    ? (findTrackInStackRows(pickerState.sourceTrackId, stackRows) ??
      pickerState.sourceSnapshot)
    : null
  const canOpenPicker = Boolean(
    selectedTrack &&
    relationTypesReady &&
    stackProjectionReady &&
    relationTypeOptions.length > 0 &&
    isEligibleStackSource(selectedTrack, stackRows),
  )

  async function persistStackRelation(command: StackRelationCommand) {
    await createStackRelation(command)
    onRefreshStacks()
    onCatalogChanged?.()
  }

  async function handlePickerCommand(command: StackRelationCommand) {
    await persistStackRelation(command)
  }

  async function handleDropCommand(command: StackRelationCommand) {
    await persistStackRelation(command)
    onExpandDropTarget(command.targetRootTrackId)
  }

  function openPicker() {
    if (!canOpenPicker || !selectedTrack) {
      return
    }
    setActionStatus('')
    setPickerState({
      sourceTrackId: selectedTrack.id,
      sourceSnapshot: selectedTrack,
    })
  }

  function closePicker() {
    setPickerState(null)
  }

  function handleAssigned(result: TrackStackPickerAssignedResult) {
    if (!pickerSource) {
      return
    }
    setActionStatus(
      `Added ${pickerSource.title} to ${result.destination.title} as ${result.relationType.label}.`,
    )
  }

  function handleSourceInvalid() {
    onRefreshStacks()
    onCatalogChanged?.()
  }

  return {
    actionStatus,
    canOpenPicker,
    entryButtonRef,
    pickerSource,
    closePicker,
    handleAssigned,
    handleDropCommand,
    handlePickerCommand,
    handleSourceInvalid,
    openPicker,
  }
}

function findTrackInStackRows(
  trackId: string,
  stackRows: TrackStackRow[],
): TrackRecord | null {
  for (const row of stackRows) {
    if (row.original.id === trackId) {
      return row.original
    }

    const member = row.members.find((item) => item.track.id === trackId)
    if (member) {
      return member.track
    }
  }

  return null
}
```

Replace the old mutating/navigating `handleCreateStackRelation` in `TracksWorkspace` with this temporary Task 8 DnD adapter:

```ts
async function handleCreateStackRelation({
  sourceTrack,
  targetRootTrack,
  relationTypeCode,
  targetWasStandalone,
}: StackRelationMutation) {
  await handleDropCommand(
    buildStackRelationCommand(
      sourceTrack.id,
      targetRootTrack.id,
      relationTypeCode,
      targetWasStandalone && !targetRootTrack.isOriginal,
    ),
  )
  selectTrack(sourceTrack.id)
}
```

Use `stackRelationTypeCodes={stackRelationTypes.codes}` and `onCreateStackRelation={handleCreateStackRelation}` on the existing `TrackStacksPanel`. Delete the old bottom-level `useTrackStackRelationTypeCodes` function. The picker calls only `handlePickerCommand`; `selectTrack` remains in this DnD-only adapter and never enters shared persistence or picker success. Task 9 changes the adapter input to `StackRelationCommand`. Neither shared persistence nor picker success calls `selectTrack`, `setQuery`, `setFilters`, scrolling, or URL/history navigation.

- [ ] **Step 8: Render the picker and live status**

Add these exact props to the existing `TrackWorkspaceDetail` call:

```tsx
addToStackButtonRef={entryButtonRef}
onAddToStack={canOpenPicker ? openPicker : undefined}
```

Immediately after `TrackWorkspaceDetail`, before the workspace `</section>`, render the captured picker and one persistent live region:

```tsx
{
  pickerSource ? (
    <TrackStackPickerDialog
      relationTypeOptions={enabledStackRelationTypeOptions}
      returnFocusRef={entryButtonRef}
      sourceTrack={pickerSource}
      onAssigned={handleAssigned}
      onClose={closePicker}
      onSourceInvalid={handleSourceInvalid}
      onSubmit={handlePickerCommand}
    />
  ) : null
}

;<div
  aria-atomic="true"
  aria-live="polite"
  className="visually-hidden"
  role="status"
>
  {actionStatus}
</div>
```

Keep the dialog mounted while `pickerSource` is non-null even if refreshed rows/settings make it ineligible. This lets stale-source errors remain visible and gives the common close path a stable focus target.

- [ ] **Step 9: Run integration and size checks**

```bash
npm --prefix app test -- src/features/tracks/TrackDetailSections.test.tsx src/features/tracks/useTrackStackRelationTypeState.test.tsx src/App.track-stack-picker.test.tsx
npm --prefix app run typecheck
npm --prefix app run file-size:check
```

Expected: PASS. The settings hook lives in its own file and `TracksWorkspace.tsx` remains below 600 lines; do not suppress the size check.

- [ ] **Step 10: Commit workspace integration**

```bash
git add app/src/features/tracks/TrackDetailSections.tsx app/src/features/tracks/TrackDetailSections.test.tsx app/src/features/tracks/TrackDetail.tsx app/src/features/tracks/TracksWorkspacePanels.tsx app/src/features/tracks/TracksWorkspace.tsx app/src/App.track-stack-picker.test.tsx app/src/features/tracks/useTrackStackRelationTypeState.ts app/src/features/tracks/useTrackStackRelationTypeState.test.tsx app/src/features/tracks/useTrackStackAssignment.ts
git commit -m "feat(app): wire stack picker into track workspace"
```

---

### Task 9: Move DnD onto the Shared Identifier Command Without Changing Its UX

**Files:**

- Modify: `app/src/features/tracks/TrackStacksPanel.tsx`
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`
- Modify: `app/src/App.track-stacks.drop.test.tsx`
- Modify: `app/src/App.track-stacks.test.tsx`

**Interfaces:**

- Consumes:
  - `buildStackRelationCommand(sourceTrackId: string, targetRootTrackId: string, relationTypeCode: string, markTargetAsOriginal: boolean): StackRelationCommand` from Task 5.
  - `handleDropCommand(command: StackRelationCommand): Promise<void>` from `UseTrackStackAssignmentResult` in Task 8.
  - Existing local `StackDropDraft = { sourceTrack: TrackRecord; targetRootTrack: TrackRecord; targetWasStandalone: boolean }`, `TrackStackRow`, relation options, chooser, path check, and exact-relation lookup.
- Produces:
  - `TrackStacksPanelProps.onCreateStackRelation: (command: StackRelationCommand) => Promise<void>`; `StackRelationMutation` is removed.
  - `TracksWorkspace.handleCreateStackRelation(command: StackRelationCommand): Promise<void>` delegates persistence/expansion to `handleDropCommand(command)` and then preserves the DnD-only `selectTrack(command.sourceTrackId)` effect.
  - Every DnD submission targets `draft.targetRootTrack.id`, including drops on expanded members.
  - `markTargetAsOriginal` is exactly `draft.targetWasStandalone && !draft.targetRootTrack.isOriginal`.
  - Exact relation reuse still bypasses the DnD chooser, while a new relation still uses the existing local chooser.
  - After the shared promise resolves, DnD alone expands the target through `handleDropCommand`, selects the source through the workspace adapter, and highlights the moved source through `TrackStacksPanel`; it never opens `TrackStackPickerDialog`.

- [ ] **Step 1: Strengthen DnD regression assertions before refactoring**

Strengthen the existing `drops on an expanded stack member area but creates the relation to the stack root` test in `App.track-stacks.drop.test.tsx`. Keep its complete fixture and wire-payload assertion, then replace its final single source assertion with this exact block:

```tsx
const movedSource = h.screen.getByRole('button', {
  name: /Show Me Love \(Dub Mix\)/,
})
expect(movedSource).toHaveClass('is-selected', 'is-highlighted')
expect(h.screen.getByRole('button', { name: 'Collapse stack' })).toBeVisible()
expect(
  h.screen.queryByRole('dialog', { name: 'Choose destination stack' }),
).not.toBeInTheDocument()
```

Together with the retained payload assertion in that test, this pins the expanded-member-to-root mapping and `markTargetAsOriginal:false` for a real stack.

Strengthen the complete existing `organizes a stack when the selected relation already exists` test in `App.track-stacks.test.tsx`. Immediately before `fetchMock`, add:

```tsx
let organized = false
```

Replace only its `/api/tracks/stacks` fixture branch with:

```tsx
if (url.startsWith('/api/tracks/stacks')) {
  return listResponse(
    organized
      ? [
          {
            originalTrackId: 'track-original',
            originalTitle: 'Show Me Love (New York Mix)',
            originalVersionYear: 1990,
            memberCount: 1,
            hasCycleIssue: false,
            members: [
              {
                trackId: 'track-dub',
                title: 'Show Me Love (Dub Mix)',
                versionYear: 1990,
                relationType: 'versionOf',
                depth: 1,
                isDirect: true,
              },
            ],
            issues: [],
          },
        ]
      : [],
  )
}
```

Replace its stack POST fixture branch with:

```tsx
if (url === '/api/track-relations/stack' && init?.method === 'POST') {
  organized = true
  return h.jsonResponse({}, 200)
}
```

Keep the existing assertions that the `Add to stack as` chooser and duplicate error are absent and that the POST contains the existing `versionOf` relation plus `markTargetAsOriginal:true`. Append these exact success assertions after the payload `waitFor`:

```tsx
expect(
  h.screen.queryByRole('dialog', { name: 'Choose destination stack' }),
).not.toBeInTheDocument()
expect(
  h.screen.getByRole('button', { name: /Show Me Love \(Dub Mix\)/ }),
).toHaveClass('is-selected', 'is-highlighted')
await h.waitFor(() => {
  expect(h.screen.getByRole('button', { name: 'Collapse stack' })).toBeVisible()
})
```

This one retained end-to-end case pins exact-relation reuse, promotion of a standalone non-original target, DnD-only expansion/highlight, and the absence of the new searchable picker.

Run:

```bash
npm --prefix app test -- src/App.track-stacks.drop.test.tsx src/App.track-stacks.test.tsx
```

Expected before refactor: PASS.

- [ ] **Step 2: Change the panel callback to the identifier contract**

Apply this exact import/type diff first:

```diff
*** Update File: app/src/features/tracks/TrackStacksPanel.tsx
@@
 import type {
   CatalogDictionaries,
   RatingCriterion,
   TrackStackDto,
 } from '../catalog/catalogApi'
+import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
@@
 import {
+  buildStackRelationCommand,
   buildTrackStackRows,
@@
 } from './trackStackModel'
@@
-export type StackRelationMutation = {
-  sourceTrack: TrackRecord
-  targetRootTrack: TrackRecord
-  relationTypeCode: string
-  targetWasStandalone: boolean
-}
*** Update File: app/src/features/tracks/TracksWorkspace.tsx
@@
-import {
-  TrackStacksPanel,
-  type StackRelationMutation,
-} from './TrackStacksPanel'
+import { TrackStacksPanel } from './TrackStacksPanel'
@@
+import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
@@
 import {
-  buildStackRelationCommand,
   buildTrackStackRows,
   stackRelationTypeOptions,
 } from './trackStackModel'
```

Replace the object-valued persistence prop with:

```ts
onCreateStackRelation: (command: StackRelationCommand) => Promise<void>
```

Inside `submitStackRelation`, build:

```ts
await onCreateStackRelation(
  buildStackRelationCommand(
    draft.sourceTrack.id,
    draft.targetRootTrack.id,
    relationTypeCode,
    draft.targetWasStandalone && !draft.targetRootTrack.isOriginal,
  ),
)
```

Keep full `TrackRecord` objects only in local DnD presentation state, where their titles are needed by the chooser.

- [ ] **Step 3: Route the panel through the DnD wrapper**

Replace the Task 8 object-valued adapter with this identifier-valued DnD adapter:

```ts
async function handleCreateStackRelation(command: StackRelationCommand) {
  await handleDropCommand(command)
  selectTrack(command.sourceTrackId)
}
```

Keep `onCreateStackRelation={handleCreateStackRelation}` and every other existing panel prop unchanged. Keep `TrackStacksPanel`'s current `setHighlightTrackId` timer after the promise resolves. Source selection is DnD-only; do not move selection or highlight state into the picker or shared persistence helper.

- [ ] **Step 4: Run all stack regressions**

```bash
npm --prefix app test -- src/App.track-stack-picker.test.tsx src/App.track-stacks.test.tsx src/App.track-stacks.drop.test.tsx src/features/tracks/TrackStacksPanel.test.tsx
npm --prefix app run typecheck
npm --prefix app run file-size:check
```

Expected: PASS. Picker success leaves selection and expansion unchanged; DnD success preserves its source selection, destination expansion, and highlight.

- [ ] **Step 5: Commit the shared command migration**

```bash
git add app/src/features/tracks/TrackStacksPanel.tsx app/src/features/tracks/TracksWorkspace.tsx app/src/App.track-stacks.drop.test.tsx app/src/App.track-stacks.test.tsx
git commit -m "refactor(app): share stack relation persistence command"
```

---

### Task 10: Apply Approved Styling and Complete Automated and Manual Verification

**Files:**

- Create: `app/src/features/tracks/track-stack-picker.css`
- Modify: `app/src/features/tracks/tracks.css`

**Interfaces:**

- Consumes:
  - The approved Step 1/Step 2 structure and the semantic class names already emitted by `TrackStackPickerDialog`.
  - Existing DiscWeave variables `--color-canvas`, `--color-surface`, `--color-surface-subtle`, `--color-selected`, `--color-heading`, `--color-text`, `--color-muted`, `--color-danger`, `--color-border`, `--color-border-strong`, and existing radius variables.
  - Every focused API, picker, workspace, DnD, accessibility, file-size, and desktop-build command listed below.
- Produces:
  - `tracks.css` imports `track-stack-picker.css` exactly once.
  - The programmatically focused selected-Track heading has a visible `:focus-visible` outline after successful assignment.
  - `track-stack-picker.css` owns only the picker selectors listed in Step 1, uses no new product tokens, keeps focus visibly distinguishable, and makes non-color text/state cues available.
  - A responsive dialog contract of `width: min(680px, calc(100vw - 32px))`, `max-height: min(760px, calc(100vh - 32px))`, internally scrolling results, and vertically stacked route/footer behavior at `max-width: 700px`.
  - Recorded passing evidence for focused and full API/frontend gates plus the real-API browser and Electron checklist.

- [ ] **Step 1: Import and implement picker-only styles**

Add this import near the top of `tracks.css`:

```css
@import './track-stack-picker.css';
```

Add the success-focus treatment to `tracks.css` next to the existing detail heading rules:

```css
#track-detail-title:focus {
  border-radius: var(--radius-sm);
  outline: 2px solid var(--color-heading);
  outline-offset: 3px;
}
```

Create `track-stack-picker.css` with this complete picker-only stylesheet:

```css
.track-stack-picker-dialog {
  width: min(680px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 32px));
  margin: auto;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: 0;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 20px 64px
    color-mix(in srgb, var(--color-heading) 24%, transparent);
}

.track-stack-picker-dialog[open] {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.track-stack-picker-dialog::backdrop {
  background: color-mix(in srgb, var(--color-heading) 44%, transparent);
}

.track-stack-picker-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--color-border);
  padding: 18px 20px 16px;
}

.track-stack-picker-header h2,
.track-stack-picker-source strong,
.track-stack-picker-route strong {
  color: var(--color-heading);
}

.track-stack-picker-header h2 {
  margin: 2px 0 0;
  font-size: 1.15rem;
}

.track-stack-picker-kicker {
  color: var(--color-muted);
  font-size: 0.72rem;
  font-weight: 780;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.track-stack-picker-source {
  display: grid;
  gap: 3px;
  border-bottom: 1px solid var(--color-border);
  padding: 14px 20px;
  background: var(--color-surface-subtle);
}

.track-stack-picker-source > span,
.track-stack-picker-result-meta,
.track-stack-picker-match,
.track-stack-picker-route > section > span {
  color: var(--color-muted);
  font-size: 0.82rem;
}

.track-stack-picker-search {
  display: grid;
  gap: 6px;
  padding: 16px 20px 10px;
}

.track-stack-picker-search > span {
  color: var(--color-heading);
  font-size: 0.78rem;
  font-weight: 700;
}

.track-stack-picker-search input {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.track-stack-picker-search input:focus-visible {
  outline: 2px solid var(--color-heading);
  outline-offset: 2px;
}

.track-stack-picker-state {
  margin: 0;
  padding: 12px 20px 18px;
  color: var(--color-muted);
}

.track-stack-picker-results {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  margin: 0;
  border: 0;
  padding: 6px 20px 18px;
  overflow: auto;
}

.track-stack-picker-results legend {
  margin-bottom: 8px;
  color: var(--color-heading);
  font-size: 0.78rem;
  font-weight: 700;
}

.track-stack-picker-result {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  border-top: 1px solid var(--color-border);
  padding: 11px 8px;
  cursor: pointer;
}

.track-stack-picker-result:last-of-type {
  border-bottom: 1px solid var(--color-border);
}

.track-stack-picker-result:has(input:checked) {
  background: var(--color-selected);
  box-shadow: inset 3px 0 0 var(--color-heading);
}

.track-stack-picker-result input {
  margin-top: 3px;
}

.track-stack-picker-result input:focus-visible + span {
  border-radius: var(--radius-sm);
  outline: 2px solid var(--color-heading);
  outline-offset: 3px;
}

.track-stack-picker-result > span {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.track-stack-picker-result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.track-stack-picker-match {
  padding-left: 10px;
  border-left: 2px solid var(--color-border-strong);
}

.track-stack-picker-route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--color-surface-subtle);
}

.track-stack-picker-route > section {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.track-stack-picker-relation-options {
  flex: 1 1 auto;
  display: grid;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  margin: 0;
  border: 0;
  padding: 16px 20px;
  overflow: auto;
}

.track-stack-picker-relation-options label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  cursor: pointer;
}

.track-stack-picker-relation-options label:has(input:checked) {
  border-color: var(--color-border-strong);
  background: var(--color-selected);
  font-weight: 700;
}

.track-stack-picker-relation-options input:focus-visible + span {
  border-radius: var(--radius-sm);
  outline: 2px solid var(--color-heading);
  outline-offset: 3px;
}

.track-stack-picker-error {
  margin: 0 20px 12px;
  border-left: 3px solid var(--color-danger);
  padding: 8px 10px;
  background: var(--color-surface-subtle);
  color: var(--color-danger);
  font-weight: 650;
}

.track-stack-picker-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--color-border);
  padding: 12px 20px;
  background: var(--color-surface);
}

@media (max-width: 700px) {
  .track-stack-picker-route {
    grid-template-columns: minmax(0, 1fr);
  }

  .track-stack-picker-route > svg {
    transform: rotate(90deg);
  }

  .track-stack-picker-footer {
    flex-wrap: wrap;
  }

  .track-stack-picker-footer .button {
    flex: 1 1 auto;
  }
}
```

Do not add decorative wrapper cards or any new design tokens. Selection uses both a background and inset marker; errors use text plus a border; focus uses a visible outline.

- [ ] **Step 2: Format only the changed frontend files and run focused tests**

```bash
cd app
npx prettier --write \
  src/features/catalog/api/catalogDtoTypes.ts \
  src/features/catalog/api/httpClient.ts \
  src/features/catalog/api/ownedRelationsClient.ts \
  src/features/catalog/api/trackStackTargetsClient.ts \
  src/features/catalog/api/trackStackTargetsClient.test.ts \
  src/features/tracks/trackStackModel.ts \
  src/features/tracks/trackStackModel.test.ts \
  src/features/tracks/TrackStackPickerDialog.tsx \
  src/features/tracks/useTrackStackPickerDialog.ts \
  src/features/tracks/TrackStackPickerDialog.search.test.tsx \
  src/features/tracks/TrackStackPickerDialog.submit.test.tsx \
  src/features/tracks/TrackStackPickerDialog.accessibility.test.tsx \
  src/features/tracks/TrackStackPickerDialog.testUtils.tsx \
  src/features/tracks/TrackDetailSections.tsx \
  src/features/tracks/TrackDetailSections.test.tsx \
  src/features/tracks/TrackDetail.tsx \
  src/features/tracks/TrackStackFacts.tsx \
  src/features/tracks/TracksWorkspacePanels.tsx \
  src/features/tracks/useTrackStackRelationTypeState.ts \
  src/features/tracks/useTrackStackRelationTypeState.test.tsx \
  src/features/tracks/useTrackStackAssignment.ts \
  src/features/tracks/TracksWorkspace.tsx \
  src/features/tracks/TrackStacksPanel.tsx \
  src/features/tracks/TrackStackMemberGroups.tsx \
  src/features/tracks/track-stack-picker.css \
  src/features/tracks/tracks.css \
  src/App.track-stack-picker.test.tsx \
  src/App.track-stacks.test.tsx \
  src/App.track-stacks.drop.test.tsx
cd ..
npm --prefix app test -- \
  src/features/catalog/api/trackStackTargetsClient.test.ts \
  src/features/tracks/trackStackModel.test.ts \
  src/features/tracks/TrackStackPickerDialog.search.test.tsx \
  src/features/tracks/TrackStackPickerDialog.submit.test.tsx \
  src/features/tracks/TrackStackPickerDialog.accessibility.test.tsx \
  src/features/tracks/TrackDetailSections.test.tsx \
  src/features/tracks/useTrackStackRelationTypeState.test.tsx \
  src/App.track-stack-picker.test.tsx \
  src/App.track-stacks.test.tsx \
  src/App.track-stacks.drop.test.tsx \
  src/features/tracks/TrackStacksPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run focused API tests**

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj \
  --configuration Release \
  --filter "FullyQualifiedName~TrackStackTargetEndpointTests|FullyQualifiedName~RelationEndpointTests"
```

Expected: PASS.

- [ ] **Step 4: Run the complete API quality gates**

```bash
cd api
dotnet format DiscWeave.slnx --verify-no-changes --verbosity minimal
dotnet build DiscWeave.slnx --configuration Release
dotnet test DiscWeave.slnx --configuration Release --no-build
cd ..
```

Expected: PASS.

- [ ] **Step 5: Run the complete frontend quality gates**

```bash
cd app
npm run format:check
npm run lint
npm run typecheck
npm test
npm run file-size:check
npm run build
npm run desktop:build:mac
cd ..
```

Expected: PASS, including the shared Electron desktop build. Existing documented Vite chunk warnings may remain; new errors or warnings introduced by this feature must be fixed.

- [ ] **Step 6: Perform the real-API keyboard and state-preservation smoke test**

Start the real API and browser app in separate terminals:

```bash
dotnet run --project api/src/DiscWeave.Api/DiscWeave.Api.csproj
```

```bash
npm --prefix app run dev
```

After the browser pass, run `npm --prefix app run desktop:dev` and repeat the entry, keyboard, success, and DnD checks in the Electron development shell. Verify this exact checklist:

1. Select an eligible standalone Track while its destination stack is off-screen or filtered out.
2. Open `Add to stack...`; confirm focus starts in search and the source is pinned.
3. Search by root title, root artist, member title, and member artist.
4. Load a second result page and select a same-title stack using artist/year/member count.
5. Complete the entire flow with keyboard only; confirm Step 2 has no default type.
6. Use Back and confirm query/results/destination remain.
7. Submit and confirm source selection, query, filters, scroll, and expansion remain unchanged.
8. Confirm focus lands on the still-selected Track heading and the live announcement states source, destination, and relation label.
9. Trigger a recoverable API failure and confirm the dialog stays open with valid state.
10. Repeat the old DnD flow onto an existing stack and a standalone target; confirm expansion/highlight and promotion behavior remain.

Expected: every item passes in both browser and the Electron development shell with shared UI semantics; no desktop-only implementation fork is introduced.

- [ ] **Step 7: Inspect the final diff for scope and repository hygiene**

```bash
git status --short
git diff --check
git diff --stat
```

Expected: only planned API, frontend, test, and plan/spec files appear; no generated output, private collection data, `.superdesign`, `.superpowers`, build artifacts, or dependency-lock changes are present.

- [ ] **Step 8: Commit the verified styling**

```bash
git add app/src/features/tracks/track-stack-picker.css app/src/features/tracks/tracks.css
git commit -m "style(app): finish track stack picker"
```

If any verification command fails, return to the task that owns the failing behavior, add a focused regression test, make the smallest correction there, rerun that task's focused command, and then repeat Tasks 10 Steps 2–7 before creating this CSS commit. Do not mix unrelated verification fixes into the styling commit.

---

## Completion Evidence

Before declaring implementation complete, record all of the following in the handoff:

- focused API test command and passing count;
- focused picker/DnD test command and passing count;
- complete API solution test result;
- frontend format, lint, typecheck, full test, file-size, and build results;
- manual real-API smoke result, including keyboard-only and off-screen destination cases;
- final `git status --short` output;
- confirmation that no schema migration or stored `TrackStack` model was added.
