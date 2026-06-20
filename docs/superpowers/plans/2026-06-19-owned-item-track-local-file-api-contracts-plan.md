# Owned Item, Track, And Local File API Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace track-shaped owned-item file contracts with release-owned item details, track digital-file projections, and local-audio-file edit contracts.

**Architecture:** Keep the existing domain model: `OwnedItem` is the release-copy aggregate, `LocalAudioFile` stores concrete local file identity, and `DigitalTrackFileLink` connects a digital release copy to a release track appearance. Add API projection mappers around those persisted entities and update frontend DTOs so local edit flows use `localAudioFileId` rather than `ownedItemId`.

**Tech Stack:** ASP.NET Core minimal APIs, EF Core, SQLite integration tests, React, TypeScript, Electron preload bridge, Vitest.

---

## File Structure

Backend API contract files:

- Modify `api/src/DiscWeave.Api/Features/OwnedItems/CreateOwnedItemRequest.cs` to use `releaseId` instead of `targetType` and `targetId`.
- Modify `api/src/DiscWeave.Api/Features/OwnedItems/UpdateOwnedItemRequest.cs` to use optional `releaseId` instead of optional target fields.
- Modify `api/src/DiscWeave.Api/Features/OwnedItems/MediumRequest.cs` to remove old digital file request fields.
- Modify `api/src/DiscWeave.Api/Features/OwnedItems/MediumResponse.cs` to remove old digital file response fields and keep only medium identity fields.
- Modify `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemResponse.cs` to add release identity and type-specific `details`.
- Delete `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemTargetResponse.cs` if no longer referenced after response mapper cleanup.
- Modify `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemMapper.cs` for release-only request mapping, medium mapping, and physical detail mapping.
- Modify `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemResponseMapper.cs` to load release summaries, release track rows, digital links, local audio files, and track titles for details projections.
- Modify `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.cs` to consume `releaseId` requests and stop mapping the legacy digital-file route.
- Delete `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.DigitalFiles.cs` after tests prove the active route is gone.

Backend shared file contract files:

- Create `api/src/DiscWeave.Api/Features/LocalFiles/LocalAudioFileContracts.cs` for update request/response records and file projection records shared by local-file endpoints, owned-item details, and track projections.
- Create `api/src/DiscWeave.Api/Features/LocalFiles/LocalAudioFileContractMapper.cs` for audio format, quality, and optional value mapping.
- Create `api/src/DiscWeave.Api/Features/LocalFiles/LocalAudioFilesEndpointRouteBuilderExtensions.cs` for `PATCH /api/local-audio-files/{localAudioFileId}`.
- Modify `api/src/DiscWeave.Api/Features/DiscWeaveEndpointRouteBuilderExtensions.cs` to register local-audio-file endpoints.
- Modify `api/src/DiscWeave.Domain/Collection/LocalAudioFile.cs` to add a path update method.

Backend track projection files:

- Modify `api/src/DiscWeave.Api/Features/Tracks/TrackResponse.cs` to add `digitalFiles`.
- Modify `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.Response.cs` to load file-link projections for track list/detail responses.

Backend tests:

- Modify `api/tests/DiscWeave.Api.Tests/ApiTestHost.cs` to add local file/link seed helpers used by endpoint tests.
- Create `api/tests/DiscWeave.Api.Tests/OwnedItemReleaseOwnedContractTests.cs`.
- Create `api/tests/DiscWeave.Api.Tests/LocalAudioFileEndpointTests.cs`.
- Modify `api/tests/DiscWeave.Api.Tests/TrackEndpointContractTests.cs`.
- Modify owned-item helpers in existing API tests from `{ targetType, targetId }` to `{ releaseId }` only where they call `/api/owned-items`.
- Modify API tests that assert owned-item response shape from `targetType/targetId/target` to `releaseId/release/details`.

Frontend DTO/client files:

- Modify `app/src/features/catalog/api/catalogTypes.ts` to add type-specific owned item detail DTOs, `TrackDto.digitalFiles`, and `LocalAudioFileUpdateRequest`.
- Modify `app/src/features/catalog/api/ownedItemsClient.ts` to replace `updateOwnedItemDigitalFile` with `updateLocalAudioFile`.
- Modify `app/src/features/catalog/api/ownedItemEntityMappers.ts` and `app/src/features/catalog/api/catalogEntityMappers.ts` to consume release-owned details and track digital files.
- Modify `app/src/features/tracks/tracksData.ts` to replace `fileMetadata` with `digitalFiles`.
- Modify `app/src/features/tracks/trackDisplayHelpers.ts`, `app/src/features/tracks/TrackDetail.tsx`, `app/src/features/tracks/TracksWorkspace.tsx`, `app/src/features/releases/ReleaseDetail.tsx`, `app/src/features/releases/ReleasesWorkspace.tsx`, and `app/src/features/catalog/catalogGraph.ts` to read the first real digital file through a helper instead of `track.fileMetadata`.

