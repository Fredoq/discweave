using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class ExternalSourcePersistenceTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "SQLite schema creation creates external source provenance tables")]
    public async Task Sqlite_schema_creation_creates_external_source_provenance_tables()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync();

        string[] tableNames = [.. await ReadTableNamesAsync(context)];
        string[] releaseExternalSourceColumns = [.. await ReadColumnNamesAsync(context, "release_external_sources")];

        Assert.Contains("artist_external_sources", tableNames);
        Assert.Contains("release_external_sources", tableNames);
        Assert.Contains("track_external_sources", tableNames);
        Assert.Contains("provider_name", releaseExternalSourceColumns);
        Assert.Contains("resource_type", releaseExternalSourceColumns);
        Assert.Contains("external_id", releaseExternalSourceColumns);
        Assert.Contains("source_url", releaseExternalSourceColumns);
        Assert.Contains("applied_at", releaseExternalSourceColumns);
        Assert.Contains("collection_id", releaseExternalSourceColumns);
        Assert.Contains("release_id", releaseExternalSourceColumns);
    }

    [Fact(DisplayName = "External source references persist with catalog records")]
    public async Task External_source_references_persist_with_catalog_records()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync();
        var collectionId = CollectionId.New();
        await TestCollectionFactory.AddCollectionAsync(context, collectionId);
        var artist = Group.Create(collectionId, ArtistId.New(), "New Order");
        var release = Release.Create(collectionId, ReleaseId.New(), "Blue Monday");
        var track = Track.Create(collectionId, TrackId.New(), "Blue Monday");
        artist.ReplaceExternalSources([ExternalSource("artist", "5876")]);
        release.ReplaceExternalSources([ExternalSource("release", "249504")]);
        track.ReplaceExternalSources([ExternalSource("track", "249504-A")]);

        _ = context.Artists.Add(artist);
        _ = context.Releases.Add(release);
        _ = context.Tracks.Add(track);
        _ = await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        Artist actualArtist = await context.Artists.SingleAsync(entity => entity.Id == artist.Id);
        Release actualRelease = await context.Releases.SingleAsync(entity => entity.Id == release.Id);
        Track actualTrack = await context.Tracks.SingleAsync(entity => entity.Id == track.Id);

        ExternalSourceReference actualArtistSource = Assert.Single(actualArtist.ExternalSources);
        Assert.Equal("discogs", actualArtistSource.ProviderName);
        Assert.Equal("artist", actualArtistSource.ResourceType);
        Assert.Equal("5876", actualArtistSource.ExternalId);
        Assert.Equal("https://www.discogs.com/artist/5876", actualArtistSource.SourceUrl);
        Assert.Equal(new DateTimeOffset(2026, 5, 31, 12, 0, 0, TimeSpan.Zero), actualArtistSource.AppliedAt);

        Assert.Equal("249504", Assert.Single(actualRelease.ExternalSources).ExternalId);
        Assert.Equal("249504-A", Assert.Single(actualTrack.ExternalSources).ExternalId);
    }

    private static ExternalSourceReference ExternalSource(string resourceType, string externalId)
    {
        return ExternalSourceReference.Create(
            "discogs",
            resourceType,
            externalId,
            $"https://www.discogs.com/{resourceType}/{externalId}",
            new DateTimeOffset(2026, 5, 31, 12, 0, 0, TimeSpan.Zero));
    }

    private static async Task<IReadOnlyList<string>> ReadColumnNamesAsync(DiscWeaveDbContext context, string tableName)
    {
        FormattableString sql = $"""
            SELECT name AS "Value"
            FROM pragma_table_info({tableName})
            ORDER BY cid
            """;

        return await context.Database.SqlQuery<string>(sql).ToArrayAsync();
    }

    private static async Task<IReadOnlyList<string>> ReadTableNamesAsync(DiscWeaveDbContext context)
    {
        FormattableString sql = $"""
            SELECT name AS "Value"
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name
            """;

        return await context.Database.SqlQuery<string>(sql).ToArrayAsync();
    }

    private async Task<DiscWeaveDbContext> CreateInitializedContextAsync()
    {
        string connectionString = await sqlite.CreateDatabaseAsync();
        var context = new DiscWeaveDbContext(CreateOptions(connectionString));
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
