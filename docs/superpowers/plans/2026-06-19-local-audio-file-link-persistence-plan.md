# Local Audio File Link Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clean persistence for first-class local audio files and digital track file links without keeping owned-item digital file payload columns.

**Architecture:** Keep `OwnedItem` as the release-copy aggregate and make digital copies file-agnostic. Add `LocalAudioFile` and `DigitalTrackFileLink` as collection-scoped domain entities with EF Core configurations and SQLite table creation. Keep import/API/review behavior compile-safe but defer full file-link workflows to Roadmaps 59-64.

**Tech Stack:** .NET 10, C# 14, ASP.NET Core Minimal APIs, EF Core 10, SQLite, xUnit.

---

## File Structure

Create:

- `api/src/DiscWeave.Domain/SharedKernel/Ids/LocalAudioFileId.cs` - typed public id for local audio files.
- `api/src/DiscWeave.Domain/SharedKernel/Ids/DigitalTrackFileLinkId.cs` - typed public id for digital file links.
- `api/src/DiscWeave.Domain/Collection/AudioFileQuality.cs` - optional lossless/lossy classification.
- `api/src/DiscWeave.Domain/Collection/LocalAudioFile.cs` - domain entity for local file metadata.
- `api/src/DiscWeave.Domain/Collection/DigitalTrackFileLink.cs` - domain entity connecting digital owned item, release track row, and local file.
- `api/src/DiscWeave.Infrastructure/Persistence/Configurations/LocalAudioFileConfiguration.cs` - EF mapping for `local_audio_files`.
- `api/src/DiscWeave.Infrastructure/Persistence/Configurations/DigitalTrackFileLinkConfiguration.cs` - EF mapping for `digital_track_file_links`.
- `api/src/DiscWeave.Infrastructure/Persistence/DiscWeaveDbContext.LocalAudioFileRepository.cs` - repository implementation.
- `api/src/DiscWeave.Infrastructure/Persistence/DiscWeaveDbContext.DigitalTrackFileLinkRepository.cs` - repository implementation.
- `api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.LocalAudioFiles.cs` - idempotent table creation.
- `api/tests/DiscWeave.Infrastructure.Tests/LocalAudioFilePersistenceTests.cs` - focused persistence tests.

Modify:

- `api/src/DiscWeave.Domain/Collection/DigitalFile.cs` - make digital copy medium file-agnostic.
- `api/src/DiscWeave.Domain/Collection/OwnedItem.cs` - remove digital file payload fields from the owned item.
- `api/src/DiscWeave.Infrastructure/Persistence/Configurations/OwnedItemConfiguration.cs` - stop mapping old digital file payload columns.
- `api/src/DiscWeave.Infrastructure/Persistence/Configurations/PersistenceValueConverters.cs` - add converters for new typed ids.
- `api/src/DiscWeave.Infrastructure/Persistence/DiscWeaveDbContext.cs` - add DbSets, configurations, and collection filters.
- `api/src/DiscWeave.Api/Program.cs` - run new SQLite table upgrader.
- `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemMapper.cs` - create/respond to digital medium without file payload.
- `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.DigitalFiles.cs` - disable old digital-file patch contract.
- `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.List.cs` - remove format-based digital copy filtering until file-link contracts land.
- `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemResponseMapper.cs` - remove format-based lossy/lossless signals from owned item medium payload.
- `api/src/DiscWeave.Infrastructure/Persistence/Search/SearchDocumentBuilder.Helpers.cs` - remove old owned-item digital format/import identity checks.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Files.cs` - stop creating per-track digital owned items and remove old import identity lookups.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Media.cs` - stop calling per-track owned item creation.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Deduplication.*.cs` - disable old owned-item import identity dedupe queries.
- `api/src/DiscWeave.Api/Features/ReviewWorkbench/ReviewWorkbenchSignalBuilder*.cs` - stop reading old owned-item digital payload shadow fields.
- `api/src/DiscWeave.Api/Features/CatalogGraph/CatalogGraphEndpointRouteBuilderExtensions.GraphData.Loaders.cs` - remove old import identity check.
- `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.RestoreMapping.cs` - construct digital medium without file payload.
- `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.Csv.cs` - leave old digital file CSV fields blank until export redesign.
- `api/src/DiscWeave.Seeding/LargeCollectionSeedGenerator.cs` - create digital owned items without file payload.
- `api/src/DiscWeave.Seeding/PerformanceSmokeVerifier.cs` - stop using owned-item import identity fields.
- Domain, infrastructure, and API tests that currently assert owned-item digital file payload behavior.

## Task 1: Add Failing Domain Tests

**Files:**

- Modify: `api/tests/DiscWeave.Domain.Tests/Collection/DigitalFileImportIdentityTests.cs`
- Modify: `api/tests/DiscWeave.Domain.Tests/Collection/OwnedItemTests.cs`
- Modify: `api/tests/DiscWeave.Domain.Tests/DomainModelShapeTests.cs`

- [ ] **Step 1: Replace digital medium file-payload tests**

Replace tests that assert `DigitalFile.Path`, `DigitalFile.Format`, or
`DigitalFile.ImportIdentity` with tests that assert `DigitalFile.Create()` is a
file-agnostic digital copy medium and `FileImportIdentity` remains a reusable
value object for file metadata.

- [ ] **Step 2: Add local audio file and link domain tests**

Add tests that create `LocalAudioFile` with path, format, codec, quality, size,
modified time, hash, duration, bitrate, sample rate, channels, and import
identity. Add tests that create `DigitalTrackFileLink` and preserve the
digital owned item id, release track id, and local audio file id.

- [ ] **Step 3: Run focused domain tests and verify red**

Run:

```bash
dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~DigitalFileImportIdentityTests|FullyQualifiedName~OwnedItemTests|FullyQualifiedName~DomainModelShapeTests" --no-restore
```

Expected: FAIL because `LocalAudioFile`, `DigitalTrackFileLink`, and new typed
ids do not exist yet and `DigitalFile.Create()` is not file-agnostic.

## Task 2: Implement Domain Model

**Files:**

- Create files listed in the domain section above.
- Modify: `api/src/DiscWeave.Domain/Collection/DigitalFile.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/OwnedItem.cs`

- [ ] **Step 1: Add new typed ids and quality enum**

Create `LocalAudioFileId`, `DigitalTrackFileLinkId`, and `AudioFileQuality`
with the same style as existing typed ids and fixed enums.

- [ ] **Step 2: Add `LocalAudioFile`**

Implement a collection-scoped entity with explicit factory methods and
validation for supplied positive numeric metadata. Normalize content hashes to
lowercase through `FileImportIdentity`.

- [ ] **Step 3: Add `DigitalTrackFileLink`**

Implement a collection-scoped entity that stores `DigitalTrackFileLinkId`,
`OwnedItemId`, `ReleaseTrackId`, and `LocalAudioFileId`.

- [ ] **Step 4: Make `DigitalFile` file-agnostic**

Replace path/format/import identity state with a fixed medium object:

```csharp
public sealed record DigitalFile : IMedium
{
    private DigitalFile()
    {
    }