Frontend local edit files:

- Modify `app/src/desktop.d.ts`, `app/electron/local-edits.cjs`, and related Electron tests so local edit payloads use `localAudioFileId`.
- Modify `app/src/features/localFiles/localFileEditModel.ts`, `app/src/features/localFiles/localFileEditTypes.ts`, `app/src/features/localFiles/localFileEditHelpers.ts`, `app/src/features/localFiles/LocalFileEditPanel.tsx`, `app/src/features/localFiles/LocalFileNameEditor.tsx`, `app/src/features/localFiles/LocalFileTagEditor.tsx`, and `app/src/features/localFiles/localFileEditApplyResult.ts` to key file edits by `localAudioFileId`.
- Modify app tests that construct `TrackRecord` local-file data.

## Task 1: Backend Owned Item Release-Owned Contract

**Files:**
- Modify: `api/tests/DiscWeave.Api.Tests/ApiTestHost.cs`
- Create: `api/tests/DiscWeave.Api.Tests/OwnedItemReleaseOwnedContractTests.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/CreateOwnedItemRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/UpdateOwnedItemRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/MediumRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/MediumResponse.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemResponse.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemMapper.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemResponseMapper.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.cs`
- Test: `api/tests/DiscWeave.Api.Tests/OwnedItemReleaseOwnedContractTests.cs`

- [ ] **Step 1: Write failing release-owned owned item response tests**

Add these seed records to the API test project:

```csharp
internal sealed record LocalAudioFileSeed(Guid LocalAudioFileId);

internal sealed record DigitalFileSeed(
    Guid LinkId,
    Guid ReleaseTrackId,
    Guid LocalAudioFileId);
```

Add this helper to `ApiTestHost`:

```csharp
public async Task<DigitalFileSeed> SeedDigitalTrackFileLinkAsync(
    Guid releaseId,
    Guid ownedItemId,
    int releaseTrackPosition,
    string path,
    string format,
    string contentHash,
    CancellationToken cancellationToken = default)
{
    await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
    DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
    Release release = await context.Releases.SingleAsync(
        candidate => candidate.CollectionId == DefaultCollectionId && candidate.Id == new ReleaseId(releaseId),
        cancellationToken);
    ReleaseTrack releaseTrack = release.Tracklist.Single(track => track.Position.Number == releaseTrackPosition);
    var file = LocalAudioFile.Create(
            DefaultCollectionId,
            LocalAudioFileId.New(),
            FilePath.FromAbsolutePath(path))
        .WithFormat(ParseAudioFileFormat(format))
        .WithContentHash(contentHash);
    var link = DigitalTrackFileLink.Create(
        DefaultCollectionId,
        DigitalTrackFileLinkId.New(),
        new OwnedItemId(ownedItemId),
        releaseTrack.Id,
        file.Id);

    _ = context.LocalAudioFiles.Add(file);
    _ = context.DigitalTrackFileLinks.Add(link);
    _ = await context.SaveChangesAsync(cancellationToken);

    return new DigitalFileSeed(link.Id.Value, releaseTrack.Id.Value, file.Id.Value);
}

public async Task<LocalAudioFileSeed> SeedLocalAudioFileAsync(
    string path,
    string format,
    string contentHash,
    CancellationToken cancellationToken = default)
{
    return await SeedLocalAudioFileAsync(DefaultCollectionId, path, format, contentHash, cancellationToken);
}

public async Task<LocalAudioFileSeed> SeedLocalAudioFileAsync(
    CollectionId collectionId,
    string path,
    string format,
    string contentHash,
    CancellationToken cancellationToken = default)
{
    await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
    DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
    var file = LocalAudioFile.Create(
            collectionId,
            LocalAudioFileId.New(),
            FilePath.FromAbsolutePath(path))
        .WithFormat(ParseAudioFileFormat(format))
        .WithContentHash(contentHash);

    _ = context.LocalAudioFiles.Add(file);
    _ = await context.SaveChangesAsync(cancellationToken);

    return new LocalAudioFileSeed(file.Id.Value);
}

private static AudioFileFormat ParseAudioFileFormat(string format)
{
    return format.Trim().ToLowerInvariant() switch
    {
        "flac" => AudioFileFormat.Flac,
        "mp3" => AudioFileFormat.Mp3,
        "ogg" => AudioFileFormat.Ogg,
        "wav" => AudioFileFormat.Wav,
        "aiff" => AudioFileFormat.Aiff,
        "alac" => AudioFileFormat.Alac,
        "m4a" => AudioFileFormat.M4a,
        _ => throw new ArgumentOutOfRangeException(nameof(format), format, "Audio file format is not supported")
    };
}
```

Add these tests to `OwnedItemReleaseOwnedContractTests.cs`:

```csharp
[Fact(DisplayName = "Owned item response exposes release-owned digital file coverage")]
public async Task Owned_item_response_exposes_release_owned_digital_file_coverage()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    Guid releaseId = await CreateReleaseWithTwoTracksAsync(client);
    Guid ownedItemId = await CreateOwnedItemAsync(client, releaseId, new { type = "digital" });
    DigitalFileSeed seed = await host.SeedDigitalTrackFileLinkAsync(
        releaseId,
        ownedItemId,
        releaseTrackPosition: 1,
        "/music/fallen/01-begins.flac",
        "flac",
        "ABCDEF0123");

    using JsonDocument document = await GetJsonAsync(client, $"/api/owned-items/{ownedItemId}", HttpStatusCode.OK);
    JsonElement root = document.RootElement;

    Assert.False(root.TryGetProperty("targetType", out _));
    Assert.False(root.TryGetProperty("targetId", out _));
    Assert.False(root.TryGetProperty("target", out _));
    Assert.Equal(releaseId, root.GetProperty("releaseId").GetGuid());
    Assert.Equal("Fallen", root.GetProperty("release").GetProperty("title").GetString());
    Assert.Equal("digital", root.GetProperty("medium").GetProperty("type").GetString());
    Assert.False(root.GetProperty("medium").TryGetProperty("path", out _));
    Assert.False(root.GetProperty("medium").TryGetProperty("format", out _));

    JsonElement digital = root.GetProperty("details").GetProperty("digital");
    Assert.Equal(2, digital.GetProperty("releaseTrackCount").GetInt32());
    Assert.Equal(1, digital.GetProperty("linkedFileCount").GetInt32());
    Assert.Equal(1, digital.GetProperty("missingFileCount").GetInt32());
    JsonElement file = Assert.Single(digital.GetProperty("files").EnumerateArray());
    Assert.Equal(seed.LinkId, file.GetProperty("digitalTrackFileLinkId").GetGuid());
    Assert.Equal(seed.ReleaseTrackId, file.GetProperty("releaseTrackId").GetGuid());
    Assert.Equal(seed.LocalAudioFileId, file.GetProperty("localAudioFileId").GetGuid());
    Assert.Equal("/music/fallen/01-begins.flac", file.GetProperty("path").GetString());
    Assert.Equal("flac", file.GetProperty("format").GetString());
    Assert.Equal("abcdef0123", file.GetProperty("contentHash").GetString());
}

[Fact(DisplayName = "Owned item response exposes physical details separately from digital coverage")]
public async Task Owned_item_response_exposes_physical_details_separately_from_digital_coverage()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    Guid releaseId = await CreateReleaseAsync(client, "Physical Release");
    Guid ownedItemId = await CreateOwnedItemAsync(
        client,
        releaseId,
        new { type = "vinyl", description = "12-inch vinyl" },
        condition: "veryGood",
        storageLocation: "Shelf A3");

    using JsonDocument document = await GetJsonAsync(client, $"/api/owned-items/{ownedItemId}", HttpStatusCode.OK);
    JsonElement details = document.RootElement.GetProperty("details");

    Assert.Equal(JsonValueKind.Null, details.GetProperty("digital").ValueKind);
    Assert.Equal("veryGood", details.GetProperty("vinyl").GetProperty("condition").GetString());
    Assert.Equal("Shelf A3", details.GetProperty("vinyl").GetProperty("storageLocation").GetString());
    Assert.Equal("12-inch vinyl", details.GetProperty("vinyl").GetProperty("formatDescription").GetString());
}
```

Add test-local helpers in the same test file:

```csharp
private static async Task<Guid> CreateReleaseAsync(HttpClient client, string title)
{
    using JsonDocument document = await SendJsonAsync(
        client.PostAsJsonAsync("/api/releases", new { title, isVariousArtists = true }),
        HttpStatusCode.Created);
    return document.RootElement.GetProperty("id").GetGuid();
}

private static async Task<Guid> CreateReleaseWithTwoTracksAsync(HttpClient client)
{
    using JsonDocument document = await SendJsonAsync(
        client.PostAsJsonAsync(
            "/api/releases",
            new
            {
                title = "Fallen",
                type = "standalone",
                isVariousArtists = true,
                notOnLabel = true,
                tracklist = new object[]
                {
                    new { title = "Begins", position = 1 },
                    new { title = "Ends", position = 2 }
                }
            }),
        HttpStatusCode.Created);
    return document.RootElement.GetProperty("id").GetGuid();
}

private static async Task<Guid> CreateOwnedItemAsync(
    HttpClient client,
    Guid releaseId,
    object medium,
    string status = "owned",
    string? condition = null,
    string? storageLocation = null)
{
    using JsonDocument document = await SendJsonAsync(
        client.PostAsJsonAsync("/api/owned-items", new { releaseId, status, medium, condition, storageLocation }),
        HttpStatusCode.Created);
    return document.RootElement.GetProperty("id").GetGuid();
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~OwnedItemReleaseOwnedContractTests" --no-restore
```

