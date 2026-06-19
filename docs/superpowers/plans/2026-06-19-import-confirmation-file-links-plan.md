# Import Confirmation File Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update desktop release import confirmation so confirmed digital releases create/reuse digital owned items, local audio files, and digital track file links, and scan deduplication reads those links.

**Architecture:** Keep import endpoints unchanged. Add the missing application behavior behind confirmation and scan deduplication: confirmation writes `LocalAudioFile` and `DigitalTrackFileLink` rows transactionally; scan dedupe joins confirmed links back to release-track candidates. Keep old owned-item file payload columns removed.

**Tech Stack:** .NET 10, C# 14, ASP.NET Core Minimal APIs, EF Core 10, SQLite, xUnit.

---

## File Structure

Modify:

- `api/tests/DiscWeave.Api.Tests/ApiTestHost.cs` - add test-only query helpers for local audio file and digital track file link state.
- `api/tests/DiscWeave.Api.Tests/DesktopImportEndpointTests.cs` - assert confirmation creates file rows and links.
- `api/tests/DiscWeave.Api.Tests/DesktopImportEndpointTests.Concurrency.cs` - assert concurrent confirmation creates one file row and one link.
- `api/tests/DiscWeave.Api.Tests/DesktopImportHashDedupeTests.cs` - restore hash-based duplicate scan expectations through local file links.
- `api/tests/DiscWeave.Api.Tests/DesktopImportReviewDeduplicationTests.cs` - restore partial duplicate/manual selected-track behavior through local file links.
- `api/tests/DiscWeave.Api.Tests/DesktopImportPartialDuplicateAmbiguityTests.cs` - restore unambiguous local-file duplicate preselection while preserving ambiguity behavior.
- `api/tests/DiscWeave.Api.Tests/ImportCollectionIsolationEndpointTests.cs` - keep collection-scoped dedupe expectations and add link-count assertions.
- `api/src/DiscWeave.Domain/Collection/DigitalTrackFileLink.cs` - add a narrow method for replacing the linked local file after explicit import confirmation.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.cs` - pass resolved track ids into file-link confirmation.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Files.cs` - create/reuse digital owned item, local audio files, and file links.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Hash.cs` - implement hash-based duplicate lookup from local file links.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Fingerprint.cs` - implement fingerprint/path duplicate lookup from local file links.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Candidates.cs` - restore candidate loading and distinct candidate helpers used by hash and fingerprint queries.

No UI files should change in this issue.

## Task 1: Add Failing Import Confirmation File-Link Tests

**Files:**

- Modify: `api/tests/DiscWeave.Api.Tests/ApiTestHost.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/DesktopImportEndpointTests.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/DesktopImportEndpointTests.Concurrency.cs`

- [ ] **Step 1: Add test-only snapshots and query helpers**

In `api/tests/DiscWeave.Api.Tests/ApiTestHost.cs`, add:

```csharp
public async Task<LocalAudioFileSnapshot[]> LocalAudioFilesAsync(CancellationToken cancellationToken = default)
{
    await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
    DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();

    LocalAudioFile[] files = await context.LocalAudioFiles.AsNoTracking()
        .Where(file => file.CollectionId == DefaultCollectionId)
        .OrderBy(file => file.Path.Value)
        .ToArrayAsync(cancellationToken);

    return
    [
        .. files.Select(file => new LocalAudioFileSnapshot(
            file.Id.Value,
            file.Path.Value,
            file.Format.Match(format => format.ToString(), () => null),
            file.SizeBytes.Match(size => size, () => null),
            file.ModifiedAt.Match(modifiedAt => modifiedAt, () => null),
            file.ContentHash.Match(hash => hash, () => null)))
    ];
}

public async Task<DigitalTrackFileLinkSnapshot[]> DigitalTrackFileLinksAsync(CancellationToken cancellationToken = default)
{
    await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
    DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();

    return await context.DigitalTrackFileLinks.AsNoTracking()
        .Where(link => link.CollectionId == DefaultCollectionId)
        .OrderBy(link => link.ReleaseTrackId.Value)
        .Select(link => new DigitalTrackFileLinkSnapshot(
            link.Id.Value,
            link.DigitalOwnedItemId.Value,
            link.ReleaseTrackId.Value,
            link.LocalAudioFileId.Value))
        .ToArrayAsync(cancellationToken);
}

internal sealed record LocalAudioFileSnapshot(
    Guid Id,
    string Path,
    string? Format,
    long? SizeBytes,
    DateTimeOffset? ModifiedAt,
    string? ContentHash);