    public OwnedItemType Type => OwnedItemType.Digital;
    public string Code => "digital";
    public string Description => "digital release copy";

    public static DigitalFile Create()
    {
        return new DigitalFile();
    }
}
```

- [ ] **Step 5: Remove owned-item digital file payload fields**

In `OwnedItem`, remove `_digitalFilePath`, `_digitalFileFormat`, and
`_importIdentity*` fields. `SetDigitalFile` should only clear other medium
details and set `_mediumType` to `digital`; `CreateMedium` should reconstruct
`DigitalFile.Create()`.

- [ ] **Step 6: Run focused domain tests and verify green**

Run:

```bash
dotnet test api/tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~DigitalFileImportIdentityTests|FullyQualifiedName~OwnedItemTests|FullyQualifiedName~DomainModelShapeTests" --no-restore
```

Expected: PASS.

## Task 3: Add Failing Infrastructure Tests

**Files:**

- Modify: `api/tests/DiscWeave.Infrastructure.Tests/DiscWeaveDbContextTests.cs`
- Modify: `api/tests/DiscWeave.Infrastructure.Tests/DiscWeaveDbContextCollectionBoundaryTests.cs`
- Create: `api/tests/DiscWeave.Infrastructure.Tests/LocalAudioFilePersistenceTests.cs`
- Modify: `api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderTests.cs`

- [ ] **Step 1: Update schema test expectations**

Assert `owned_items` does not contain old digital file payload columns and
assert `local_audio_files` and `digital_track_file_links` tables exist.

- [ ] **Step 2: Add persistence tests for shared files**

Add one test where two digital owned items link the same `LocalAudioFile`
through two release track rows.

- [ ] **Step 3: Add persistence tests for same logical track with different files**

Add one test where the same logical `TrackId` appears on two releases and each
release-track row links to a different `LocalAudioFile`.

- [ ] **Step 4: Add cross-collection constraint tests**

Add a test that a link referencing a local file, release track, or owned item
from another collection fails with `ReferencedResourceMissingException`.

- [ ] **Step 5: Add SQLite upgrader test**

Assert `EnsureLocalAudioFileTablesAsync` creates both tables and expected
indexes idempotently.

- [ ] **Step 6: Run focused infrastructure tests and verify red**

Run:

```bash
dotnet test api/tests/DiscWeave.Infrastructure.Tests/DiscWeave.Infrastructure.Tests.csproj --filter "FullyQualifiedName~DiscWeaveDbContextTests|FullyQualifiedName~DiscWeaveDbContextCollectionBoundaryTests|FullyQualifiedName~LocalAudioFilePersistenceTests|FullyQualifiedName~SqliteSchemaUpgraderTests" --no-restore
```

Expected: FAIL because mappings and tables do not exist yet.

## Task 4: Implement EF Core And SQLite Persistence

**Files:**

- Create and modify infrastructure files listed above.

- [ ] **Step 1: Add value converters and DbSets**

Add converters for `LocalAudioFileId` and `DigitalTrackFileLinkId`, add public
DbSets, apply configurations, and add collection filters.

- [ ] **Step 2: Map `LocalAudioFile`**

Map `local_audio_files` with surrogate key, alternate key
`collection_id, local_audio_file_id`, unique index `collection_id, path`,
lookup index `collection_id, content_hash`, and collection FK.

- [ ] **Step 3: Map `DigitalTrackFileLink`**

Map `digital_track_file_links` with surrogate key, alternate key
`collection_id, digital_track_file_link_id`, collection-aware FKs to
`owned_items`, `release_tracks`, and `local_audio_files`, unique index
`collection_id, digital_owned_item_id, release_track_id`, and lookup indexes.

- [ ] **Step 4: Remove old owned-item digital payload mapping**

Delete mappings and indexes for `digital_file_path`, `digital_file_format`,
and `import_identity_*` from `OwnedItemConfiguration`.

- [ ] **Step 5: Add idempotent SQLite table upgrader**

Create both new tables and indexes with `CREATE TABLE IF NOT EXISTS` and
`CREATE INDEX IF NOT EXISTS`, then call it from `Program.InitializeSqliteDatabaseAsync`.

- [ ] **Step 6: Run focused infrastructure tests and verify green**

Run:

```bash
dotnet test api/tests/DiscWeave.Infrastructure.Tests/DiscWeave.Infrastructure.Tests.csproj --filter "FullyQualifiedName~DiscWeaveDbContextTests|FullyQualifiedName~DiscWeaveDbContextCollectionBoundaryTests|FullyQualifiedName~LocalAudioFilePersistenceTests|FullyQualifiedName~SqliteSchemaUpgraderTests" --no-restore
```

Expected: PASS.

## Task 5: Adapt API, Import, Search, Review, Export, And Seeding Boundaries

**Files:**

- Modify API/import/search/review/export/seeding files listed in the file
  structure section.
- Modify affected API tests.

- [ ] **Step 1: Write/update API boundary tests for old digital-file endpoint**

Change old digital-file patch tests to assert a clear unsupported response for
digital file payload mutation until Roadmap 60.

- [ ] **Step 2: Update owned item API mapping**

Digital medium creation should accept `type = "digital"` without requiring
`path` or `format`. Digital medium responses should return the fixed type and
description with file payload fields set to null.

- [ ] **Step 3: Disable old digital-file patch behavior**

Keep collection scoping and not-found behavior, then return
`owned_item.digital_file_links_required` for existing items instead of mutating
owned-item file payload.

- [ ] **Step 4: Remove old import identity queries**

Stop per-track digital owned item creation in import confirmation and return no
owned-item identity matches from old dedupe queries until Roadmap 59 moves
dedupe to `LocalAudioFile`.

- [ ] **Step 5: Remove format-based digital copy signals from old owned-item payload**

Update search, owned-item list, catalog graph, catalog quality, review
workbench, export CSV, restore mapping, seeding, and smoke verifier code so they
compile without `DigitalFile.Format` or owned-item import identity shadow
fields. Keep future semantic work deferred to Roadmaps 60-64.

- [ ] **Step 6: Run focused API build/tests**

Run:

```bash
dotnet build api/DiscWeave.slnx --no-restore
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~OwnedItem|FullyQualifiedName~Import|FullyQualifiedName~ReviewWorkbench|FullyQualifiedName~CatalogQuality|FullyQualifiedName~Export" --no-restore
```

Expected: build PASS and focused API tests PASS after old expectations are
updated.

## Task 6: Full Verification And Commits

**Files:**

- All files touched above.

- [ ] **Step 1: Run cleanup searches**

Run:

```bash
rg -n "_digitalFile|digital_file_path|digital_file_format|_importIdentity|import_identity_" api/src api/tests -g '*.cs'
rg -n "DigitalFile\\.Create\\(" api/src api/tests -g '*.cs'
```

Expected: no owned-item payload mapping remains. `DigitalFile.Create()` calls
have no arguments.

- [ ] **Step 2: Run backend solution tests**

Run:

```bash
dotnet test api/DiscWeave.slnx --no-restore
```

Expected: PASS.

- [ ] **Step 3: Run diff checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Only intended roadmap files are modified or
created.

- [ ] **Step 4: Commit implementation**

Stage the implementation files and commit with an English message:

```bash
git add api docs/superpowers/plans/2026-06-19-local-audio-file-link-persistence-plan.md
git commit -m "Add local audio file link persistence"
```
