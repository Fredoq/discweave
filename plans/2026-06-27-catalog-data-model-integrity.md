# Catalog Data Model Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move catalog identity rules out of defensive UI code and into the domain model, API validation, and SQLite schema.

**Architecture:** The canonical catalog model must prevent invalid duplicate labels, release-label rows, relations, and credits before they reach UI read models. Because this branch does not need backward compatibility, replace the accumulated SQLite updater chain with a clean initial schema generated from the current EF model, then add explicit uniqueness keys for the canonical identities.

**Tech Stack:** ASP.NET Core minimal APIs, EF Core SQLite, React 19, Vite, Vitest, xUnit.

---

## File Structure

**Schema reset and startup**
- Modify: `api/src/DiscWeave.Api/Program.cs`
- Delete: `api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader*.cs`
- Delete or rewrite: `api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgrader*.cs`
- Create: `api/tests/DiscWeave.Api.Tests/Architecture/SqliteSchemaPolicyTests.cs`

**Label identity**
- Modify: `api/src/DiscWeave.Domain/Catalog/Label.cs`
- Create: `api/src/DiscWeave.Domain/Catalog/LabelName.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/LabelConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/Labels/LabelsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Entry.cs`
- Delete: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.LabelNormalization.cs`
- Modify tests: `api/tests/DiscWeave.Domain.Tests/Catalog/CatalogModelTests.cs`, `api/tests/DiscWeave.Api.Tests/LabelWorkflowE2ETests.cs`, `api/tests/DiscWeave.Api.Tests/ReleaseEntryLabelNormalizationE2ETests.cs`

**Release label source of truth**
- Modify: `api/src/DiscWeave.Domain/Catalog/ReleaseMetadata.cs`
- Modify: `api/src/DiscWeave.Domain/Catalog/Release.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleaseRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleaseResponse.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Response.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions*.cs`
- Modify: `api/src/DiscWeave.Api/Features/ReviewWorkbench/ReviewWorkbenchSignalBuilder.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Search/SearchDocumentBuilder.cs`
- Modify: `api/src/DiscWeave.Api/Features/CatalogGraph/CatalogGraphEndpointRouteBuilderExtensions*.cs`
- Modify tests: release, export/restore, search, graph, review workbench tests that assert `labelId`

**Release-label duplicate prevention**
- Modify: `api/src/DiscWeave.Domain/Catalog/ReleaseLabel.cs`
- Create: `api/src/DiscWeave.Domain/Catalog/ReleaseLabelKey.cs`
- Modify: `api/src/DiscWeave.Domain/Catalog/Release.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs`
- Modify tests: `api/tests/DiscWeave.Domain.Tests/Catalog/CatalogModelTests.cs`, `api/tests/DiscWeave.Api.Tests/ReleaseEntryLabelNormalizationE2ETests.cs`, `app/src/App.workspaces-labels.test.tsx`

**Relation duplicate prevention**
- Create: `api/src/DiscWeave.Domain/Relations/ArtistRelationIdentity.cs`
- Create: `api/src/DiscWeave.Domain/Relations/TrackRelationIdentity.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ArtistRelationConfiguration.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/TrackRelationConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/ArtistRelations/ArtistRelationsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.cs`
- Modify tests: `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.cs`, `api/tests/DiscWeave.Domain.Tests/Relations/RelationTests.cs`, `app/src/App.workspaces-artists.test.tsx`, `app/src/App.workspaces-owned-relations.test.tsx`

**Credit duplicate prevention**
- Create: `api/src/DiscWeave.Domain/Credits/CreditIdentity.cs`
- Modify: `api/src/DiscWeave.Domain/Credits/Credit.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/CreditConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/Credits/CreditsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Credits.cs`
- Modify tests: `api/tests/DiscWeave.Api.Tests/CreditEndpointTests.cs`, `api/tests/DiscWeave.Domain.Tests/Credits/CreditTests.cs`, `app/src/App.relation-credit-navigation.test.tsx`

**UI cleanup**
- Modify: `app/src/features/labels/LabelsWorkspace.tsx`
- Modify: `app/src/features/releases/releaseFormHelpers.ts`
- Modify: `app/src/features/relations/RelationEntryForm.tsx`
- Modify: `app/src/features/artists/artistRelationshipGroups.ts`
- Modify: `app/src/features/artists/ArtistDetail.tsx`
- Modify tests: `app/src/App.workspaces-labels.test.tsx`, `app/src/App.workspaces-artists.test.tsx`, `app/src/App.workspaces-owned-relations.test.tsx`, `app/src/App.release-entry-validation.test.tsx`

---

## Task 1: Remove The SQLite Upgrader Chain

**Files:**
- Create: `api/tests/DiscWeave.Api.Tests/Architecture/SqliteSchemaPolicyTests.cs`
- Modify: `api/src/DiscWeave.Api/Program.cs`
- Delete: `api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader*.cs`
- Delete: `api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgrader*.cs`

- [ ] **Step 1: Write the failing architecture test**

Create `api/tests/DiscWeave.Api.Tests/Architecture/SqliteSchemaPolicyTests.cs`:

```csharp
namespace DiscWeave.Api.Tests.Architecture;