internal sealed record DigitalTrackFileLinkSnapshot(
    Guid Id,
    Guid DigitalOwnedItemId,
    Guid ReleaseTrackId,
    Guid LocalAudioFileId);
```

- [ ] **Step 2: Extend the basic confirmation test**

In `Desktop_scan_persists_draft_and_confirm_creates_catalog_data`, after reading owned items, add:

```csharp
LocalAudioFileSnapshot[] localFiles = await host.LocalAudioFilesAsync();
DigitalTrackFileLinkSnapshot[] fileLinks = await host.DigitalTrackFileLinksAsync();

LocalAudioFileSnapshot localFile = Assert.Single(localFiles);
Assert.Equal(audioPath, localFile.Path);
Assert.Equal("Flac", localFile.Format);
Assert.Equal(9, localFile.SizeBytes);
Assert.NotNull(localFile.ModifiedAt);

DigitalTrackFileLinkSnapshot fileLink = Assert.Single(fileLinks);
Assert.Equal(localFile.Id, fileLink.LocalAudioFileId);
Assert.Equal(ownedItems[0].GetProperty("id").GetGuid(), fileLink.DigitalOwnedItemId);
Assert.NotEqual(Guid.Empty, fileLink.ReleaseTrackId);
```

- [ ] **Step 3: Extend the concurrency test**

In `Concurrent_desktop_import_confirmations_create_one_release`, after the owned item total assertion, add:

```csharp
Assert.Single(await host.LocalAudioFilesAsync());
Assert.Single(await host.DigitalTrackFileLinksAsync());
```

- [ ] **Step 4: Run focused tests and verify red**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportEndpointTests" --no-restore
```

Expected: FAIL because confirmation still creates no local audio files and no digital track file links.

- [ ] **Step 5: Commit failing tests**

```bash
git add api/tests/DiscWeave.Api.Tests/ApiTestHost.cs api/tests/DiscWeave.Api.Tests/DesktopImportEndpointTests.cs api/tests/DiscWeave.Api.Tests/DesktopImportEndpointTests.Concurrency.cs
git commit -m "test: cover import confirmation file links"
```

## Task 2: Add Minimal Domain Relink Behavior

**Files:**

- Modify: `api/src/DiscWeave.Domain/Collection/DigitalTrackFileLink.cs`
- Modify: `api/tests/DiscWeave.Domain.Tests/Collection/DigitalFileImportIdentityTests.cs`

- [ ] **Step 1: Add a failing domain test for explicit relink**

In `DigitalFileImportIdentityTests`, add:

```csharp
[Fact]
public void Digital_track_file_link_can_be_relinked_after_explicit_confirmation()
{
    var collectionId = CollectionId.New();
    var ownedItemId = OwnedItemId.New();
    var releaseTrackId = ReleaseTrackId.New();
    var originalFileId = LocalAudioFileId.New();
    var replacementFileId = LocalAudioFileId.New();
    DigitalTrackFileLink link = DigitalTrackFileLink.Create(
        collectionId,
        DigitalTrackFileLinkId.New(),
        ownedItemId,
        releaseTrackId,
        originalFileId);

    link.Relink(replacementFileId);

    Assert.Equal(replacementFileId, link.LocalAudioFileId);
}
```

- [ ] **Step 2: Run the focused domain test and verify red**

Run:

```bash
dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~DigitalFileImportIdentityTests" --no-restore
```

Expected: FAIL because `DigitalTrackFileLink.Relink` does not exist.

- [ ] **Step 3: Implement the minimal domain method**

In `DigitalTrackFileLink`, add:

```csharp
public DigitalTrackFileLink Relink(LocalAudioFileId localAudioFileId)
{
    LocalAudioFileId = localAudioFileId;
    return this;
}
```

- [ ] **Step 4: Run the focused domain test and verify green**

Run:

```bash
dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~DigitalFileImportIdentityTests" --no-restore
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/DiscWeave.Domain/Collection/DigitalTrackFileLink.cs api/tests/DiscWeave.Domain.Tests/Collection/DigitalFileImportIdentityTests.cs
git commit -m "Add explicit digital track file relink"
```

## Task 3: Implement Confirmation File-Link Writes

**Files:**

- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Files.cs`

- [ ] **Step 1: Change confirmation call sites to pass resolved track ids**

Replace calls to `AddTrackFileOwnedItemsAsync` and `AddReleaseOwnedItemAsync` in `ReleaseImportConfirmationService.cs` with one call:

```csharp
await AddReleaseFileLinksAsync(
    context,
    collectionId,
    existingRelease,
    tracks,
    resolvedTrackIdsByDraftTrackId,
    cancellationToken);