Expected: FAIL because the test file helper methods or response properties do not exist yet.

- [ ] **Step 3: Implement release-only owned item request/response records**

Use these record shapes:

```csharp
public sealed record CreateOwnedItemRequest(
    Guid? ReleaseId,
    string Status,
    MediumRequest Medium,
    string? Condition,
    string? StorageLocation);

public sealed record UpdateOwnedItemRequest(
    string Status,
    string? Condition,
    string? StorageLocation,
    MediumRequest? Medium,
    Guid? ReleaseId);

public sealed record MediumRequest(string Type, string? Description, int? DiscCount);

public sealed record MediumResponse(string Type, string Description, int? DiscCount);

public sealed record OwnedItemResponse(
    Guid Id,
    Guid ReleaseId,
    OwnedItemReleaseResponse Release,
    string Status,
    MediumResponse Medium,
    OwnedItemDetailsResponse Details,
    IReadOnlyList<string> InventorySignals);
```

Also add `OwnedItemReleaseResponse`, `OwnedItemDetailsResponse`,
`DigitalOwnedItemDetailsResponse`, `DigitalFileCoverageResponse`,
`VinylOwnedItemDetailsResponse`, `CdOwnedItemDetailsResponse`,
`CassetteOwnedItemDetailsResponse`, and `OtherOwnedItemDetailsResponse`.

- [ ] **Step 4: Implement release-only owned item mapping**

In `OwnedItemMapper`, replace `CreateReleaseId(string? targetType, Guid targetId)` with:

```csharp
public static ReleaseId CreateReleaseId(Guid? releaseId)
{
    return releaseId is { } value && value != Guid.Empty
        ? new ReleaseId(value)
        : throw new DomainException("owned_item.release_required", "Owned item release is required");
}
```

Map medium responses without file fields:

```csharp
private static MediumResponse ToMediumResponse(IMedium medium)
{
    return medium switch
    {
        DigitalFile digitalFile => new MediumResponse(digitalFile.Code, digitalFile.Description, null),
        VinylRecord vinylRecord => new MediumResponse(vinylRecord.Code, vinylRecord.FormatDescription, null),
        CompactDisc compactDisc => new MediumResponse(compactDisc.Code, compactDisc.Description, compactDisc.DiscCount),
        CassetteTape cassetteTape => new MediumResponse(cassetteTape.Code, cassetteTape.TapeType, null),
        OtherMedium otherMedium => new MediumResponse(otherMedium.Code, otherMedium.Name, null),
        _ => throw new InvalidOperationException("Medium type is not supported")
    };
}
```

- [ ] **Step 5: Implement owned item details projection**

In `OwnedItemResponseMapper`, load release summaries, release track rows,
digital links, local audio files, and tracks for all requested owned items.
Build one `OwnedItemDetailsResponse` per item:

```csharp
private static OwnedItemDetailsResponse ToDetailsResponse(
    OwnedItem item,
    Release? release,
    IReadOnlyDictionary<OwnedItemId, DigitalFileCoverageResponse[]> digitalFilesByOwnedItemId,
    IReadOnlyDictionary<ReleaseId, int> releaseTrackCounts)
{
    return item.Holding.Medium switch
    {
        DigitalFile => OwnedItemDetailsResponse.ForDigital(new DigitalOwnedItemDetailsResponse(
            releaseTrackCounts.GetValueOrDefault(item.ReleaseId),
            digitalFilesByOwnedItemId.GetValueOrDefault(item.Id, []).Length,
            Math.Max(0, releaseTrackCounts.GetValueOrDefault(item.ReleaseId) - digitalFilesByOwnedItemId.GetValueOrDefault(item.Id, []).Length),
            digitalFilesByOwnedItemId.GetValueOrDefault(item.Id, []))),
        VinylRecord vinyl => OwnedItemDetailsResponse.ForVinyl(new VinylOwnedItemDetailsResponse(
            vinyl.FormatDescription,
            OptionalCondition(item),
            OptionalStorageLocation(item))),
        CompactDisc cd => OwnedItemDetailsResponse.ForCd(new CdOwnedItemDetailsResponse(
            cd.DiscCount,
            OptionalCondition(item),
            OptionalStorageLocation(item))),
        CassetteTape cassette => OwnedItemDetailsResponse.ForCassette(new CassetteOwnedItemDetailsResponse(
            cassette.TapeType,
            OptionalCondition(item),
            OptionalStorageLocation(item))),
        OtherMedium other => OwnedItemDetailsResponse.ForOther(new OtherOwnedItemDetailsResponse(
            other.Name,
            OptionalCondition(item),
            OptionalStorageLocation(item))),
        _ => throw new InvalidOperationException("Medium type is not supported")
    };
}
```