public sealed class SqliteSchemaPolicyTests
{
    [Fact(DisplayName = "SQLite startup uses the current EF model without manual schema upgraders")]
    public void SqliteStartupUsesCurrentEfModelWithoutManualSchemaUpgraders()
    {
        DirectoryInfo repositoryRoot = RepositoryRoot.Find();
        string programSource = File.ReadAllText(Path.Combine(repositoryRoot.FullName, "src", "DiscWeave.Api", "Program.cs"));
        string persistencePath = Path.Combine(repositoryRoot.FullName, "src", "DiscWeave.Infrastructure", "Persistence");

        Assert.DoesNotContain("SqliteSchemaUpgrader", programSource);
        Assert.Empty(Directory.EnumerateFiles(persistencePath, "SqliteSchemaUpgrader*.cs", SearchOption.TopDirectoryOnly));
    }
}
```

- [ ] **Step 2: Run the policy test and verify it fails**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter SqliteStartupUsesCurrentEfModelWithoutManualSchemaUpgraders
```

Expected: FAIL because `Program.cs` still calls `SqliteSchemaUpgrader` and `SqliteSchemaUpgrader*.cs` files still exist.

- [ ] **Step 3: Remove manual updater startup calls**

In `api/src/DiscWeave.Api/Program.cs`, reduce `InitializeSqliteDatabaseAsync` to the current EF model creation:

```csharp
static async Task InitializeSqliteDatabaseAsync(IServiceProvider services)
{
    await using AsyncServiceScope scope = services.CreateAsyncScope();
    DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
    _ = await context.Database.EnsureCreatedAsync();
}
```

- [ ] **Step 4: Delete obsolete updater implementation and tests**

Delete these files:

```text
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.ArtistRelations.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.CollectionReview.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.DuplicateLabels.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.ImportDiagnostics.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.ImportDraftTracks.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.LocalAudioFiles.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.LooseFileCandidates.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.RelationSuggestions.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.RunOnce.cs
api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.cs
api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderDuplicateLabelsTests.cs
api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderTests.ArtistRelations.cs
api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderTests.CollectionReview.cs
api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderTests.Helpers.cs
api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderTests.ImportDiagnostics.cs
api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderTests.ImportSuggestions.cs
api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderTests.cs
```

- [ ] **Step 5: Run the policy test and infrastructure tests**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter SqliteStartupUsesCurrentEfModelWithoutManualSchemaUpgraders
dotnet test DiscWeave.slnx --filter FullyQualifiedName~DiscWeave.Infrastructure.Tests
```

Expected: PASS or compile failures only from references to deleted updater helpers. Remove any remaining `SqliteSchemaUpgrader` references and repeat until both commands pass.

- [ ] **Step 6: Commit**

```bash
git add api/src/DiscWeave.Api/Program.cs api/src/DiscWeave.Infrastructure/Persistence api/tests/DiscWeave.Api.Tests/Architecture api/tests/DiscWeave.Infrastructure.Tests
git commit -m "chore: reset sqlite schema initialization"
```

---

## Task 2: Make Label Name Identity A Domain And Database Invariant

**Files:**
- Create: `api/src/DiscWeave.Domain/Catalog/LabelName.cs`
- Modify: `api/src/DiscWeave.Domain/Catalog/Label.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/LabelConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/Labels/LabelsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Entry.cs`
- Delete: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.LabelNormalization.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Catalog/CatalogModelTests.cs`
- Test: `api/tests/DiscWeave.Api.Tests/LabelWorkflowE2ETests.cs`

- [ ] **Step 1: Write failing domain tests for stable label keys**

Add to `CatalogModelTests`:

```csharp
[Theory]
[InlineData(" Big   Life ", "big life")]
[InlineData("BIG LIFE", "big life")]
[InlineData("Big Life", "big life")]
public void Labels_store_a_stable_normalized_name_key(string name, string expectedNameKey)
{
    Label label = Label.Create(CollectionId.New(), LabelId.New(), name);

    Assert.Equal("Big Life", label.Name);
    Assert.Equal(expectedNameKey, label.NameKey);
}

[Fact]
public void Label_rename_updates_the_normalized_name_key()
{
    Label label = Label.Create(CollectionId.New(), LabelId.New(), "Factory");

    label.Rename(" Factory   Records ");

    Assert.Equal("Factory Records", label.Name);
    Assert.Equal("factory records", label.NameKey);
}
```

- [ ] **Step 2: Run the domain tests and verify they fail**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "Labels_store_a_stable_normalized_name_key|Label_rename_updates_the_normalized_name_key"
```

Expected: FAIL because `Label.NameKey` does not exist.

- [ ] **Step 3: Add the canonical label normalizer**

Create `api/src/DiscWeave.Domain/Catalog/LabelName.cs`:

```csharp
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Catalog;