```

Apply the same call for `partialDuplicateRelease` and newly created `release`.

- [ ] **Step 2: Replace the disabled file helper**

In `ReleaseImportConfirmationService.Files.cs`, replace `AddTrackFileOwnedItemsAsync` and `AddReleaseOwnedItemAsync` with:

```csharp
private static async Task AddReleaseFileLinksAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    Release release,
    IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
    IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
    CancellationToken cancellationToken)
{
    OwnedItem digitalOwnedItem = await GetOrCreateDigitalOwnedItemAsync(
        context,
        collectionId,
        release,
        cancellationToken);
    Dictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId = release.Tracklist
        .GroupBy(track => track.TrackId)
        .ToDictionary(group => group.Key, group => group.OrderBy(track => track.Position.Number).ToArray());

    foreach (ReleaseImportDraftTrack draftTrack in draftTracks.Where(track => !track.IsSkipped))
    {
        if (!resolvedTrackIdsByDraftTrackId.TryGetValue(draftTrack.Id, out TrackId trackId))
        {
            throw new DomainException("release_import.release_track_not_resolved", "Release import track was not resolved");
        }

        ReleaseTrack releaseTrack = ResolveReleaseTrackForDraftTrack(releaseTracksByTrackId, trackId, draftTrack);
        LocalAudioFile localFile = await GetOrCreateLocalAudioFileAsync(context, collectionId, draftTrack, cancellationToken);
        await UpsertDigitalTrackFileLinkAsync(
            context,
            collectionId,
            digitalOwnedItem.Id,
            releaseTrack.Id,
            localFile.Id,
            cancellationToken);
    }
}
```

- [ ] **Step 3: Add digital owned item helper**

Add:

```csharp
private static async Task<OwnedItem> GetOrCreateDigitalOwnedItemAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    Release release,
    CancellationToken cancellationToken)
{
    OwnedItem? existing = await context.OwnedItems.SingleOrDefaultAsync(
        item =>
            item.CollectionId == collectionId &&
            EF.Property<ReleaseId>(item, "_releaseId") == release.Id &&
            EF.Property<string>(item, "_mediumType") == DigitalMediumType,
        cancellationToken);
    if (existing is not null)
    {
        return existing;
    }

    var item = OwnedItem.Create(
        collectionId,
        OwnedItemId.New(),
        release.Id,
        OwnershipStatus.Owned,
        DigitalFile.Create());
    _ = context.OwnedItems.Add(item);

    return item;
}
```

- [ ] **Step 4: Add release-track resolver**

Add:

```csharp
private static ReleaseTrack ResolveReleaseTrackForDraftTrack(
    IReadOnlyDictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId,
    TrackId trackId,
    ReleaseImportDraftTrack draftTrack)
{
    if (!releaseTracksByTrackId.TryGetValue(trackId, out ReleaseTrack[]? candidates) || candidates.Length == 0)
    {
        throw new DomainException("release_import.release_track_not_resolved", "Release import track was not resolved");
    }

    if (draftTrack.Position is { } position)
    {
        ReleaseTrack[] positionMatches = [.. candidates.Where(track => track.Position.Number == position)];
        if (positionMatches.Length == 1)
        {
            return positionMatches[0];
        }
    }

    if (candidates.Length == 1)
    {
        return candidates[0];
    }

    throw new DomainException("release_import.release_track_ambiguous", "Release import track mapping is ambiguous");
}
```

- [ ] **Step 5: Add local file resolver**

Add:

```csharp
private static async Task<LocalAudioFile> GetOrCreateLocalAudioFileAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    ReleaseImportDraftTrack draftTrack,
    CancellationToken cancellationToken)
{
    FilePath path = FilePath.FromAbsolutePath(draftTrack.FilePath);
    LocalAudioFile? existing = await context.LocalAudioFiles.SingleOrDefaultAsync(
        file => file.CollectionId == collectionId && file.Path == path,
        cancellationToken);
    if (existing is not null)
    {
        return ApplyDraftFileMetadata(existing, draftTrack);
    }

    LocalAudioFile created = ApplyDraftFileMetadata(
        LocalAudioFile.Create(collectionId, LocalAudioFileId.New(), path),
        draftTrack);
    _ = context.LocalAudioFiles.Add(created);

    return created;
}
```

- [ ] **Step 6: Add local file metadata mapper**

Add:

```csharp
private static LocalAudioFile ApplyDraftFileMetadata(LocalAudioFile file, ReleaseImportDraftTrack draftTrack)
{
    file.WithFormat(draftTrack.Format)
        .WithSizeBytes(draftTrack.SizeBytes)
        .WithModifiedAt(draftTrack.LastModifiedAt);

    if (draftTrack.ContentHash is PresentOptionalValue<string> contentHash)
    {
        file.WithContentHash(contentHash.Value);
        file.WithImportIdentity(FileImportIdentity.Create(
            FilePath.FromAbsolutePath(draftTrack.FilePath),
            draftTrack.SizeBytes,
            draftTrack.LastModifiedAt,
            contentHash.Value));
    }
    else
    {
        file.WithImportIdentity(FileImportIdentity.Create(
            FilePath.FromAbsolutePath(draftTrack.FilePath),
            draftTrack.SizeBytes,
            draftTrack.LastModifiedAt));
    }

    return file;
}
```

Ensure the file has `using DiscWeave.Domain.SharedKernel.Optional;`.

- [ ] **Step 7: Add link upsert helper**

Add:

```csharp
private static async Task UpsertDigitalTrackFileLinkAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    OwnedItemId digitalOwnedItemId,
    ReleaseTrackId releaseTrackId,
    LocalAudioFileId localAudioFileId,
    CancellationToken cancellationToken)
{
    DigitalTrackFileLink? existing = await context.DigitalTrackFileLinks.SingleOrDefaultAsync(
        link =>
            link.CollectionId == collectionId &&
            link.DigitalOwnedItemId == digitalOwnedItemId &&
            link.ReleaseTrackId == releaseTrackId,
        cancellationToken);
    if (existing is not null)
    {
        if (existing.LocalAudioFileId != localAudioFileId)
        {
            existing.Relink(localAudioFileId);
        }

        return;
    }

    _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
        collectionId,
        DigitalTrackFileLinkId.New(),
        digitalOwnedItemId,
        releaseTrackId,
        localAudioFileId));
}
```

- [ ] **Step 8: Run focused confirmation tests and verify green**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportEndpointTests" --no-restore
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.cs api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Files.cs
git commit -m "Create file links during import confirmation"
```