- [ ] **Step 6: Run owned item tests to verify GREEN**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~OwnedItemReleaseOwnedContractTests" --no-restore
```

Expected: PASS.

## Task 2: Backend Track Digital Files Projection

**Files:**
- Modify: `api/tests/DiscWeave.Api.Tests/TrackEndpointContractTests.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TrackResponse.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.Response.cs`
- Test: `api/tests/DiscWeave.Api.Tests/TrackEndpointContractTests.cs`

- [ ] **Step 1: Write failing track projection test**

Add this test to `TrackEndpointContractTests.cs`:

```csharp
[Fact(DisplayName = "Track responses expose related digital files as derived collection context")]
public async Task Track_responses_expose_related_digital_files_as_derived_collection_context()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    Guid releaseId = await CreateReleaseWithTrackAsync(client, "Fallen", "Begins");
    Guid trackId = await GetFirstTrackIdAsync(client, releaseId);
    Guid ownedItemId = await CreateOwnedItemAsync(client, releaseId, new { type = "digital" });
    DigitalFileSeed seed = await host.SeedDigitalTrackFileLinkAsync(
        releaseId,
        ownedItemId,
        releaseTrackPosition: 1,
        "/music/fallen/01-begins.flac",
        "flac",
        "ABCDEF0123");

    using HttpResponseMessage getResponse = await client.GetAsync($"/api/tracks/{trackId}");
    using JsonDocument getDocument = await ReadJsonAsync(getResponse);
    using HttpResponseMessage listResponse = await client.GetAsync("/api/tracks?search=Begins&limit=10&offset=0");
    using JsonDocument listDocument = await ReadJsonAsync(listResponse);

    Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
    JsonElement file = Assert.Single(getDocument.RootElement.GetProperty("digitalFiles").EnumerateArray());
    Assert.Equal(seed.LinkId, file.GetProperty("digitalTrackFileLinkId").GetGuid());
    Assert.Equal(seed.LocalAudioFileId, file.GetProperty("localAudioFileId").GetGuid());
    Assert.Equal(ownedItemId, file.GetProperty("digitalOwnedItemId").GetGuid());
    Assert.Equal(releaseId, file.GetProperty("releaseId").GetGuid());
    Assert.Equal("Fallen", file.GetProperty("releaseTitle").GetString());
    Assert.Equal("/music/fallen/01-begins.flac", file.GetProperty("path").GetString());
    Assert.Equal("flac", file.GetProperty("format").GetString());
    Assert.Equal("abcdef0123", file.GetProperty("contentHash").GetString());
    Assert.Single(listDocument.RootElement.GetProperty("items")[0].GetProperty("digitalFiles").EnumerateArray());
}
```

Add these helpers to `TrackEndpointContractTests.cs`:

```csharp
private static async Task<Guid> CreateReleaseWithTrackAsync(HttpClient client, string releaseTitle, string trackTitle)
{
    using HttpResponseMessage response = await client.PostAsJsonAsync(
        "/api/releases",
        new
        {
            title = releaseTitle,
            type = "standalone",
            isVariousArtists = true,
            notOnLabel = true,
            tracklist = new object[] { new { title = trackTitle, position = 1 } }
        });
    using JsonDocument document = await ReadJsonAsync(response);
    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    return document.RootElement.GetProperty("id").GetGuid();
}

private static async Task<Guid> GetFirstTrackIdAsync(HttpClient client, Guid releaseId)
{
    using HttpResponseMessage response = await client.GetAsync($"/api/releases/{releaseId}");
    using JsonDocument document = await ReadJsonAsync(response);
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    return document.RootElement.GetProperty("tracklist")[0].GetProperty("trackId").GetGuid();
}

private static async Task<Guid> CreateOwnedItemAsync(HttpClient client, Guid releaseId, object medium)
{
    using HttpResponseMessage response = await client.PostAsJsonAsync(
        "/api/owned-items",
        new { releaseId, status = "owned", medium });
    using JsonDocument document = await ReadJsonAsync(response);
    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    return document.RootElement.GetProperty("id").GetGuid();
}
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~TrackEndpointContractTests&FullyQualifiedName~digital_files" --no-restore
```

Expected: FAIL because `digitalFiles` is missing.

- [ ] **Step 3: Add track digital file response records**

Extend `TrackResponse`:

```csharp
public sealed record TrackResponse(
    Guid Id,
    string Title,
    int? DurationSeconds,
    IReadOnlyList<string> Genres,
    IReadOnlyList<string> Tags,
    IReadOnlyList<ExternalSourceReferenceResponse> ExternalSources,
    IReadOnlyList<TrackCreditResponse> Credits,
    IReadOnlyList<TrackReleaseAppearanceResponse> ReleaseAppearances,
    IReadOnlyList<TrackDigitalFileResponse> DigitalFiles);