public static class LabelName
{
    public static string NormalizeDisplayName(string value)
    {
        return string.Join(' ', Guard.RequiredText(value, nameof(value), "label.name_required").Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    public static string NormalizeKey(string value)
    {
        return NormalizeDisplayName(value).ToLowerInvariant();
    }
}
```

- [ ] **Step 4: Store the key on `Label`**

Update `api/src/DiscWeave.Domain/Catalog/Label.cs` so create and rename set both display name and key:

```csharp
private Label(CollectionId collectionId, LabelId id, string name)
{
    CollectionId = collectionId;
    Id = id;
    SetName(name);
}

public string Name { get; private set; } = string.Empty;

public string NameKey { get; private set; } = string.Empty;

public static Label Create(CollectionId collectionId, LabelId id, string name)
{
    return new Label(collectionId, id, name);
}

public void Rename(string name)
{
    SetName(name);
}

private void SetName(string name)
{
    Name = LabelName.NormalizeDisplayName(name);
    NameKey = LabelName.NormalizeKey(name);
}
```

- [ ] **Step 5: Enforce the key in SQLite**

Update `LabelConfiguration`:

```csharp
_ = builder.Property(label => label.NameKey)
    .HasColumnName("name_key")
    .HasMaxLength(512)
    .IsRequired();

_ = builder.HasIndex(label => new { label.CollectionId, label.NameKey })
    .IsUnique()
    .HasDatabaseName("ux_labels_collection_name_key");
```

Keep the existing public `label_id` alternate key.

- [ ] **Step 6: Use `NameKey` in label API lookup**

In `LabelsEndpointRouteBuilderExtensions`, replace the array load and in-memory normalized comparison with direct key lookup:

```csharp
private static Task<Label?> FindLabelByNormalizedNameAsync(
    DiscWeaveDbContext context,
    CollectionId collectionId,
    string? name,
    LabelId? excludedLabelId,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(name))
    {
        return Task.FromResult<Label?>(null);
    }

    string nameKey = LabelName.NormalizeKey(name);
    return context.Labels.FirstOrDefaultAsync(
        label =>
            label.CollectionId == collectionId &&
            label.Id != excludedLabelId &&
            label.NameKey == nameKey,
        cancellationToken);
}
```

- [ ] **Step 7: Use `NameKey` when resolving release labels by name**

In `ResolveLabelAsync`, replace local custom normalization with `LabelName.NormalizeKey(name)` and query `label.NameKey == nameKey`. Keep the local tracked lookup first:

```csharp
string name = LabelName.NormalizeDisplayName(labelRequest.Name);
string nameKey = LabelName.NormalizeKey(name);
Label? existingByName = context.Labels.Local.FirstOrDefault(label =>
    label.CollectionId == collectionId &&
    label.NameKey == nameKey);
existingByName ??= await context.Labels.SingleOrDefaultAsync(
    label => label.CollectionId == collectionId && label.NameKey == nameKey,
    cancellationToken);
```

- [ ] **Step 8: Run label tests**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "Labels_store_a_stable_normalized_name_key|Label_rename_updates_the_normalized_name_key|Label_create_reuses_existing_label_by_normalized_name"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/src/DiscWeave.Domain/Catalog api/src/DiscWeave.Infrastructure/Persistence/Configurations/LabelConfiguration.cs api/src/DiscWeave.Api/Features/Labels api/src/DiscWeave.Api/Features/Releases api/tests/DiscWeave.Domain.Tests/Catalog api/tests/DiscWeave.Api.Tests/LabelWorkflowE2ETests.cs
git commit -m "fix: enforce label identity by normalized name"
```

---

## Task 3: Remove `ReleaseMetadata.LabelId` As A Persisted Source Of Truth

**Files:**
- Modify: `api/src/DiscWeave.Domain/Catalog/ReleaseMetadata.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Response.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions*.cs`
- Modify: `api/src/DiscWeave.Api/Features/ReviewWorkbench/ReviewWorkbenchSignalBuilder.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Search/SearchDocumentBuilder.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Catalog/CatalogModelTests.cs`
- Test: `api/tests/DiscWeave.Api.Tests/ReleaseEntryLabelNormalizationE2ETests.cs`
- Test: `api/tests/DiscWeave.Api.Tests/ExportRestoreEndpointTests.RichData.cs`

- [ ] **Step 1: Update failing domain expectations**

In `CatalogModelTests.Release_can_store_type_and_cover_image`, remove label assertions and build metadata without `WithLabel`:

```csharp
ReleaseMetadata metadata = ReleaseMetadata.Empty
    .WithType(ReleaseType.Album)
    .WithReleaseYear(1989)
    .WithReleaseDate(releaseDate)
    .WithCoverImage(CoverImage.FromLocalUpload(
        "collection/release/new-order-technique.jpg",
        "image/jpeg",
        "Technique Front.jpg",
        1_024));
```

Expected assertion after the change:

```csharp
Assert.Equal("album", actualMetadata.Type);
Assert.Equal(1989, Assert.IsType<PresentOptionalValue<int>>(actualMetadata.Year).Value);
```

- [ ] **Step 2: Run the changed domain test and verify it fails to compile**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter Release_can_store_type_and_cover_image
```

Expected: compile failures from remaining production references to `ReleaseMetadata.LabelId` and `WithLabel`.

- [ ] **Step 3: Remove label from `ReleaseMetadata`**

Change `ReleaseMetadata` constructor and properties to only keep type, year, release date, and cover image:

```csharp
private ReleaseMetadata(
    string type,
    IOptionalValue<int>? year,
    IOptionalValue<DateOnly>? releaseDate,
    IOptionalValue<CoverImage>? coverImage)
{
    Type = Guard.RequiredText(type, nameof(type), "release.type_required");
    Year = year ?? Optional.Missing<int>();
    ReleaseDate = releaseDate ?? Optional.Missing<DateOnly>();
    CoverImage = coverImage ?? Optional.Missing<CoverImage>();
}
```

Delete `public IOptionalValue<LabelId> LabelId { get; }` and delete `WithLabel`.

- [ ] **Step 4: Remove the `label_id` column mapping**

Delete this block from `ReleaseConfiguration.ConfigureSummary`:

```csharp
ComplexTypePropertyBuilder<IOptionalValue<LabelId>> labelProperty = metadata.Property(value => value.LabelId)
    .HasColumnName("label_id")
    .HasConversion(PersistenceValueConverters.OptionalLabelId)
    .IsRequired(false);
labelProperty.Metadata.SetValueComparer(PersistenceValueConverters.OptionalLabelIdComparer);
```

- [ ] **Step 5: Stop writing metadata label during release create/update**

In `ApplyReleaseRequestAsync`, remove the block that sets `metadata = metadata.WithLabel(...)`. Keep the shape check only if `ReleaseRequest.LabelId` remains supported during this task:

```csharp
if (request.LabelId is not null && request.Labels is { Count: > 0 })
{
    throw new DomainException("release.label_shape_invalid", "Release request must use either labelId or labels, not both");
}
```

- [ ] **Step 6: Derive response `LabelId` from `Release.Labels` only**

In `ToReleaseResponse`, replace metadata label id usage:

```csharp
Guid? primaryLabelId = release.Labels.FirstOrDefault()?.LabelId.Value;
```

Pass `primaryLabelId` to `ReleaseResponse`.

- [ ] **Step 7: Update missing-label review logic**

Change the missing-label condition:

```csharp
foreach (Release release in releases.Where(release => !release.IsNotOnLabel && release.Labels.Count == 0))
```

- [ ] **Step 8: Update export and restore mapping**

In restore mapping, stop reading `release.LabelId` into metadata. Restore labels only from `release.Labels`.

In CSV export, either remove the legacy `label_id` release column or populate it from `release.Labels.FirstOrDefault()?.LabelId`. Use one format consistently in tests.

- [ ] **Step 9: Run focused API tests**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "ReleaseEntryLabelNormalizationE2ETests|ExportRestoreEndpointTests|ReviewWorkbenchEndpointSignalTests|SearchEndpointTests|CatalogGraphNavigationEndpointTests"
```

Expected: PASS after every `ReleaseMetadata.LabelId` reference is removed or converted to `Release.Labels`.

- [ ] **Step 10: Commit**

```bash
git add api/src api/tests
git commit -m "fix: make release labels the only label source"
```

---

## Task 4: Prevent Duplicate Release-Label Rows While Allowing Multiple Catalog Numbers

**Files:**
- Create: `api/src/DiscWeave.Domain/Catalog/ReleaseLabelKey.cs`
- Modify: `api/src/DiscWeave.Domain/Catalog/ReleaseLabel.cs`
- Modify: `api/src/DiscWeave.Domain/Catalog/Release.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Catalog/CatalogModelTests.cs`
- Test: `api/tests/DiscWeave.Api.Tests/ReleaseEntryLabelNormalizationE2ETests.cs`

- [ ] **Step 1: Write failing domain tests**

Add to `CatalogModelTests`:

```csharp
[Fact]
public void Release_allows_one_label_with_multiple_catalog_numbers()
{
    var labelId = LabelId.New();
    Release release = Release.Create(CollectionId.New(), ReleaseId.New(), "Adventures Beyond The Ultraworld");

    release.UpdateLabels(false,
    [
        ReleaseLabel.Create(labelId, Optional.From("BLRDCD 5"), false),
        ReleaseLabel.Create(labelId, Optional.From("847963. 2"), false)
    ]);

    Assert.Equal(2, release.Labels.Count);
}

[Fact]
public void Release_rejects_duplicate_label_catalog_number_rows()
{
    var labelId = LabelId.New();
    Release release = Release.Create(CollectionId.New(), ReleaseId.New(), "Adventures Beyond The Ultraworld");

    DomainException exception = Assert.Throws<DomainException>(() =>
        release.UpdateLabels(false,
        [
            ReleaseLabel.Create(labelId, Optional.From(" BLRDCD 5 "), false),
            ReleaseLabel.Create(labelId, Optional.From("BLRDCD 5"), false)
        ]));

    Assert.Equal("release_label.duplicate", exception.Code);
}
```

- [ ] **Step 2: Run the tests and verify the duplicate test fails**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "Release_allows_one_label_with_multiple_catalog_numbers|Release_rejects_duplicate_label_catalog_number_rows"
```

Expected: one PASS and one FAIL because duplicate release-label rows are accepted.

- [ ] **Step 3: Add release-label key value**

Create `ReleaseLabelKey`:

```csharp
namespace DiscWeave.Domain.Catalog;

public sealed record ReleaseLabelKey(string Value)
{
    public static ReleaseLabelKey From(ReleaseLabel label)
    {
        string catalogPart = label.CatalogNumber.Match(
            value => $"catalog:{NormalizeCatalogNumberKey(value)}",
            () => label.HasNoCatalogNumber ? "no-number" : "missing-number");

        return new ReleaseLabelKey($"{label.LabelId.Value:D}|{catalogPart}");
    }

