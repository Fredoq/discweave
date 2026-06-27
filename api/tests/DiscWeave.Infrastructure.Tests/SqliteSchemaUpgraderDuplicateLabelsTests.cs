using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class SqliteSchemaUpgraderDuplicateLabelsTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "SQLite schema upgrade merges duplicate labels by normalized name")]
    public async Task Sqlite_schema_upgrade_merges_duplicate_labels_by_normalized_name()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync();
        var collectionId = CollectionId.New();
        await TestCollectionFactory.AddCollectionAsync(context, collectionId);
        var canonicalLabelId = LabelId.New();
        var duplicateLabelId = LabelId.New();
        Release release = Release.Create(collectionId, ReleaseId.New(), "Two Number Release")
            .WithSummary(
                ReleaseSummary.Create("Two Number Release")
                    .WithMetadata(ReleaseMetadata.Empty.WithType(ReleaseType.Album).WithLabel(duplicateLabelId)));
        release.UpdateLabels(false,
        [
            ReleaseLabel.Create(canonicalLabelId, Optional.From("ONE"), false),
            ReleaseLabel.Create(duplicateLabelId, Optional.From("TWO"), false)
        ]);

        _ = context.Labels.Add(Label.Create(collectionId, canonicalLabelId, "Big Life"));
        _ = context.Labels.Add(Label.Create(collectionId, duplicateLabelId, " big life "));
        _ = context.Releases.Add(release);
        _ = await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        await SqliteSchemaUpgrader.EnsureDuplicateLabelsMergedByNormalizedNameAsync(context.Database.GetDbConnection());
        context.ChangeTracker.Clear();

        Label label = await context.Labels.SingleAsync(entity => entity.CollectionId == collectionId);
        Release upgradedRelease = await context.Releases.SingleAsync(entity => entity.Id == release.Id);

        Assert.Equal(canonicalLabelId, label.Id);
        Assert.Equal(canonicalLabelId, Assert.IsType<PresentOptionalValue<LabelId>>(upgradedRelease.Summary.Metadata.LabelId).Value);
        Assert.Equal(2, upgradedRelease.Labels.Count);
        Assert.All(upgradedRelease.Labels, releaseLabel => Assert.Equal(canonicalLabelId, releaseLabel.LabelId));
        Assert.Contains(upgradedRelease.Labels, releaseLabel => releaseLabel.CatalogNumber.Match(value => value == "ONE", () => false));
        Assert.Contains(upgradedRelease.Labels, releaseLabel => releaseLabel.CatalogNumber.Match(value => value == "TWO", () => false));
    }

    private async Task<DiscWeaveDbContext> CreateInitializedContextAsync()
    {
        string connectionString = await sqlite.CreateDatabaseAsync();
        DiscWeaveDbContext context = new(CreateOptions(connectionString));
        _ = await context.Database.EnsureCreatedAsync();

        return context;
    }

    private static DbContextOptions<DiscWeaveDbContext> CreateOptions(string connectionString)
    {
        return new DbContextOptionsBuilder<DiscWeaveDbContext>()
            .UseSqlite(connectionString)
            .Options;
    }
}