## Task 4: Restore Hash-Based Scan Deduplication

**Files:**

- Modify: `api/tests/DiscWeave.Api.Tests/DesktopImportHashDedupeTests.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Hash.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Candidates.cs`

- [ ] **Step 1: Restore hash dedupe test expectations**

In `DesktopImportHashDedupeTests`, rename the first test to:

```csharp
[Fact(DisplayName = "Desktop import uses content hash to preselect moved duplicate files and confirm with a new file row")]
public async Task Desktop_import_uses_content_hash_to_preselect_moved_duplicate_files_and_confirm_with_new_file_row()
```

Inside the test, after the first confirmation, restore:

```csharp
Guid existingTrackId = await SingleTrackIdAsync(client);
```

For the duplicate scan assertions, use:

```csharp
Assert.Equal(existingTrackId, duplicateTrack.GetProperty("selectedTrackId").GetGuid());
Assert.Contains(
    duplicateTrack.GetProperty("issues").EnumerateArray(),
    issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
```

After confirming the duplicate scan, assert:

```csharp
await AssertListTotalAsync(client, "/api/releases?search=Fallen&limit=10&offset=0", 1);
await AssertListTotalAsync(client, "/api/tracks?search=Begins&limit=10&offset=0", 1);
await AssertListTotalAsync(client, "/api/owned-items?limit=10&offset=0", 1);
Assert.Equal(2, (await host.LocalAudioFilesAsync()).Length);
Assert.Single(await host.DigitalTrackFileLinksAsync());
```

Restore the `SingleTrackIdAsync` helper that queries `/api/tracks?search=Begins&limit=10&offset=0`.