```

Add `TrackDigitalFileResponse` with the same identity and file metadata fields
as the test asserts.

- [ ] **Step 4: Load and map digital files through release track appearances**

In `ToTrackResponsesAsync`, after loading appearance releases, load file rows
from `DigitalTrackFileLinks` where `ReleaseTrackId` matches a release track
appearance for the requested tracks. Group the mapped rows by `TrackId` and pass
the group into `ToTrackResponse`.

- [ ] **Step 5: Run track projection test to verify GREEN**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~TrackEndpointContractTests" --no-restore
```

Expected: PASS.

## Task 3: Backend Local Audio File Update Endpoint

**Files:**
- Create: `api/tests/DiscWeave.Api.Tests/LocalAudioFileEndpointTests.cs`
- Create: `api/src/DiscWeave.Api/Features/LocalFiles/LocalAudioFileContracts.cs`
- Create: `api/src/DiscWeave.Api/Features/LocalFiles/LocalAudioFileContractMapper.cs`
- Create: `api/src/DiscWeave.Api/Features/LocalFiles/LocalAudioFilesEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/DiscWeaveEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/LocalAudioFile.cs`
- Test: `api/tests/DiscWeave.Api.Tests/LocalAudioFileEndpointTests.cs`

- [ ] **Step 1: Write failing local audio file endpoint tests**

Create tests for:

```csharp
[Fact(DisplayName = "Local audio file patch updates file identity and inspection metadata")]
public async Task Local_audio_file_patch_updates_file_identity_and_inspection_metadata()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    LocalAudioFileSeed seed = await host.SeedLocalAudioFileAsync("/music/old.flac", "flac", "oldhash");

    using JsonDocument document = await PatchJsonAsync(
        client,
        $"/api/local-audio-files/{seed.LocalAudioFileId}",
        new
        {
            path = "/music/new.m4a",
            format = "m4a",
            codec = "alac",
            quality = "lossless",
            sizeBytes = 98765,
            lastModifiedAt = "2026-06-19T10:30:00Z",
            contentHash = "ABCDEF",
            durationSeconds = 245,
            bitrateKbps = 900,
            sampleRateHz = 48000,
            channels = 2
        },
        HttpStatusCode.OK);

    JsonElement root = document.RootElement;
    Assert.Equal(seed.LocalAudioFileId, root.GetProperty("id").GetGuid());
    Assert.Equal("/music/new.m4a", root.GetProperty("path").GetString());
    Assert.Equal("m4a", root.GetProperty("format").GetString());
    Assert.Equal("alac", root.GetProperty("codec").GetString());
    Assert.Equal("lossless", root.GetProperty("quality").GetString());
    Assert.Equal("abcdef", root.GetProperty("contentHash").GetString());
    Assert.Equal(245, root.GetProperty("durationSeconds").GetInt32());
}

[Fact(DisplayName = "Local audio file patch stays scoped to authenticated collection")]
public async Task Local_audio_file_patch_stays_scoped_to_authenticated_collection()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    (HttpClient adminClient, HttpClient userClient) = await CreateAuthenticatedClientsAsync(host);
    LocalAudioFileSeed seed = await host.SeedLocalAudioFileAsync(host.DefaultCollectionId, "/music/admin.flac", "flac", "adminhash");

    using JsonDocument document = await PatchJsonAsync(
        userClient,
        $"/api/local-audio-files/{seed.LocalAudioFileId}",
        new { path = "/music/user.flac" },
        HttpStatusCode.NotFound);

    Assert.Equal("local_audio_file.not_found", document.RootElement.GetProperty("code").GetString());
}
```

Add these helpers to `LocalAudioFileEndpointTests.cs`:

```csharp
private static async Task<(HttpClient AdminClient, HttpClient UserClient)> CreateAuthenticatedClientsAsync(ApiTestHost host)
{
    HttpClient adminClient = host.CreateClient();
    using HttpResponseMessage registerResponse = await adminClient.PostAsJsonAsync(
        "/api/auth/register",
        new { email = "owner@example.com", password = "Password1!" });
    Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

    using HttpResponseMessage createUserResponse = await adminClient.PostAsJsonAsync(
        "/api/admin/users",
        new { email = "collector@example.com", password = "Password1!", isAdmin = false });
    Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);

    HttpClient userClient = host.CreateClient();
    using HttpResponseMessage loginResponse = await userClient.PostAsJsonAsync(
        "/api/auth/login",
        new { email = "collector@example.com", password = "Password1!" });
    Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

    return (adminClient, userClient);
}

private static async Task<JsonDocument> PatchJsonAsync(
    HttpClient client,
    string path,
    object request,
    HttpStatusCode expectedStatus)
{
    using var message = new HttpRequestMessage(HttpMethod.Patch, path)
    {
        Content = JsonContent.Create(request)
    };
    using HttpResponseMessage response = await client.SendAsync(message);
    string content = await response.Content.ReadAsStringAsync();
    Assert.Equal(expectedStatus, response.StatusCode);
    return JsonDocument.Parse(content);
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~LocalAudioFileEndpointTests" --no-restore
```

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Add `MoveTo` domain method**

