# Release-Owned Items Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the owned item domain foundation so every owned item is a concrete release copy with fixed item types, physical-only condition/storage, and stable release track identity.

**Architecture:** Keep Roadmap 57 focused on the domain and persistence foundation. `OwnedItem` becomes release-owned by carrying `ReleaseId` directly, fixed item-type value objects stop accepting dictionary-configurable codes, and `ReleaseTrack` gains a stable public `ReleaseTrackId` for future digital file links. API/import/search code receives only the minimal compatibility edits needed to compile and to reject track-owned item creation until Roadmap 60 redesigns contracts.

**Tech Stack:** .NET 10, C# 14, ASP.NET Core Minimal APIs, EF Core 10, SQLite, xUnit v2 through `Microsoft.NET.Test.Sdk` and `xunit.runner.visualstudio`.

---

## Scope Boundaries

This plan implements GitHub issue `Fredoq/discweave#41` / Roadmap 57.

Implemented here:

- Owned items target releases only.
- Fixed owned item types are `digital`, `vinyl`, `cd`, `cassette`, and `other`.
- Condition and storage location are rejected for digital owned items.
- Physical item types still support condition and storage location.
- Release track rows have stable `ReleaseTrackId` values.
- EF Core and SQLite schema creation enforce the new release-owned shape.

Not implemented here:

- `LocalAudioFile` and `DigitalTrackFileLink` persistence. That is Roadmap 58.
- Import confirmation file-link creation. That is Roadmap 59.
- Full owned item, track, and local file API contract redesign. That is Roadmap 60.
- Owned Items UI and Tracks UI redesign. Those are Roadmap 61 and Roadmap 62.
- Review Workbench signal realignment. That is Roadmap 63.
- Export/restore/seed acceptance update for file links. That is Roadmap 64.

## File Structure

Create:

- `api/src/DiscWeave.Domain/SharedKernel/Ids/ReleaseTrackId.cs` - typed stable id for release track appearances.
- `api/src/DiscWeave.Domain/Collection/OwnedItemType.cs` - fixed owned item type enum.

Modify:

- `api/src/DiscWeave.Domain/Catalog/ReleaseTrack.cs` - add `Id` and creation overloads.
- `api/src/DiscWeave.Domain/Catalog/Release.cs` - keep tracklist replacement behavior while preserving stable ids supplied by callers.
- `api/src/DiscWeave.Domain/Collection/OwnedItem.cs` - replace target union with direct `ReleaseId`.
- `api/src/DiscWeave.Domain/Collection/OwnedItemHolding.cs` - reject physical details on digital items.
- `api/src/DiscWeave.Domain/Collection/DigitalFile.cs` - fixed `digital` type code only.
- `api/src/DiscWeave.Domain/Collection/VinylRecord.cs` - fixed `vinyl` type code only.
- `api/src/DiscWeave.Domain/Collection/CompactDisc.cs` - fixed `cd` type code only.
- `api/src/DiscWeave.Domain/Collection/CassetteTape.cs` - fixed `cassette` type code only.
- `api/src/DiscWeave.Domain/Collection/OtherMedium.cs` - fixed `other` type code only.
- `api/src/DiscWeave.Domain/Collection/IMedium.cs` - expose the fixed `OwnedItemType`.
- `api/src/DiscWeave.Infrastructure/Persistence/Configurations/PersistenceValueConverters.cs` - add `ReleaseTrackId`.
- `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs` - map `release_track_id`.
- `api/src/DiscWeave.Infrastructure/Persistence/Configurations/OwnedItemConfiguration.cs` - map direct `release_id`, fixed type, and physical-detail consistency.
- `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemMapper.cs` - accept only release targets and fixed item types.
- `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemResponseMapper.cs` - map release-owned items only.
- `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.cs` - update create/update target handling.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Files.cs` - stop creating track-owned digital items.
- `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Media.cs` - remove the track-owned item side effect.
- `api/src/DiscWeave.Api/Features/CatalogGraph/*.cs` - route owned copies through release ownership.
- `api/src/DiscWeave.Api/Features/Playlists/PlaylistMapper.SmartSql.cs` - filter track smart playlists through release appearances.
- `api/src/DiscWeave.Infrastructure/Persistence/Search/SearchDocumentBuilder*.cs` - group owned items by release and by release track appearances where needed.
- `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Delete.cs` - remove track-owned dependency checks.
- `api/tests/DiscWeave.Domain.Tests/Collection/OwnedItemTests.cs` - rewrite owned item domain tests.
- `api/tests/DiscWeave.Domain.Tests/Catalog/CatalogModelTests.cs` - add stable release track id tests.
- `api/tests/DiscWeave.Domain.Tests/DomainModelShapeTests.cs` - include new stable id shape and remove deleted target types.
- `api/tests/DiscWeave.Infrastructure.Tests/DiscWeaveDbContextTests.cs` - verify schema and persistence.
- `api/tests/DiscWeave.Infrastructure.Tests/DiscWeaveDbContextCollectionBoundaryTests.cs` - verify release-owned FK boundaries.

Delete after call sites are updated:

- `api/src/DiscWeave.Domain/Collection/OwnedItemTarget.cs`
- `api/src/DiscWeave.Domain/Collection/ReleaseOwnedItemTarget.cs`
- `api/src/DiscWeave.Domain/Collection/TrackOwnedItemTarget.cs`

---

### Task 1: Add Failing Domain Tests For Release-Owned Semantics

**Files:**

- Modify: `api/tests/DiscWeave.Domain.Tests/Collection/OwnedItemTests.cs`
- Modify: `api/tests/DiscWeave.Domain.Tests/Catalog/CatalogModelTests.cs`

- [ ] **Step 1: Replace target-union tests with release-owned tests**

Replace the existing `Owned_item_can_target_a_release`, `Owned_item_can_target_a_track`, and `Owned_item_can_update_its_target_without_changing_identity_or_holding` tests with these tests:

```csharp
[Fact]
public void Owned_item_targets_a_release_copy()
{
    var collectionId = CollectionId.New();
    var ownedItemId = OwnedItemId.New();
    var releaseId = ReleaseId.New();

    OwnedItem item = OwnedItem.Create(
        collectionId,
        ownedItemId,
        releaseId,
        OwnershipStatus.Owned,
        VinylRecord.Create("LP"));

    Assert.Equal(collectionId, item.CollectionId);
    Assert.Equal(ownedItemId, item.Id);
    Assert.Equal(releaseId, item.ReleaseId);
    Assert.Equal(OwnershipStatus.Owned, item.Holding.Status);
    _ = Assert.IsType<VinylRecord>(item.Holding.Medium);
}

[Fact]
public void Owned_item_can_update_its_release_without_changing_identity_or_holding()
{
    var collectionId = CollectionId.New();
    var ownedItemId = OwnedItemId.New();
    var firstReleaseId = ReleaseId.New();
    var secondReleaseId = ReleaseId.New();
    OwnedItem item = OwnedItem.Create(
        collectionId,
        ownedItemId,
        firstReleaseId,
        OwnershipStatus.Wanted,
        CompactDisc.Create(1));

    item.UpdateRelease(secondReleaseId);

    Assert.Equal(collectionId, item.CollectionId);
    Assert.Equal(ownedItemId, item.Id);
    Assert.Equal(secondReleaseId, item.ReleaseId);
    Assert.Equal(OwnershipStatus.Wanted, item.Holding.Status);
    _ = Assert.IsType<CompactDisc>(item.Holding.Medium);
}
```

- [ ] **Step 2: Add fixed item type and physical-detail tests**

Append these tests to `OwnedItemTests`:

```csharp
[Fact]
public void Owned_item_types_are_fixed_product_concepts()
{
    OwnedItem digital = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, DigitalFile.Create(FilePath.FromAbsolutePath("/music/New Order/Substance"), AudioFileFormat.Flac));
    OwnedItem vinyl = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, VinylRecord.Create("2xLP"));
    OwnedItem cd = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, CompactDisc.Create(2));
    OwnedItem cassette = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, CassetteTape.Create("Chrome"));
    OwnedItem other = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, OtherMedium.Create("DAT"));

    Assert.Equal(OwnedItemType.Digital, digital.Holding.Medium.Type);
    Assert.Equal("digital", digital.Holding.Medium.Code);
    Assert.Equal(OwnedItemType.Vinyl, vinyl.Holding.Medium.Type);
    Assert.Equal("vinyl", vinyl.Holding.Medium.Code);
    Assert.Equal(OwnedItemType.Cd, cd.Holding.Medium.Type);
    Assert.Equal("cd", cd.Holding.Medium.Code);
    Assert.Equal(OwnedItemType.Cassette, cassette.Holding.Medium.Type);
    Assert.Equal("cassette", cassette.Holding.Medium.Code);
    Assert.Equal(OwnedItemType.Other, other.Holding.Medium.Type);
    Assert.Equal("other", other.Holding.Medium.Code);
}

[Fact]
public void Digital_owned_items_reject_physical_condition_and_storage()
{
    OwnedItem item = OwnedItem.Create(
        CollectionId.New(),
        OwnedItemId.New(),
        ReleaseId.New(),
        OwnershipStatus.Owned,
        DigitalFile.Create(FilePath.FromAbsolutePath("/music/New Order/Substance"), AudioFileFormat.Flac));

    DomainException conditionException = Assert.Throws<DomainException>(() => item.WithCondition(ItemCondition.VeryGoodPlus));
    DomainException storageException = Assert.Throws<DomainException>(() => item.WithStorageLocation(StorageLocation.FromName("Shelf A")));

    Assert.Equal("owned_item.physical_details_invalid", conditionException.Code);
    Assert.Equal("owned_item.physical_details_invalid", storageException.Code);
}

[Fact]
public void Physical_owned_items_keep_condition_and_storage()
{
    OwnedItem item = OwnedItem.Create(
            CollectionId.New(),
            OwnedItemId.New(),
            ReleaseId.New(),
            OwnershipStatus.Owned,
            CassetteTape.Create("Chrome"))
        .WithCondition(ItemCondition.VeryGood)
        .WithStorageLocation(StorageLocation.FromName("Shelf C"));

    Assert.Equal(ItemCondition.VeryGood, Assert.IsType<PresentOptionalValue<ItemCondition>>(item.Holding.Details.Condition).Value);
    Assert.Equal("Shelf C", Assert.IsType<PresentOptionalValue<StorageLocation>>(item.Holding.Details.StorageLocation).Value.Name);
}
```

- [ ] **Step 3: Add stable release track id test**

Add this test to `CatalogModelTests`:

```csharp
[Fact]
public void Release_tracks_have_stable_public_identity()
{
    var releaseTrackId = ReleaseTrackId.New();
    var trackId = TrackId.New();

    ReleaseTrack releaseTrack = ReleaseTrack.Create(
        releaseTrackId,
        trackId,
        TrackPosition.FromNumber(1, "1", "A"),
        "Age of Consent");

    Assert.Equal(releaseTrackId, releaseTrack.Id);
    Assert.Equal(trackId, releaseTrack.TrackId);
    Assert.Equal(1, releaseTrack.Position.Number);
    Assert.Equal("Age of Consent", Assert.IsType<PresentOptionalValue<string>>(releaseTrack.TitleOverride).Value);
}
```

- [ ] **Step 4: Run focused domain tests to verify failure**

Run:

```bash
cd api
dotnet test tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~OwnedItemTests|FullyQualifiedName~CatalogModelTests"
```

Expected: FAIL with missing `ReleaseTrackId`, missing `OwnedItem.ReleaseId`, old `OwnedItem.Create` signature, missing `OwnedItemType`, and digital physical-detail validation not implemented.

---

### Task 2: Implement Stable ReleaseTrackId

**Files:**

- Create: `api/src/DiscWeave.Domain/SharedKernel/Ids/ReleaseTrackId.cs`
- Modify: `api/src/DiscWeave.Domain/Catalog/ReleaseTrack.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/PersistenceValueConverters.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs`
- Modify: `api/tests/DiscWeave.Domain.Tests/DomainModelShapeTests.cs`

- [ ] **Step 1: Create the typed id**

Create `ReleaseTrackId.cs`:

```csharp
namespace DiscWeave.Domain.SharedKernel.Ids;

public readonly record struct ReleaseTrackId(Guid Value)
{
    public static ReleaseTrackId New()
    {
        return new ReleaseTrackId(Guid.CreateVersion7());
    }

    public override string ToString()
    {
        return Value.ToString();
    }
}
```

- [ ] **Step 2: Add stable id to ReleaseTrack**

Update `ReleaseTrack` so it has an `Id` property and existing factory overloads generate ids:

```csharp
private ReleaseTrack()
{
    Position = TrackPosition.Empty;
    TitleOverride = Optional.Missing<string>();
}

private ReleaseTrack(
    ReleaseTrackId id,
    TrackId trackId,
    TrackPosition position,
    IOptionalValue<string> titleOverride)
{
    Id = id;
    TrackId = trackId;
    Position = position;
    TitleOverride = titleOverride;
}

public ReleaseTrackId Id { get; private set; }

public static ReleaseTrack Create(TrackId trackId, TrackPosition position)
{
    return Create(ReleaseTrackId.New(), trackId, position);
}

public static ReleaseTrack Create(ReleaseTrackId id, TrackId trackId, TrackPosition position)
{
    ArgumentNullException.ThrowIfNull(position);

    return new ReleaseTrack(id, trackId, position, Optional.Missing<string>());
}

public static ReleaseTrack Create(TrackId trackId, TrackPosition position, string titleOverride)
{
    return Create(ReleaseTrackId.New(), trackId, position, titleOverride);
}

public static ReleaseTrack Create(ReleaseTrackId id, TrackId trackId, TrackPosition position, string titleOverride)
{
    ArgumentNullException.ThrowIfNull(position);
    ArgumentNullException.ThrowIfNull(titleOverride);

    return Create(
        id,
        trackId,
        position,
        string.IsNullOrWhiteSpace(titleOverride)
            ? Optional.Missing<string>()
            : Optional.From(titleOverride.Trim()));
}

public static ReleaseTrack Create(
    ReleaseTrackId id,
    TrackId trackId,
    TrackPosition position,
    IOptionalValue<string> titleOverride)
{
    ArgumentNullException.ThrowIfNull(position);
    ArgumentNullException.ThrowIfNull(titleOverride);

    return new ReleaseTrack(id, trackId, position, NormalizeOptionalText(titleOverride));
}

public static ReleaseTrack Create(
    TrackId trackId,
    TrackPosition position,
    IOptionalValue<string> titleOverride)
{
    return Create(ReleaseTrackId.New(), trackId, position, titleOverride);
}
```

- [ ] **Step 3: Add persistence converter**

Add to `PersistenceValueConverters` near the other id converters:

```csharp
public static readonly ValueConverter<ReleaseTrackId, Guid> ReleaseTrackId = new(
    id => id.Value,
    value => new ReleaseTrackId(value));
```

- [ ] **Step 4: Map release_track_id**

Inside `ReleaseConfiguration.ConfigureTracklist`, after the surrogate `id` key mapping, add:

```csharp
_ = track.Property(releaseTrack => releaseTrack.Id)
    .HasColumnName("release_track_id")
    .HasConversion(PersistenceValueConverters.ReleaseTrackId)
    .ValueGeneratedNever();

_ = track.HasIndex(CollectionIdProperty, nameof(ReleaseTrack.Id))
    .IsUnique()
    .HasDatabaseName("ix_release_tracks_collection_release_track_id");
```

- [ ] **Step 5: Update domain shape allow-list**

`ReleaseTrack` already appears in the private constructor and private setter allow-lists. No new allow-list entry is required for `ReleaseTrackId` because it is a public readonly record struct with no private materialization constructor.

- [ ] **Step 6: Run focused catalog domain tests**

Run:

```bash
cd api
dotnet test tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~CatalogModelTests"
```

Expected: PASS for catalog tests once `ReleaseTrackId` is implemented.

---

### Task 3: Rebuild OwnedItem Domain Around Release Copies

**Files:**

- Create: `api/src/DiscWeave.Domain/Collection/OwnedItemType.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/IMedium.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/DigitalFile.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/VinylRecord.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/CompactDisc.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/CassetteTape.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/OtherMedium.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/OwnedItem.cs`
- Modify: `api/src/DiscWeave.Domain/Collection/OwnedItemHolding.cs`
- Delete: `api/src/DiscWeave.Domain/Collection/OwnedItemTarget.cs`
- Delete: `api/src/DiscWeave.Domain/Collection/ReleaseOwnedItemTarget.cs`
- Delete: `api/src/DiscWeave.Domain/Collection/TrackOwnedItemTarget.cs`

- [ ] **Step 1: Create fixed item type enum**

Create `OwnedItemType.cs`:

```csharp
namespace DiscWeave.Domain.Collection;

public enum OwnedItemType
{
    Digital = 1,
    Vinyl = 2,
    Cd = 3,
    Cassette = 4,
    Other = 5
}
```

- [ ] **Step 2: Add Type to IMedium**

Replace `IMedium` with:

```csharp
namespace DiscWeave.Domain.Collection;

public interface IMedium
{
    OwnedItemType Type { get; }

    string Code { get; }

    string Description { get; }
}
```

- [ ] **Step 3: Fix DigitalFile type code**

Update `DigitalFile` so custom code overloads are removed and the fixed type is returned:

```csharp
public OwnedItemType Type => OwnedItemType.Digital;

public string Code => "digital";

public static DigitalFile Create(FilePath path, AudioFileFormat format)
{
    ArgumentNullException.ThrowIfNull(path);

    return new DigitalFile(
        path,
        Guard.DefinedEnum(format, nameof(format), "digital_file.format_invalid"),
        Optional.Missing<FileImportIdentity>());
}

public static DigitalFile Create(FilePath path, AudioFileFormat format, FileImportIdentity importIdentity)
{
    ArgumentNullException.ThrowIfNull(path);
    ArgumentNullException.ThrowIfNull(importIdentity);
    AudioFileFormat validatedFormat = Guard.DefinedEnum(format, nameof(format), "digital_file.format_invalid");

    return importIdentity.Path != path
        ? throw new DomainException("digital_file.import_identity_path_mismatch", "Digital file import identity path must match the file path")
        : new DigitalFile(path, validatedFormat, Optional.From(importIdentity));
}
```

The private constructor becomes:

```csharp
private DigitalFile(FilePath path, AudioFileFormat format, IOptionalValue<FileImportIdentity> importIdentity)
{
    Path = path;
    Format = format;
    ImportIdentity = importIdentity;
}
```

- [ ] **Step 4: Fix physical medium codes**

Update each physical value object so it has no factory overload that accepts a caller-supplied code and returns a fixed code:

```csharp
public OwnedItemType Type => OwnedItemType.Vinyl;
public string Code => "vinyl";
```

```csharp
public OwnedItemType Type => OwnedItemType.Cd;
public string Code => "cd";
```

```csharp
public OwnedItemType Type => OwnedItemType.Cassette;
public string Code => "cassette";
```

```csharp
public OwnedItemType Type => OwnedItemType.Other;
public string Code => "other";
```

Keep the existing required detail validation in `VinylRecord.Create`, `CompactDisc.Create`, `CassetteTape.Create`, and `OtherMedium.Create`.

- [ ] **Step 5: Replace OwnedItem target with ReleaseId**

Rewrite the public surface of `OwnedItem` to carry `ReleaseId` directly:

```csharp
private ReleaseId _releaseId;
private OwnershipStatus _status;
private string _mediumType = string.Empty;

public ReleaseId ReleaseId => _releaseId;

public static OwnedItem Create(CollectionId collectionId, OwnedItemId id, ReleaseId releaseId, OwnershipStatus status, IMedium medium)
{
    return new OwnedItem(collectionId, id, releaseId, OwnedItemHolding.Create(status, medium));
}

public void UpdateRelease(ReleaseId releaseId)
{
    _releaseId = releaseId;
}
```

The main constructor becomes:

```csharp
private OwnedItem(
    CollectionId collectionId,
    OwnedItemId id,
    ReleaseId releaseId,
    OwnedItemHolding holding)
{
    CollectionId = collectionId;
    Id = id;
    _releaseId = releaseId;
    SetHolding(holding);
}
```

Remove `_targetType`, `_targetReleaseId`, `_targetTrackId`, `Target`, `SetTarget`, `CreateTarget`, and `UpdateTarget`.

- [ ] **Step 6: Keep fixed type reconstruction**

Update `SetMedium` and `CreateMedium` to use fixed type codes only:

```csharp
private void SetMedium(IMedium medium)
{
    switch (medium)
    {
        case DigitalFile digitalFile:
            SetDigitalFile(digitalFile);
            break;
        case VinylRecord vinylRecord:
            ClearMediumDetails();
            _mediumType = vinylRecord.Code;
            _vinylFormatDescription = vinylRecord.FormatDescription;
            break;
        case CompactDisc compactDisc:
            ClearMediumDetails();
            _mediumType = compactDisc.Code;
            _compactDiscCount = compactDisc.DiscCount;
            break;
        case CassetteTape cassetteTape:
            ClearMediumDetails();
            _mediumType = cassetteTape.Code;
            _cassetteTapeType = cassetteTape.TapeType;
            break;
        case OtherMedium otherMedium:
            ClearMediumDetails();
            _mediumType = otherMedium.Code;
            _otherMediumName = otherMedium.Name;
            break;
        default:
            throw new InvalidOperationException("Owned item type is not supported");
    }
}

private IMedium CreateMedium()
{
    return _mediumType switch
    {
        "digital" when _digitalFilePath is not null && _digitalFileFormat is { } format => CreateDigitalFile(format),
        "vinyl" when _vinylFormatDescription is not null => VinylRecord.Create(_vinylFormatDescription),
        "cd" when _compactDiscCount is { } discCount => CompactDisc.Create(discCount),
        "cassette" when _cassetteTapeType is not null => CassetteTape.Create(_cassetteTapeType),
        "other" when _otherMediumName is not null => OtherMedium.Create(_otherMediumName),
        _ => throw new InvalidOperationException("Owned item payload is not valid")
    };
}
```

- [ ] **Step 7: Reject physical details for digital items**

In `OwnedItemHolding`, add this guard to the private constructor:

```csharp
if (medium is DigitalFile && (details.Condition.HasValue || details.StorageLocation.HasValue))
{
    throw new DomainException("owned_item.physical_details_invalid", "Digital owned items cannot carry physical condition or storage location");
}
```

Add `using DiscWeave.Domain.SharedKernel.Errors;`.

- [ ] **Step 8: Run focused owned item tests**

Run:

```bash
cd api
dotnet test tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter "FullyQualifiedName~OwnedItemTests"
```

Expected: PASS after all domain changes and test rewrites are complete.

---

### Task 4: Update EF Core Mapping And SQLite Schema Expectations

**Files:**

- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/OwnedItemConfiguration.cs`
- Modify: `api/tests/DiscWeave.Infrastructure.Tests/DiscWeaveDbContextTests.cs`
- Modify: `api/tests/DiscWeave.Infrastructure.Tests/DiscWeaveDbContextCollectionBoundaryTests.cs`

- [ ] **Step 1: Replace target mapping with release_id mapping**

In `OwnedItemConfiguration`, remove constants and mappings for `_targetType`, `_targetReleaseId`, and `_targetTrackId`. Add:

```csharp
private const string ReleaseIdProperty = "_releaseId";
private const string MediumTypeProperty = "_mediumType";
private const string ConditionProperty = "_condition";
private const string StorageLocationProperty = "_storageLocation";
```

Map `_releaseId`:

```csharp
_ = builder.Property<ReleaseId>(ReleaseIdProperty)
    .HasColumnName("release_id")
    .HasConversion(PersistenceValueConverters.ReleaseId)
    .ValueGeneratedNever();
```

- [ ] **Step 2: Add physical-detail check constraint**

Set the table mapping to:

```csharp
_ = builder.ToTable(
    "owned_items",
    table => table.HasCheckConstraint(
        "ck_owned_items_physical_details",
        "medium_type <> 'digital' OR (condition IS NULL AND storage_location IS NULL)"));
```

- [ ] **Step 3: Update release foreign key and indexes**

Replace the owned item release/track relationships and inventory indexes with:

```csharp
_ = builder.HasOne<Release>()
    .WithMany()
    .HasForeignKey(nameof(OwnedItem.CollectionId), ReleaseIdProperty)
    .HasPrincipalKey(nameof(Release.CollectionId), nameof(Release.Id))
    .OnDelete(DeleteBehavior.Restrict);

_ = builder.HasIndex(ReleaseIdProperty);
_ = builder.HasIndex(item => item.CollectionId);
_ = builder.HasIndex(MediumTypeProperty);
_ = builder.HasIndex(StatusProperty);
_ = builder.HasIndex(nameof(OwnedItem.CollectionId), ConditionProperty)
    .HasDatabaseName("ix_owned_items_collection_condition");
_ = builder.HasIndex(nameof(OwnedItem.CollectionId), StorageLocationProperty)
    .HasDatabaseName("ix_owned_items_collection_storage_location");
_ = builder.HasIndex(nameof(OwnedItem.CollectionId), ReleaseIdProperty, MediumTypeProperty)
    .HasDatabaseName("ix_owned_items_inventory_release_medium");
_ = builder.HasIndex(nameof(OwnedItem.CollectionId), ReleaseIdProperty, StatusProperty)
    .HasDatabaseName("ix_owned_items_inventory_release_status");
```

- [ ] **Step 4: Update schema test expectations**

In `DiscWeaveDbContextTests.Sqlite_schema_creation_creates_the_local_catalog_schema`, add:

```csharp
string[] releaseTrackColumns = [.. await ReadColumnNamesAsync(context, "release_tracks")];
Assert.Contains("release_track_id", releaseTrackColumns);
Assert.Contains("release_id", ownedItemColumns);
Assert.DoesNotContain("target_type", ownedItemColumns);
Assert.DoesNotContain("target_track_id", ownedItemColumns);
```

- [ ] **Step 5: Update persistence test data**

Replace every old target-based `OwnedItem.Create` call in infrastructure tests with direct release-owned construction:

```csharp
OwnedItem.Create(collectionId, OwnedItemId.New(), releaseId, OwnershipStatus.Owned, VinylRecord.Create("12-inch"))
```

Remove test data that creates `OwnedItemTarget.ForTrack`. When a test needs a digital item, create it against a release:

```csharp
OwnedItem.Create(
    collectionId,
    OwnedItemId.New(),
    releaseId,
    OwnershipStatus.Owned,
    DigitalFile.Create(
        FilePath.FromAbsolutePath("/music/New Order/Confusion"),
        AudioFileFormat.Flac,
        FileImportIdentity.Create(
            FilePath.FromAbsolutePath("/music/New Order/Confusion"),
            123_456,
            DateTimeOffset.UnixEpoch,
            "abcdef")))
```

- [ ] **Step 6: Run infrastructure tests focused on persistence**

Run:

```bash
cd api
dotnet test tests/DiscWeave.Infrastructure.Tests/DiscWeave.Infrastructure.Tests.csproj --filter "FullyQualifiedName~DiscWeaveDbContextTests|FullyQualifiedName~DiscWeaveDbContextCollectionBoundaryTests"
```

Expected: PASS after EF mapping and test data are aligned.

---

### Task 5: Apply Minimal API, Import, Search, And Graph Compatibility Edits

**Files:**

- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemMapper.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemResponseMapper.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.List.cs`
- Modify: `api/src/DiscWeave.Api/Features/OwnedItems/OwnedItemsEndpointRouteBuilderExtensions.DigitalFiles.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.OwnedCopies.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Files.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Media.cs`
- Modify: `api/src/DiscWeave.Api/Features/CatalogGraph/CatalogGraphEndpointRouteBuilderExtensions*.cs`
- Modify: `api/src/DiscWeave.Api/Features/CatalogLinks/CatalogLinksEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Playlists/PlaylistMapper.SmartSql.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Search/SearchDocumentBuilder*.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Delete.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.RestoreMapping.cs`
- Modify: `api/src/DiscWeave.Api/Features/Settings/SettingsDictionaryUsage.cs`
- Modify: `api/src/DiscWeave.Seeding/LargeCollectionSeedGenerator.cs`

- [ ] **Step 1: Make OwnedItemMapper release-only**

Replace `CreateTarget` with:

```csharp
public static ReleaseId CreateReleaseId(string? targetType, Guid targetId)
{
    return Required(targetType, "owned_item.target_type_required").Trim() switch
    {
        "release" => new ReleaseId(targetId),
        "track" => throw new DomainException("owned_item.track_target_unsupported", "Owned items must target releases"),
        _ => throw new DomainException("owned_item.target_type_invalid", "Owned item target type is invalid")
    };
}
```

Update `CreateMedium` to switch on `request.Type` directly and stop reading `mediaEntry.MediaProfile`:

```csharp
public static IMedium CreateMedium(MediumRequest request)
{
    return Required(request.Type, "medium.type_required").Trim() switch
    {
        "digital" => DigitalFile.Create(
            FilePath.FromAbsolutePath(Required(request.Path, "medium.path_required")),
            ParseAudioFileFormat(Required(request.Format, "medium.format_required"))),
        "vinyl" => VinylRecord.Create(Required(request.Description, "medium.description_required")),
        "cd" => CompactDisc.Create(request.DiscCount ?? 1),
        "cassette" => CassetteTape.Create(Required(request.Description, "medium.description_required")),
        "other" => OtherMedium.Create(Required(request.Description, "medium.description_required")),
        _ => throw new DomainException("owned_item.type_invalid", "Owned item type is invalid")
    };
}
```

- [ ] **Step 2: Keep API create/update routes release-only**

In create/update routes, remove dictionary media profile lookup for owned item creation and call:

```csharp
IMedium medium = OwnedItemMapper.CreateMedium(request.Medium);
var item = OwnedItem.Create(
    currentCollection.CollectionId,
    OwnedItemId.New(),
    OwnedItemMapper.CreateReleaseId(request.TargetType, request.TargetId),
    OwnedItemMapper.ParseOwnershipStatus(request.Status),
    medium);
```

For update target handling, return `ReleaseId?` instead of `OwnedItemTarget?`, call `item.UpdateRelease(releaseId.Value)`, and keep the existing `"owned_item.target_shape_invalid"` response when only one target field is supplied.

- [ ] **Step 3: Map responses as release-owned**

In `OwnedItemMapper.ToResponse`, always return target type `release`:

```csharp
return new OwnedItemResponse(
    item.Id.Value,
    "release",
    item.ReleaseId.Value,
    targetResponse,
    ToOwnershipStatusCode(holding.Status),
    ToMediumResponse(holding.Medium),
    holding.Details.Condition.HasValue ? holding.Details.Condition.Match(ToItemConditionCode, () => string.Empty) : null,
    holding.Details.StorageLocation.HasValue ? holding.Details.StorageLocation.Match(location => location.Name, () => string.Empty) : null,
    inventorySignals);
```

In `OwnedItemResponseMapper`, remove track target loading and group inventory signals by `item.ReleaseId`.

- [ ] **Step 4: Remove track-owned import side effect**

In `ReleaseImportConfirmationService.Media.cs`, remove the call to `AddTrackOwnedItemAsync`. In `ReleaseImportConfirmationService.Files.cs`, delete `AddTrackOwnedItemAsync` and keep `AddReleaseOwnedItemAsync` creating one digital item for the release:

```csharp
var item = OwnedItem.Create(
    collectionId,
    OwnedItemId.New(),
    release.Id,
    OwnershipStatus.Owned,
    DigitalFile.Create(FilePath.FromAbsolutePath(draft.SourcePath), releaseFormat));
```

- [ ] **Step 5: Route graph/search code through release ownership**

Use direct release ownership in graph and search code:

```csharp
OwnedItem[] ownedItems = [.. data.OwnedItems.Values.Where(item => item.ReleaseId == release.Id)];
```

For track contexts, derive owned items from releases containing the track:

```csharp
Release[] releases = [.. data.Releases.Values.Where(release => release.Tracklist.Any(item => item.TrackId == track.Id))];
HashSet<ReleaseId> releaseIds = [.. releases.Select(release => release.Id)];
OwnedItem[] ownedItems = [.. data.OwnedItems.Values.Where(item => releaseIds.Contains(item.ReleaseId))];
```

Update search grouping to build `OwnedItemsByReleaseId` from `item.ReleaseId`. If `OwnedItemsByTrackId` is still needed for search results, derive it by release track appearances rather than direct owned item targets.

- [ ] **Step 6: Update smart playlist SQL**

Release filters use `item.release_id = release.release_id`. Track filters must join release appearances:

```sql
AND EXISTS (
    SELECT 1
    FROM release_tracks release_track
    INNER JOIN owned_items item
        ON item.collection_id = release_track.collection_id
        AND item.release_id = release_track.release_id
    WHERE release_track.collection_id = track.collection_id
        AND release_track.track_id = track.track_id
        AND lower(item.medium_type) IN (@medium0, @medium1)
)
```

Use the same join pattern for ownership status filters, replacing the final predicate with `AND item.ownership_status IN (@status0, @status1)`.

- [ ] **Step 7: Update restore, settings usage, and seeding to fixed codes**

Replace custom-code factory calls such as `DigitalFile.Create(medium.Type, path, format)`, `VinylRecord.Create(medium.Type, description)`, `CompactDisc.Create(medium.Type, discCount)`, `CassetteTape.Create(medium.Type, description)`, and `OtherMedium.Create(medium.Type, description)` with fixed-code factories:

```csharp
"digital" => DigitalFile.Create(
    FilePath.FromAbsolutePath(medium.Path ?? "/discweave/restored-digital-copy"),
    ToAudioFileFormat(medium.Format ?? "mp3")),
"vinyl" => VinylRecord.Create(medium.Description),
"cd" => CompactDisc.Create(medium.DiscCount ?? 1),
"cassette" => CassetteTape.Create(medium.Description),
_ => OtherMedium.Create(medium.Description)
```

In `SettingsDictionaryUsage.RecodeMedium`, remove item type recoding for owned items. Media dictionary entries can still be used as labels until Roadmap 60 removes or reinterprets that UI surface, but domain owned item types stay fixed.

- [ ] **Step 8: Run API build to expose remaining compile sites**

Run:

```bash
cd api
dotnet build DiscWeave.slnx --no-restore
```

Expected: PASS after all `OwnedItemTarget`, custom medium code, and `OwnedItem.Create` call sites are updated.

---

### Task 6: Update API And Import Tests For The New Foundation

**Files:**

- Modify: `api/tests/DiscWeave.Api.Tests/OwnedItemDigitalFileEndpointTests.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/ExportEndpointTests.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/ApiTestHost.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/CatalogQualityEndpointTests.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/CreditEndpointTests.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/ExportEndpointTests.PortableV1.cs`
- Modify: `api/tests/DiscWeave.Api.Tests/ReviewWorkbenchEndpointTests.cs`

- [ ] **Step 1: Update test fixture inserts**

In `ApiTestHost`, update raw `owned_items` inserts so they use `release_id` and no longer insert `target_type` or `target_track_id`.

Expected owned item insert shape:

```sql
INSERT INTO owned_items (
    owned_item_id,
    collection_id,
    release_id,
    ownership_status,
    medium_type)
VALUES ($ownedItemId, $collectionId, $releaseId, $status, $mediumType);
```

- [ ] **Step 2: Update owned item endpoint tests**

Change request bodies that create track-owned items to assert the new validation error:

```csharp
Assert.Equal("owned_item.track_target_unsupported", error.RootElement.GetProperty("code").GetString());
```

Change release-owned create/update expectations so response still has:

```csharp
Assert.Equal("release", document.RootElement.GetProperty("targetType").GetString());
Assert.Equal(releaseId, document.RootElement.GetProperty("targetId").GetGuid());
```

- [ ] **Step 3: Update digital file endpoint tests**

Keep tests that update a digital release-owned item's path/format. Remove any assertion that digital file updates are attached to a track target. Assert that digital item responses remain release-owned:

```csharp
Assert.Equal("release", item.GetProperty("targetType").GetString());
Assert.Equal(releaseId, item.GetProperty("targetId").GetGuid());
```

- [ ] **Step 4: Run focused API tests**

Run:

```bash
cd api
dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~OwnedItem|FullyQualifiedName~Import|FullyQualifiedName~Export"
```

Expected: PASS after API compatibility edits and fixtures are updated.

---

### Task 7: Full Validation And Cleanup

**Files:**

- Modify only files already touched by Tasks 1-6.

- [ ] **Step 1: Search for removed target model**

Run:

```bash
cd api
rg -n "OwnedItemTarget|ReleaseOwnedItemTarget|TrackOwnedItemTarget|ForTrack|target_track_id|target_type" src tests -g '*.cs'
```

Expected: no matches for owned item target model. Matches for credit target types or unrelated route target terms are acceptable only when the match is not about owned items.

- [ ] **Step 2: Search for configurable medium code creation**

Run:

```bash
cd api
rg -n "DigitalFile\\.Create\\([^\\n]*code|VinylRecord\\.Create\\([^\\n]*code|CompactDisc\\.Create\\([^\\n]*code|CassetteTape\\.Create\\([^\\n]*code|OtherMedium\\.Create\\([^\\n]*code|MediaProfile|media_profile" src tests -g '*.cs'
```

Expected: no owned item creation path depends on media profile to choose domain type. Remaining settings/export dictionary metadata references can remain only if they do not feed `OwnedItem` domain construction.

- [ ] **Step 3: Run domain and infrastructure suites**

Run:

```bash
cd api
dotnet test tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --no-restore
dotnet test tests/DiscWeave.Infrastructure.Tests/DiscWeave.Infrastructure.Tests.csproj --no-restore
```

Expected: PASS.

- [ ] **Step 4: Run full API suite**

Run:

```bash
cd api
dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --no-restore
```

Expected: PASS.

- [ ] **Step 5: Run full backend solution**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --no-restore
```

Expected: PASS.

- [ ] **Step 6: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- api/src/DiscWeave.Domain api/src/DiscWeave.Infrastructure/Persistence api/src/DiscWeave.Api/Features api/tests
```

Expected: changes are scoped to release-owned item domain foundation, persistence mapping, minimal API compatibility, and related tests.

- [ ] **Step 7: Commit**

Run:

```bash
git add api/src/DiscWeave.Domain api/src/DiscWeave.Infrastructure/Persistence api/src/DiscWeave.Api/Features api/src/DiscWeave.Seeding api/tests
git commit -m "Rebuild owned items around release copies"
```

Expected: commit succeeds with only Roadmap 57 implementation files staged.

---

## Self-Review

Spec coverage:

- Release-owned item target: covered by Tasks 1, 3, 4, 5, and 6.
- Fixed owned item types: covered by Tasks 1, 3, 5, and 7.
- Type-specific details: covered by current value-object details in Task 3 and persistence fields in Task 4.
- Physical-only condition/storage: covered by Tasks 1, 3, 4, and 6.
- Stable release track identity: covered by Tasks 1, 2, and 4.
- Local schema reset allowed: used by replacing owned item columns in Task 4 without migration.

Known follow-up boundaries:

- Local audio files and digital track file links begin in Roadmap 58.
- Import confirmation still creates only a release-owned digital item in this issue; file mapping begins in Roadmap 59.
- Public contract cleanup is intentionally limited here and completed in Roadmap 60.