- [ ] **Step 2: Run the hash dedupe test and verify red**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportHashDedupeTests" --no-restore
```

Expected: FAIL because `LoadHashDuplicateMatchesAsync` still returns an empty dictionary.

- [ ] **Step 3: Restore candidate loading helpers**

In `ReleaseImportScanService.Deduplication.Candidates.cs`, add:

```csharp
private static async Task<Dictionary<ReleaseId, DuplicateTrackCandidate[]>> LoadReleaseTrackCandidatesAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    ReleaseId[] releaseIds,
    CancellationToken cancellationToken)
{
    if (releaseIds.Length == 0)
    {
        return [];
    }

    Release[] releases = await context.Releases.AsNoTracking()
        .Include(release => release.Tracklist)
        .Where(release => release.CollectionId == collectionId && releaseIds.Contains(release.Id))
        .ToArrayAsync(cancellationToken);
    TrackId[] trackIds =
    [
        .. releases
            .SelectMany(release => release.Tracklist)
            .Select(track => track.TrackId)
            .Distinct()
    ];
    Dictionary<TrackId, string> titlesByTrackId = trackIds.Length == 0
        ? []
        : await context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId && trackIds.Contains(track.Id))
            .ToDictionaryAsync(track => track.Id, track => track.Title, cancellationToken);

    return releases.ToDictionary(
        release => release.Id,
        release => release.Tracklist
            .OrderBy(track => track.Position.Number)
            .Select(track => new DuplicateTrackCandidate(
                track.TrackId,
                track.Position.Number,
                TrackTitle(track, titlesByTrackId)))
            .ToArray());
}

private static DuplicateTrackCandidate[] DistinctCandidates(IReadOnlyList<DuplicateTrackCandidate> candidates)
{
    return
    [
        .. candidates
            .DistinctBy(candidate => (candidate.TrackId, candidate.Position, candidate.Title))
            .OrderBy(candidate => candidate.Position)
            .ThenBy(candidate => candidate.Title, StringComparer.OrdinalIgnoreCase)
            .ThenBy(candidate => candidate.TrackId.Value)
    ];
}

private static string TrackTitle(ReleaseTrack releaseTrack, Dictionary<TrackId, string> titlesByTrackId)
{
    return releaseTrack.TitleOverride is { HasValue: true } titleOverride
        ? titleOverride.Match(static value => value, static () => string.Empty)
        : titlesByTrackId.TryGetValue(releaseTrack.TrackId, out string? title) ? title : string.Empty;
}
```

Add `using DiscWeave.Domain.Catalog;`, `using DiscWeave.Infrastructure.Persistence;`, and `using Microsoft.EntityFrameworkCore;`.

- [ ] **Step 4: Implement hash lookup through local file links**

Replace `LoadHashDuplicateMatchesAsync` with:

```csharp
private static async Task<Dictionary<string, DuplicateTrackCandidate[]>> LoadHashDuplicateMatchesAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    string[] contentHashes,
    CancellationToken cancellationToken)
{
    if (contentHashes.Length == 0)
    {
        return [];
    }

    LocalAudioFile[] localFiles = await context.LocalAudioFiles.AsNoTracking()
        .Where(file => file.CollectionId == collectionId)
        .ToArrayAsync(cancellationToken);
    LocalAudioFile[] matchingFiles =
    [
        .. localFiles.Where(file =>
            file.ContentHash is PresentOptionalValue<string> hash &&
            contentHashes.Contains(hash.Value, StringComparer.Ordinal))
    ];
    if (matchingFiles.Length == 0)
    {
        return [];
    }

    DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
        .Where(link =>
            link.CollectionId == collectionId &&
            matchingFiles.Select(file => file.Id).Contains(link.LocalAudioFileId))
        .ToArrayAsync(cancellationToken);
    ReleaseTrack[] releaseTracks = await context.ReleaseTracks.AsNoTracking()
        .Where(track =>
            track.CollectionId == collectionId &&
            links.Select(link => link.ReleaseTrackId).Contains(track.Id))
        .ToArrayAsync(cancellationToken);

    Dictionary<ReleaseTrackId, ReleaseId> releaseIdByReleaseTrackId = releaseTracks.ToDictionary(track => track.Id, track => track.ReleaseId);
    Dictionary<LocalAudioFileId, string> contentHashByLocalFileId = matchingFiles.ToDictionary(
        file => file.Id,
        file => ((PresentOptionalValue<string>)file.ContentHash).Value);
    DuplicateHashMatch[] rows =
    [
        .. links
            .Where(link => releaseIdByReleaseTrackId.ContainsKey(link.ReleaseTrackId))
            .Where(link => contentHashByLocalFileId.ContainsKey(link.LocalAudioFileId))
            .Select(link => new DuplicateHashMatch(
                contentHashByLocalFileId[link.LocalAudioFileId],
                releaseIdByReleaseTrackId[link.ReleaseTrackId]))
    ];

    Dictionary<ReleaseId, DuplicateTrackCandidate[]> candidatesByReleaseId = await LoadReleaseTrackCandidatesAsync(
        context,
        collectionId,
        [.. rows.Select(row => row.ReleaseId).Distinct()],
        cancellationToken);
    var matches = new Dictionary<string, List<DuplicateTrackCandidate>>(StringComparer.Ordinal);
    foreach (DuplicateHashMatch row in rows)
    {
        if (!candidatesByReleaseId.TryGetValue(row.ReleaseId, out DuplicateTrackCandidate[]? candidates))
        {
            continue;
        }

        if (!matches.TryGetValue(row.ContentHash, out List<DuplicateTrackCandidate>? existing))
        {
            existing = [];
            matches[row.ContentHash] = existing;
        }

        existing.AddRange(candidates);
    }

    return matches.ToDictionary(
        pair => pair.Key,
        pair => DistinctCandidates(pair.Value),
        StringComparer.Ordinal);
}