    private static string NormalizeCatalogNumberKey(string value)
    {
        return string.Join(' ', value.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
```

- [ ] **Step 4: Enforce release-label uniqueness in `Release.UpdateLabels`**

Add this check before mutating `_labels`:

```csharp
private static void EnsureReleaseLabelsAreUnique(IReadOnlyList<ReleaseLabel> labels)
{
    var keys = new HashSet<ReleaseLabelKey>();
    foreach (ReleaseLabel label in labels)
    {
        if (!keys.Add(ReleaseLabelKey.From(label)))
        {
            throw new DomainException("release_label.duplicate", "Release label already exists for this catalog number");
        }
    }
}
```

Call it from `UpdateLabels` before `_labels.Clear()`.

- [ ] **Step 5: Add persisted key for DB uniqueness**

Add a private `Key` property or field to `ReleaseLabel`, set from `ReleaseLabelKey.From(this).Value`, and map it in `ReleaseConfiguration`:

```csharp
_ = label.Property<string>("_key")
    .HasColumnName("label_key")
    .HasMaxLength(320)
    .IsRequired();

_ = label.HasIndex(CollectionIdProperty, ReleaseIdColumn, "_key")
    .IsUnique()
    .HasDatabaseName("ux_release_labels_collection_release_key");
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "Release_rejects_duplicate_label_catalog_number_rows|ReleaseEntryLabelNormalizationE2ETests"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/src/DiscWeave.Domain/Catalog api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs api/tests
git commit -m "fix: prevent duplicate release label rows"
```

---

## Task 5: Enforce Relation Identity In Domain, API, And SQLite

**Files:**
- Create: `api/src/DiscWeave.Domain/Relations/ArtistRelationIdentity.cs`
- Create: `api/src/DiscWeave.Domain/Relations/TrackRelationIdentity.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ArtistRelationConfiguration.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/TrackRelationConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/ArtistRelations/ArtistRelationsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/TrackRelations/TrackRelationsEndpointRouteBuilderExtensions.cs`
- Test: `api/tests/DiscWeave.Api.Tests/RelationEndpointTests.cs`

- [ ] **Step 1: Write failing relation endpoint tests**

Add tests that create the same exact artist relation twice and the same exact track relation twice:

```csharp
[Fact(DisplayName = "Artist relation create rejects exact duplicate relations")]
public async Task Artist_relation_create_rejects_exact_duplicate_relations()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    Guid sourceId = await CreateArtistAsync(client, "Youth");
    Guid targetId = await CreateArtistAsync(client, "The Orb");
    var request = new
    {
        sourceArtistId = sourceId,
        targetArtistId = targetId,
        type = "memberOf"
    };

    using HttpResponseMessage first = await client.PostAsJsonAsync("/api/artist-relations", request);
    using HttpResponseMessage second = await client.PostAsJsonAsync("/api/artist-relations", request);

    Assert.Equal(HttpStatusCode.Created, first.StatusCode);
    Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
}
```

Use existing helper methods in `RelationEndpointTests` for artist and track creation. If helper names differ, add private helpers in that file that post to `/api/artists` and `/api/tracks`.

- [ ] **Step 2: Run relation tests and verify failure**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "Artist_relation_create_rejects_exact_duplicate_relations|Track_relation_create_rejects_exact_duplicate_relations"
```

Expected: FAIL because exact duplicate relation rows are accepted.

- [ ] **Step 3: Add relation identity keys**

Create `ArtistRelationIdentity`:

```csharp
namespace DiscWeave.Domain.Relations;

public sealed record ArtistRelationIdentity(Guid SourceArtistId, Guid TargetArtistId, string Type, int? PeriodStartYear, int? PeriodEndYear)
{
    public string Key => string.Join('|',
        SourceArtistId.ToString("D"),
        TargetArtistId.ToString("D"),
        Type.Trim(),
        PeriodStartYear?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "",
        PeriodEndYear?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "");
}
```

Create `TrackRelationIdentity`:

```csharp
namespace DiscWeave.Domain.Relations;

public sealed record TrackRelationIdentity(Guid SourceTrackId, Guid TargetTrackId, string RelationType)
{
    public string Key => string.Join('|',
        SourceTrackId.ToString("D"),
        TargetTrackId.ToString("D"),
        RelationType.Trim());
}
```

- [ ] **Step 4: Add unique indexes**

In `ArtistRelationConfiguration`, add a shadow `identity_key` column and unique index:

```csharp
_ = builder.Property<string>("_identityKey")
    .HasColumnName("identity_key")
    .HasMaxLength(256)
    .IsRequired();

_ = builder.HasIndex(nameof(ArtistRelation.CollectionId), "_identityKey")
    .IsUnique()
    .HasDatabaseName("ux_artist_relations_collection_identity");
```

In `TrackRelationConfiguration`, add:

```csharp
_ = builder.Property<string>("_identityKey")
    .HasColumnName("identity_key")
    .HasMaxLength(192)
    .IsRequired();

_ = builder.HasIndex(nameof(TrackRelation.CollectionId), "_identityKey")
    .IsUnique()
    .HasDatabaseName("ux_track_relations_collection_identity");
```

Update relation constructors and `Update` methods to set `_identityKey`.

- [ ] **Step 5: Return readable API conflicts**

Before adding/updating relation rows, query by `identity_key` excluding the current relation id. Return:

```csharp
return EndpointErrors.Conflict("artist_relation.duplicate", "Artist relation already exists");
```

and:

```csharp
return EndpointErrors.Conflict("track_relation.duplicate", "Track relation already exists");
```

- [ ] **Step 6: Run focused relation tests**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "RelationEndpointTests|RelationTests"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/src/DiscWeave.Domain/Relations api/src/DiscWeave.Infrastructure/Persistence/Configurations/*RelationConfiguration.cs api/src/DiscWeave.Api/Features/*Relations api/tests
git commit -m "fix: enforce catalog relation identity"
```

---

## Task 6: Enforce Credit Identity

**Files:**
- Create: `api/src/DiscWeave.Domain/Credits/CreditIdentity.cs`
- Modify: `api/src/DiscWeave.Domain/Credits/Credit.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/CreditConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/Credits/CreditsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Credits.cs`
- Test: `api/tests/DiscWeave.Api.Tests/CreditEndpointTests.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Credits/CreditTests.cs`

- [ ] **Step 1: Write failing API test**

Add to `CreditEndpointTests`:

```csharp
[Fact(DisplayName = "Credit create rejects exact duplicate target contributor role set")]
public async Task Credit_create_rejects_exact_duplicate_target_contributor_role_set()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    Guid artistId = await CreateArtistAsync(client, "Greg Hunter");
    Guid releaseId = await CreateReleaseAsync(client, "Adventures Beyond The Ultraworld", "The Orb");
    var request = new
    {
        contributorArtistId = artistId,
        targetType = "release",
        targetId = releaseId,
        roles = new[] { "engineer", "producer" }
    };

    using HttpResponseMessage first = await client.PostAsJsonAsync("/api/credits", request);
    using HttpResponseMessage second = await client.PostAsJsonAsync("/api/credits", request);

    Assert.Equal(HttpStatusCode.Created, first.StatusCode);
    Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
}
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter Credit_create_rejects_exact_duplicate_target_contributor_role_set
```

Expected: FAIL because duplicate credits are accepted.

- [ ] **Step 3: Add `CreditIdentity`**

Create:

```csharp
namespace DiscWeave.Domain.Credits;

public sealed record CreditIdentity(string TargetType, Guid TargetId, Guid ContributorArtistId, IReadOnlyList<string> Roles)
{
    public string Key => string.Join('|',
        TargetType,
        TargetId.ToString("D"),
        ContributorArtistId.ToString("D"),
        string.Join(',', Roles.Select(role => role.Trim()).Where(role => role.Length > 0).Order(StringComparer.Ordinal)));
}
```

- [ ] **Step 4: Persist `_identityKey` on `Credit`**

Set `_identityKey` after contributor, target, and roles are assigned:

```csharp
private string _identityKey = string.Empty;

private void RefreshIdentityKey()
{
    (string targetType, Guid targetId) = Target switch
    {
        ReleaseCreditTarget releaseTarget => ("release", releaseTarget.ReleaseId.Value),
        TrackCreditTarget trackTarget => ("track", trackTarget.TrackId.Value),
        _ => throw new InvalidOperationException("Credit target type is not supported")
    };

    _identityKey = new CreditIdentity(targetType, targetId, _contributorArtistId.Value, Roles).Key;
}
```

Call `RefreshIdentityKey()` after `SetRoles`, `SetContributor`, and `SetTarget` in constructors and update methods.

- [ ] **Step 5: Add unique DB index**

In `CreditConfiguration`:

```csharp
_ = builder.Property<string>("_identityKey")
    .HasColumnName("identity_key")
    .HasMaxLength(512)
    .IsRequired();

_ = builder.HasIndex(nameof(Credit.CollectionId), "_identityKey")
    .IsUnique()
    .HasDatabaseName("ux_credits_collection_identity");
```

- [ ] **Step 6: Return readable conflict from `/api/credits`**

Catch the unique conflict in create/update and return:

```csharp
return EndpointErrors.Conflict("credit.duplicate", "Credit already exists for this target, contributor and role set");
```

Prefer preflight lookup by `_identityKey` before save so the response is deterministic.

- [ ] **Step 7: Preserve release editor credit merging**

Keep `MergeCredits` in `ReleasesEndpointRouteBuilderExtensions.Credits.cs`; it remains useful because one release form can submit multiple rows for the same artist. The difference is now the general credits endpoint cannot create a second identical persisted fact.

- [ ] **Step 8: Run credit tests**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "CreditEndpointTests|CreditTests|ReleaseEntryWorkflowE2ETests"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/src/DiscWeave.Domain/Credits api/src/DiscWeave.Infrastructure/Persistence/Configurations/CreditConfiguration.cs api/src/DiscWeave.Api/Features/Credits api/src/DiscWeave.Api/Features/Releases api/tests
git commit -m "fix: enforce credit identity"
```

---

## Task 7: Remove Defensive UI Grouping For Invalid Catalog States

**Files:**
- Modify: `app/src/features/labels/LabelsWorkspace.tsx`
- Modify: `app/src/features/releases/releaseFormHelpers.ts`
- Modify: `app/src/features/relations/RelationEntryForm.tsx`
- Modify: `app/src/features/artists/artistRelationshipGroups.ts`
- Modify: `app/src/features/artists/ArtistDetail.tsx`
- Modify tests: `app/src/App.workspaces-labels.test.tsx`, `app/src/App.workspaces-artists.test.tsx`, `app/src/App.workspaces-owned-relations.test.tsx`

- [ ] **Step 1: Update label workspace tests to expect one canonical label**

Replace the duplicate `Big Life` label fixture with one label and two `release.labels` rows pointing at the same id:

```ts
labels: [{ id: 'big-life', name: 'Big Life' }],
releases: [
  {
    id: 'multi-catalog-release',
    title: 'Multiple Catalog Numbers',
    artist: 'Archive Artist',
    type: 'Album',
    year: '1991',
    label: 'Big Life',
    labels: [
      {
        labelId: 'big-life',
        name: 'Big Life',
        catalogNumber: 'BLRDCD 5',
        hasNoCatalogNumber: false,
      },
      {
        labelId: 'big-life',
        name: 'Big Life',
        catalogNumber: '847963. 2',
        hasNoCatalogNumber: false,
      },
    ],
  },
]
```

Delete the test named `blocks unsafe mutations for grouped label rows`.

- [ ] **Step 2: Run the label workspace tests and verify they fail**

Run:

```bash
cd app
npm test -- App.workspaces-labels.test.tsx
```

Expected: FAIL because `LabelsWorkspace` still renders grouped-label copy and summary logic.

- [ ] **Step 3: Remove grouped label summary model**

In `LabelsWorkspace.tsx`, change `LabelSummary` to remove `labelIds`:

```ts
type LabelSummary = LabelRecord & {
  releases: ReleaseRecord[]
  ownedItems: OwnedItemRecord[]
  media: string[]
  statuses: string[]
}
```

Replace `buildLabelSummaries` with direct one-row-per-label mapping:

```ts
function buildLabelSummaries(
  labels: LabelRecord[],
  releases: ReleaseRecord[],
  ownedItems: OwnedItemRecord[],
): LabelSummary[] {
  return labels.map((label) => buildLabelSummary(label, releases, ownedItems))
}
```

Update `buildLabelSummary` to accept one `LabelRecord` and use `releaseHasLabel(release, label)`.

- [ ] **Step 4: Delete grouped label UI copy**

In `LabelDetailPanel`, delete `isGroupedLabel`, the `Grouped label records` badge, and the branch that hides edit/delete. Always render:

```tsx
<span className="badge badge-tag">Editable collection record</span>
<div className="detail-actions">
  <button className="button button-secondary" type="button" onClick={onEdit}>
    Edit record
  </button>
  <DeleteSessionRecordButton
    confirmationMessage={labelDeleteConfirmationMessage()}
    onDelete={onDelete}
  />
</div>
```

- [ ] **Step 5: Make duplicate label form blocking instead of permissive**

Change duplicate warning copy and disable submit through `isValid`:

```ts
const hasDuplicateLabel = duplicateLabel !== undefined
const isValid = name.trim().length > 0 && !hasDuplicateLabel
```

Use copy:

```tsx
This label already exists.
```

- [ ] **Step 6: Remove relation duplicate permissive copy**

In `RelationEntryForm`, use:

```ts
const isValid = sourceName.length > 0 && targetName.length > 0 && !duplicateRelation
```

Change copy to:

```tsx
This relation already exists.
```

- [ ] **Step 7: Keep appearance aggregation only as display aggregation**

Keep `dedupeAppearances` in `ArtistDetail.tsx` because one artist can appear via release-level and track-level credits. Do not use it to hide exact duplicate persisted relations after Task 5; relation lists should render whatever the API returns.

- [ ] **Step 8: Run frontend focused tests**

Run:

```bash
cd app
npm test -- App.workspaces-labels.test.tsx App.workspaces-artists.test.tsx App.workspaces-owned-relations.test.tsx App.release-entry-validation.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/src
git commit -m "fix: remove defensive duplicate catalog UI"
```

---

## Task 8: Update Import, Export, Search, And Graph Contracts Around Canonical Labels

**Files:**
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService*.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportResponseMapper*.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions*.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Search/SearchDocumentBuilder.cs`
- Modify: `api/src/DiscWeave.Api/Features/CatalogGraph/CatalogGraphEndpointRouteBuilderExtensions*.cs`
- Test: import confirmation, export restore, search, graph tests

- [ ] **Step 1: Write import regression expectation**

Add an API test that confirms a loose-file or Discogs import with two catalog numbers for the same label creates one label and two release-label rows:

```csharp
[Fact(DisplayName = "Import confirmation keeps one label record for multiple catalog numbers")]
public async Task Import_confirmation_keeps_one_label_record_for_multiple_catalog_numbers()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();

    Guid draftId = await CreateImportDraftWithLabelsAsync(client,
    [
        new ImportDraftLabel("Big Life", "BLRDCD 5"),
        new ImportDraftLabel("Big Life", "847963. 2")
    ]);

    using HttpResponseMessage response = await client.PostAsync($"/api/imports/import-session-1/drafts/{draftId}/confirm", null);

    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    using HttpResponseMessage labelsResponse = await client.GetAsync("/api/labels?search=Big%20Life&limit=10&offset=0");
    using JsonDocument labelsDocument = await ReadJsonAsync(labelsResponse);
    Assert.Equal(1, labelsDocument.RootElement.GetProperty("total").GetInt32());
}
```

Use existing desktop import helpers in the nearest `DesktopImportLooseFileDraftTests.Helpers.cs` file; if they expose a different session id, use the created session id instead of `import-session-1`.

- [ ] **Step 2: Run import/export/search focused tests**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "DesktopImportLooseFileDraftTests|DesktopImportConfirmationDetailsTests|ExportRestoreEndpointTests|SearchEndpointTests|CatalogGraphNavigationEndpointTests"
```

Expected: failing assertions around duplicate labels or legacy `ReleaseMetadata.LabelId`.

- [ ] **Step 3: Use label keys in import label resolution**

Where import confirmation resolves labels by name, use:

```csharp
string nameKey = LabelName.NormalizeKey(importLabel.Name);
Label? label = await context.Labels.SingleOrDefaultAsync(
    candidate => candidate.CollectionId == collectionId && candidate.NameKey == nameKey,
    cancellationToken);
```

Create `Label.Create(collectionId, LabelId.New(), importLabel.Name)` only when this query returns null.

- [ ] **Step 4: Make export/restore label data round-trip through `labels[]`**

Release export should include all `release.Labels` rows. Restore should create/reuse one `Label` per label id/name and then call:

```csharp
release.UpdateLabels(
    response.NotOnLabel,
    [.. response.Labels.Where(label => label.LabelId.HasValue).Select(ToReleaseLabel)]);
```

No restore path should call `ReleaseMetadata.WithLabel`.

- [ ] **Step 5: Make search and graph read only `Release.Labels`**

In search/graph helper methods, delete fallback code that reads `release.Summary.Metadata.LabelId`. Use:

```csharp
private static IEnumerable<LabelId> ReleaseLabelIds(Release release)
{
    return release.Labels.Select(label => label.LabelId);
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "DesktopImport|ExportRestore|SearchEndpointTests|CatalogGraph"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/src/DiscWeave.Api/Features/Imports api/src/DiscWeave.Api/Features/Exports api/src/DiscWeave.Infrastructure/Persistence/Search api/tests
git commit -m "fix: align import and export with canonical labels"
```

---

## Task 9: Full Verification And Desktop Rebuild

**Files:**
- No source files unless verification exposes a defect.

- [ ] **Step 1: Run API format, build, and tests**

Run:

```bash
cd api
dotnet format DiscWeave.slnx --verify-no-changes
dotnet build DiscWeave.slnx --no-restore
dotnet test DiscWeave.slnx --no-build
```

Expected: all commands pass.

- [ ] **Step 2: Run app checks**

Run:

```bash
cd app
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Build desktop package for manual validation**

Run the existing desktop build command from `app/package.json`. If the script names are unchanged:

```bash
cd app
npm run desktop:pack
```

Expected: Electron package completes and produces the local desktop artifact under the configured `dist` output directory.

- [ ] **Step 4: Manual validation checklist**

Validate in the desktop app:

```text
1. Import the Orb folder with two Big Life catalog numbers.
2. Confirm the draft.
3. Open Releases and verify the release row shows Big Life once and both catalog numbers.
4. Open Labels and verify Big Life appears once.
5. Open the Big Life detail panel and verify edit/delete controls are available because the row is a real label record, not a grouped defensive row.
6. Try to create another Big Life label with different casing or extra spaces; the form or API must reject it.
7. Try to create a duplicate relation; the form or API must reject it with a readable message.
8. Try to create a duplicate credit through the credits endpoint; the API must reject it with `credit.duplicate`.
```

- [ ] **Step 5: Commit verification fixes**

If verification required fixes:

```bash
git add api app
git commit -m "fix: complete catalog integrity verification"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

**Spec coverage:** The plan covers all audited model holes: label identity, release label source of truth, duplicate release-label rows, duplicate relations, duplicate credits, defensive UI cleanup, and SQLite updater reset.

**Placeholder scan:** The plan avoids deferred placeholders and gives concrete file paths, test names, commands, expected outcomes, and representative code for each model change.

**Type consistency:** New identity concepts are named consistently: `NameKey` for labels, `ReleaseLabelKey` for release-label rows, `ArtistRelationIdentity`, `TrackRelationIdentity`, and `CreditIdentity`.