In `LocalAudioFile.cs` add:

```csharp
public LocalAudioFile MoveTo(FilePath path)
{
    ArgumentNullException.ThrowIfNull(path);

    Path = path;
    return this;
}
```

- [ ] **Step 4: Add local audio file endpoint**

Create `/api/local-audio-files` route group with:

```csharp
_ = group.MapPatch("/{localAudioFileId:guid}", UpdateLocalAudioFileAsync)
    .WithName("UpdateLocalAudioFile");
```

The handler must:

- find the file by current collection and id;
- return `local_audio_file.not_found` on missing or cross-collection access;
- apply any supplied request fields through `LocalAudioFile` methods;
- catch `DomainException` and `ArgumentException` as `400`;
- catch `ResourceConflictException` as `409 local_audio_file.path_conflict`;
- return a `LocalAudioFileResponse`.

- [ ] **Step 5: Run local endpoint tests to verify GREEN**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~LocalAudioFileEndpointTests" --no-restore
```

Expected: PASS.

## Task 4: Backend Existing Test Migration

**Files:**
- Modify: API tests under `api/tests/DiscWeave.Api.Tests` that post to `/api/owned-items`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.RestoreEntities.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.RestoreMapping.cs`
- Test: `api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj`

- [ ] **Step 1: Run current API tests to expose contract fallout**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --no-restore
```

Expected: FAIL in tests that still send owned-item `targetType/targetId` or assert old response fields.

- [ ] **Step 2: Update owned-item test request helpers**

Change helper payloads from:

```csharp
new { targetType = "release", targetId = releaseId, status, medium }
```

to:

```csharp
new { releaseId, status, medium }
```

- [ ] **Step 3: Update owned-item response assertions**

Change assertions from:

```csharp
Assert.Equal("release", root.GetProperty("targetType").GetString());
Assert.Equal(releaseId, root.GetProperty("targetId").GetGuid());
```

to:

```csharp
Assert.Equal(releaseId, root.GetProperty("releaseId").GetGuid());
Assert.Equal("Release title", root.GetProperty("release").GetProperty("title").GetString());
```

Change physical fields from top-level `condition` and `storageLocation` to
`details.<mediumType>.condition` and `details.<mediumType>.storageLocation`.

- [ ] **Step 4: Update export restore mapping for new owned-item response**

Restore owned items using:

```csharp
var item = OwnedItem.Create(
    collectionId,
    new OwnedItemId(response.Id),
    new ReleaseId(response.ReleaseId),
    OwnedItemMapper.ParseOwnershipStatus(response.Status),
    medium);
```

Extract physical detail values from `response.Details` instead of top-level
fields.

- [ ] **Step 5: Run API tests to verify GREEN**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --no-restore
```

Expected: PASS.

## Task 5: Frontend DTOs And Mappers

**Files:**
- Modify: `app/src/features/catalog/api/catalogTypes.ts`
- Modify: `app/src/features/catalog/api/ownedItemsClient.ts`
- Modify: `app/src/features/catalog/api/ownedItemEntityMappers.ts`
- Modify: `app/src/features/catalog/api/catalogEntityMappers.ts`
- Modify: `app/src/features/tracks/tracksData.ts`
- Test: `app/src/features/catalog/catalogApi.mapping.test.ts`
- Test: `app/src/features/localFiles/localFileEditModel.test.ts`

- [ ] **Step 1: Update failing frontend tests for new DTO shape**

In mapping and local edit model tests, replace track file data:

```ts
fileMetadata: {
  ownedItemId: 'owned-file',
  path: '/music/file.flac',
  format: 'FLAC',
  bitrate: 'Lossless',
  sampleRate: '44.1 kHz',
  channels: 'Stereo',
  importedAt: 'Mock import',
  checksum: 'sha256:sample',
}
```

with:

```ts
digitalFiles: [
  {
    digitalTrackFileLinkId: 'link-file',
    localAudioFileId: 'local-file',
    digitalOwnedItemId: 'owned-file',
    releaseId: 'release-id',
    releaseTitle: 'Release title',
    releaseTrackId: 'release-track-file',
    position: 1,
    path: '/music/file.flac',
    format: 'flac',
    quality: 'lossless',
    sampleRateHz: 44100,
    channels: 2,
    contentHash: 'sha256:sample',
  },
]
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- localFileEditModel catalogApi.mapping
```

from `app/`.

Expected: FAIL because `TrackRecord.digitalFiles` and `updateLocalAudioFile`
are not wired yet.

- [ ] **Step 3: Update frontend DTOs**

Add:

```ts
export type OwnedItemTargetType = 'release'

export type TrackDigitalFileDto = {
  digitalTrackFileLinkId: string
  localAudioFileId: string
  digitalOwnedItemId: string
  releaseId: string
  releaseTitle: string
  releaseTrackId: string
  position: number
  disc?: string | null
  side?: string | null
  path: string
  format?: string | null
  codec?: string | null
  quality?: string | null
  sizeBytes?: number | null
  modifiedAt?: string | null
  contentHash?: string | null
  durationSeconds?: number | null
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
}
```

Set `TrackDto.digitalFiles?: TrackDigitalFileDto[]`.

- [ ] **Step 4: Update track view model and mappers**

Replace `LocalFileMetadata` with:

```ts
export type TrackDigitalFile = {
  digitalTrackFileLinkId: string
  localAudioFileId: string
  digitalOwnedItemId: string
  releaseId: string
  releaseTitle: string
  releaseTrackId: string
  position: string
  disc?: string
  side?: string
  path: string
  format: string
  codec: string
  quality: string
  sizeBytes?: number
  modifiedAt?: string
  contentHash: string
  duration: string
  bitrate: string
  sampleRate: string
  channels: string
}
```

Set `TrackRecord.digitalFiles: TrackDigitalFile[]` and map
`track.digitalFiles ?? []` in `toTrackRecord`.

- [ ] **Step 5: Add local audio file client**

Replace `updateOwnedItemDigitalFile` with:

```ts
export async function updateLocalAudioFile(
  localAudioFileId: string,
  request: LocalAudioFileUpdateRequest,
) {
  return sendJson<LocalAudioFileDto>(
    `/api/local-audio-files/${encodeURIComponent(localAudioFileId)}`,
    'PATCH',
    request,
  )
}
```

- [ ] **Step 6: Run frontend focused tests to verify GREEN**

Run from `app/`:

```bash
npm test -- localFileEditModel catalogApi.mapping
```

Expected: PASS.

## Task 6: Frontend Local Edit Identifier Cleanup

**Files:**
- Modify: `app/src/desktop.d.ts`
- Modify: `app/electron/local-edits.cjs`
- Modify: `app/electron/local-edits.test.cjs`
- Modify: `app/electron/preload-contract.test.cjs`
- Modify: `app/src/features/localFiles/*`
- Modify: `app/src/App.local-file-editor.test.tsx`
- Modify: `app/src/App.local-file-editor-partial-failure.test.tsx`
- Modify: `app/src/App.local-file-tag-editor.test.tsx`
- Test: Electron and app local file tests

- [ ] **Step 1: Update local edit tests from owned item ids to local file ids**

Replace local-edit payload keys:

```ts
ownedItemId: 'owned-polynomial-c-file'
```

with:

```ts
localAudioFileId: 'local-polynomial-c-file'
```

Only apply this in local-file edit payloads and tests. Do not rename unrelated
owned item inventory data.

- [ ] **Step 2: Run tests to verify RED**

Run from `app/`:

```bash
npm test -- local-edits local-file-editor local-file-tag-editor
```

Expected: FAIL because implementation still uses `ownedItemId`.

- [ ] **Step 3: Rename local edit identifiers in implementation**

Use `localAudioFileId` in:

- `LocalEditableFile`;
- `LocalEditableFileDraft`;
- `LocalEditInspectRequest`;
- `LocalEditFileRequest`;
- `LocalEditPreviewChange`;
- `LocalEditApplyResult.files`;
- Electron operation logs;
- local file edit table row keys;
- catalog reconciliation maps.

Keep `digitalOwnedItemId` only as display/context data from `TrackDigitalFile`.

- [ ] **Step 4: Reconcile catalog files through local audio file endpoint**

Update `reconcileCatalogFiles`:

```ts
await updateLocalAudioFile(file.localAudioFileId, {
  path: file.path,
  format: file.format,
  sizeBytes: file.sizeBytes,
  lastModifiedAt: file.lastModifiedAt,
  contentHash: file.contentHash,
})
```

- [ ] **Step 5: Run local edit tests to verify GREEN**

Run from `app/`:

```bash
npm test -- local-edits local-file-editor local-file-tag-editor
```

Expected: PASS.

## Task 7: Full Verification And Commits

**Files:**
- All files changed by prior tasks.

- [ ] **Step 1: Run backend verification**

Run:

```bash
dotnet test api/DiscWeave.slnx --no-restore
```

Expected: PASS.

- [ ] **Step 2: Run frontend verification**

Run from `app/`:

```bash
npm run typecheck
npm test
```

Expected: PASS.

- [ ] **Step 3: Run final status check**

Run:

```bash
git status --short
```

Expected: only intentional Roadmap 60 files are modified.

- [ ] **Step 4: Commit implementation**

Commit in focused slices if possible:

```bash
git add api/src api/tests
git commit -m "Update release-owned API contracts"
git add app/src app/electron
git commit -m "Update local file client contracts"
```