private sealed record DuplicateHashMatch(string ContentHash, ReleaseId ReleaseId);
```

Add `using DiscWeave.Domain.Catalog;`, `using DiscWeave.Domain.Collection;`,
`using DiscWeave.Domain.SharedKernel.Optional;`, and
`using Microsoft.EntityFrameworkCore;`.

- [ ] **Step 5: Run hash dedupe tests and verify green**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportHashDedupeTests" --no-restore
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/tests/DiscWeave.Api.Tests/DesktopImportHashDedupeTests.cs api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Hash.cs api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Candidates.cs
git commit -m "Restore hash dedupe through file links"
```

## Task 5: Restore Fingerprint Scan Deduplication

**Files:**

- Modify: `api/tests/DiscWeave.Api.Tests/DesktopImportReviewDeduplicationTests.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Fingerprint.cs`

- [ ] **Step 1: Add a fingerprint duplicate test**

In `DesktopImportReviewDeduplicationTests`, add:

```csharp
[Fact(DisplayName = "Desktop import uses file fingerprint to preselect duplicate files when hash is missing")]
public async Task Desktop_import_uses_file_fingerprint_to_preselect_duplicate_files_when_hash_is_missing()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    using JsonDocument firstScan = await PostScanAsync(
        client,
        "/music/source",
        AudioFile(
            "/music/source",
            "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
            contentHash: null));
    using JsonDocument firstConfirmation = await ConfirmOnlyDraftAsync(client, firstScan);
    Guid existingTrackId = await SingleTrackIdAsync(client, "Begins");

    using JsonDocument duplicateScan = await PostScanAsync(
        client,
        "/music/source",
        AudioFile(
            "/music/source",
            "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
            contentHash: null));
    JsonElement duplicateTrack = duplicateScan.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];

    Assert.Equal(existingTrackId, duplicateTrack.GetProperty("selectedTrackId").GetGuid());
    Assert.Contains(
        duplicateTrack.GetProperty("issues").EnumerateArray(),
        issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
}
```

Change helper signature in `DesktopImportReviewDeduplicationTestHelpers.cs`:

```csharp
private static object AudioFile(string rootPath, string filePath, string? contentHash)
```

The anonymous object already accepts nullable `contentHash`.

- [ ] **Step 2: Run the fingerprint test and verify red**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportReviewDeduplicationTests.Desktop_import_uses_file_fingerprint_to_preselect_duplicate_files_when_hash_is_missing" --no-restore
```

Expected: FAIL because fingerprint lookup returns an empty dictionary.

- [ ] **Step 3: Implement fingerprint lookup through local file links**

Replace `LoadFingerprintDuplicateMatchesAsync` with:

```csharp
private static async Task<Dictionary<ImportFingerprint, DuplicateTrackCandidate[]>> LoadFingerprintDuplicateMatchesAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    IReadOnlyList<ReleaseImportDraftTrack> tracks,
    CancellationToken cancellationToken)
{
    ImportFingerprint[] fingerprints =
    [
        .. tracks
            .Select(track => new ImportFingerprint(track.FilePath, track.SizeBytes, track.LastModifiedAt))
            .Distinct()
    ];
    if (fingerprints.Length == 0)
    {
        return [];
    }

    LocalAudioFile[] localFiles = await context.LocalAudioFiles.AsNoTracking()
        .Where(file => file.CollectionId == collectionId)
        .ToArrayAsync(cancellationToken);
    LocalAudioFile[] matchingFiles =
    [
        .. localFiles.Where(file =>
            file.ImportIdentity is PresentOptionalValue<FileImportIdentity> identity &&
            fingerprints.Contains(new ImportFingerprint(
                identity.Value.Path.Value,
                identity.Value.SizeBytes,
                identity.Value.LastModifiedAt)))
    ];
    if (matchingFiles.Length == 0)
    {
        return [];
    }

    DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
        .Where(link =>
            link.CollectionId == collectionId &&
            matchingFiles.Select(file => file.Id).Contains(link.LocalAudioFileId))
        .ToArrayAsync(cancellationToken);
    ReleaseTrack[] releaseTracks = await context.ReleaseTracks.AsNoTracking()
        .Where(track =>
            track.CollectionId == collectionId &&
            links.Select(link => link.ReleaseTrackId).Contains(track.Id))
        .ToArrayAsync(cancellationToken);

    var releaseIdByReleaseTrackId = releaseTracks.ToDictionary(track => track.Id, track => track.ReleaseId);
    DuplicateFingerprintMatch[] rows =
    [
        .. links
            .Join(matchingFiles, link => link.LocalAudioFileId, file => file.Id, (link, file) => new { link, file })
            .Where(pair => releaseIdByReleaseTrackId.ContainsKey(pair.link.ReleaseTrackId))
            .Select(pair =>
            {
                FileImportIdentity identity = ((PresentOptionalValue<FileImportIdentity>)pair.file.ImportIdentity).Value;
                return new DuplicateFingerprintMatch(
                    new ImportFingerprint(identity.Path.Value, identity.SizeBytes, identity.LastModifiedAt),
                    releaseIdByReleaseTrackId[pair.link.ReleaseTrackId]);
            })
    ];

    Dictionary<ReleaseId, DuplicateTrackCandidate[]> candidatesByReleaseId = await LoadReleaseTrackCandidatesAsync(
        context,
        collectionId,
        [.. rows.Select(row => row.ReleaseId).Distinct()],
        cancellationToken);
    var matches = new Dictionary<ImportFingerprint, List<DuplicateTrackCandidate>>();
    foreach (DuplicateFingerprintMatch row in rows)
    {
        if (!candidatesByReleaseId.TryGetValue(row.ReleaseId, out DuplicateTrackCandidate[]? candidates))
        {
            continue;
        }

        if (!matches.TryGetValue(row.Fingerprint, out List<DuplicateTrackCandidate>? existing))
        {
            existing = [];
            matches[row.Fingerprint] = existing;
        }

        existing.AddRange(candidates);
    }

    return matches.ToDictionary(pair => pair.Key, pair => DistinctCandidates(pair.Value));
}

private sealed record DuplicateFingerprintMatch(ImportFingerprint Fingerprint, ReleaseId ReleaseId);
```

Add `using DiscWeave.Domain.Collection;`, `using DiscWeave.Domain.SharedKernel.Optional;`, and `using Microsoft.EntityFrameworkCore;`.

- [ ] **Step 4: Run fingerprint and hash dedupe focused tests**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportHashDedupeTests|FullyQualifiedName~DesktopImportReviewDeduplicationTests" --no-restore
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/tests/DiscWeave.Api.Tests/DesktopImportReviewDeduplicationTests.cs api/tests/DiscWeave.Api.Tests/DesktopImportReviewDeduplicationTestHelpers.cs api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.Fingerprint.cs
git commit -m "Restore fingerprint dedupe through file links"
```

## Task 6: Restore Partial Duplicate And Collection Isolation Expectations

**Files:**

- Modify: `api/tests/DiscWeave.Api.Tests/DesktopImportReviewDeduplicationTests.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/DesktopImportPartialDuplicateAmbiguityTests.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/ImportCollectionIsolationEndpointTests.cs`

- [ ] **Step 1: Restore partial duplicate expectations**

In `Partial_duplicate_desktop_import_does_not_auto_select_tracks_without_file_links`, rename the test back to:

```csharp
[Fact(DisplayName = "Partial duplicate desktop import reuses the matching release and adds missing tracks")]
public async Task Partial_duplicate_desktop_import_reuses_the_matching_release_and_adds_missing_tracks()
```

Restore first-track selected assertion:

```csharp
Guid existingTrackId = await SingleTrackIdAsync(client, "Begins");
Assert.Equal(existingTrackId, duplicateTracks[0].GetProperty("selectedTrackId").GetGuid());
Assert.Equal(JsonValueKind.Null, duplicateTracks[1].GetProperty("selectedTrackId").ValueKind);
```

Restore final totals:

```csharp
Assert.Equal(1, releaseDocument.RootElement.GetProperty("total").GetInt32());
Assert.Equal(existingTrackId, tracklist[0].GetProperty("trackId").GetGuid());
await AssertListTotalAsync(client, "/api/tracks?search=Begins&limit=10&offset=0", 1);
await AssertListTotalAsync(client, "/api/tracks?search=Blue%20Truth&limit=10&offset=0", 1);
await AssertListTotalAsync(client, "/api/owned-items?limit=10&offset=0", 1);
Assert.Equal(2, (await host.LocalAudioFilesAsync()).Length);
Assert.Equal(2, (await host.DigitalTrackFileLinksAsync()).Length);
```

- [ ] **Step 2: Restore manual matched import expectations**

In `Manual_matched_existing_release_import_stores_file_identity_for_future_duplicate_scans`, restore:

```csharp
Assert.Equal(existingTrackId, movedTrack.GetProperty("selectedTrackId").GetGuid());
Assert.Contains(
    movedTrack.GetProperty("issues").EnumerateArray(),
    issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
```

- [ ] **Step 3: Restore partial ambiguity expectations carefully**

In `DesktopImportPartialDuplicateAmbiguityTests`, restore:

```csharp
Assert.NotEqual(JsonValueKind.Null, draftTracks[0].GetProperty("selectedTrackId").ValueKind);
Assert.NotEqual(JsonValueKind.Null, draftTracks[1].GetProperty("selectedTrackId").ValueKind);
Assert.Equal(JsonValueKind.Null, draftTracks[2].GetProperty("selectedTrackId").ValueKind);
```

Leave `Duplicate_scan_leaves_ambiguous_multi_track_release_matches_unselected` unchanged; it should still assert null for the ambiguous moved track.

- [ ] **Step 4: Add collection-isolation link assertions**

In `Desktop_import_content_hash_deduplication_is_scoped_per_collection`, after both confirmations, add:

```csharp
Assert.Single(await host.LocalAudioFilesAsync());
Assert.Single(await host.DigitalTrackFileLinksAsync());
```

This helper uses `DefaultCollectionId`, so it proves the default user collection only. Keep the existing assertion that user scan did not use admin dedupe.

- [ ] **Step 5: Run focused import tests**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportReviewDeduplicationTests|FullyQualifiedName~DesktopImportPartialDuplicateAmbiguityTests|FullyQualifiedName~ImportCollectionIsolationEndpointTests" --no-restore
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/tests/DiscWeave.Api.Tests/DesktopImportReviewDeduplicationTests.cs api/tests/DiscWeave.Api.Tests/DesktopImportPartialDuplicateAmbiguityTests.cs api/tests/DiscWeave.Api.Tests/ImportCollectionIsolationEndpointTests.cs
git commit -m "Restore import dedupe expectations for file links"
```

## Task 7: Full Verification And Final Commit

**Files:**

- Verify all changed files.

- [ ] **Step 1: Search for old owned-item file payload regression**

Run:

```bash
rg -n "digital_file_path|digital_file_format|_digitalFile|_importIdentityPath|_importIdentityContentHash|DigitalFile\\.Create\\(" api/src api/tests -g '*.cs'
```

Expected:

- no old owned-item digital payload access in API/import code;
- `DigitalFile.Create()` only called without path/format arguments;
- `_importIdentity*` only appears for `LocalAudioFile` persistence or negative schema assertions.

- [ ] **Step 2: Run focused test suites**

Run:

```bash
dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~DigitalFileImportIdentityTests" --no-restore
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportEndpointTests|FullyQualifiedName~DesktopImportHashDedupeTests|FullyQualifiedName~DesktopImportReviewDeduplicationTests|FullyQualifiedName~DesktopImportPartialDuplicateAmbiguityTests|FullyQualifiedName~ImportCollectionIsolationEndpointTests" --no-restore
```

Expected: both PASS.

- [ ] **Step 3: Run full API solution tests**

Run:

```bash
dotnet test api/DiscWeave.slnx --no-restore
```

Expected: PASS.

- [ ] **Step 4: Run diff hygiene check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 5: Inspect status**

Run:

```bash
git status --short
```

Expected: only Roadmap 59 implementation files are modified, plus the known unrelated untracked
`docs/superpowers/plans/2026-06-19-release-owned-items-domain-plan.md` if it still exists.

- [ ] **Step 6: Commit remaining implementation**

If any changes remain uncommitted from Tasks 1-6, stage only Roadmap 59 files:

```bash
git add api
git commit -m "Update import confirmation for file links"
```

Do not stage `docs/superpowers/plans/2026-06-19-release-owned-items-domain-plan.md` unless the user explicitly asks.

- [ ] **Step 7: Final status**

Run:

```bash
git status --short
git log -1 --oneline
```

Expected: working tree has no Roadmap 59 implementation changes. Report the final commit hash and verification commands.
