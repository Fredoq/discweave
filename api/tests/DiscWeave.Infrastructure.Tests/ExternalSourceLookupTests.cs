using DiscWeave.Application.Catalog;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using DiscWeave.Infrastructure.Persistence.Queries;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DiscWeave.Infrastructure.Tests;

public sealed class ExternalSourceLookupTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "External source lookup unions matching releases within one collection")]
    public async Task External_source_lookup_unions_matching_releases_within_one_collection()
    {
        string connectionString = await sqlite.CreateDatabaseAsync();
        var collectionId = CollectionId.New();
        var otherCollectionId = CollectionId.New();
        var matchedReleaseId = ReleaseId.New();
        var otherMatchedReleaseId = ReleaseId.New();

        await using (DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString))
        {
            await TestCollectionFactory.AddCollectionAsync(context, collectionId);
            await TestCollectionFactory.AddCollectionAsync(context, otherCollectionId);
            var matched = Release.Create(collectionId, matchedReleaseId, "Blue Monday");
            matched.ReplaceExternalSources(
            [
                Source("musicbrainz", "release", "11111111-1111-1111-1111-111111111111"),
                Source("discogs", "release", "249504")
            ]);
            var otherMatched = Release.Create(collectionId, otherMatchedReleaseId, "Blue Monday (Other)");
            otherMatched.ReplaceExternalSources([Source("discogs", "release", "249504")]);
            var foreign = Release.Create(otherCollectionId, ReleaseId.New(), "Foreign");
            foreign.ReplaceExternalSources([Source("musicbrainz", "release", "11111111-1111-1111-1111-111111111111")]);
            context.Releases.AddRange(matched, otherMatched, foreign);
            _ = await context.SaveChangesAsync();
        }

        await using DiscWeaveDbContext readContext = new(CreateOptions(connectionString));
        var lookup = new ExternalSourceLookup(readContext);
        IReadOnlyList<Release> releases = await lookup.FindReleasesAsync(
            collectionId,
            [
                ExternalSourceLookupIdentity.Create(" DISCOGS ", " RELEASE ", "249504"),
                ExternalSourceLookupIdentity.Create("musicbrainz", "release", "11111111-1111-1111-1111-111111111111")
            ],
            CancellationToken.None);

        Assert.Equal(
            new[] { matchedReleaseId.Value, otherMatchedReleaseId.Value }.OrderBy(id => id),
            releases.Select(release => release.Id.Value));
        Assert.DoesNotContain(releases, release => release.CollectionId == otherCollectionId);
    }

    [Fact(DisplayName = "External source lookup unions matching tracks and orders by local ID")]
    public async Task External_source_lookup_unions_matching_tracks_and_orders_by_local_id()
    {
        string connectionString = await sqlite.CreateDatabaseAsync();
        var collectionId = CollectionId.New();
        var firstTrackId = TrackId.New();
        var secondTrackId = TrackId.New();
        await using (DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString))
        {
            await TestCollectionFactory.AddCollectionAsync(context, collectionId);
            var first = Track.Create(collectionId, firstTrackId, "Blue Monday");
            first.ReplaceExternalSources([Source("musicbrainz", "recording", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")]);
            var second = Track.Create(collectionId, secondTrackId, "Blue Monday");
            second.ReplaceExternalSources([Source("musicbrainz", "track", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")]);
            context.Tracks.AddRange(first, second);
            _ = await context.SaveChangesAsync();
        }

        await using DiscWeaveDbContext readContext = new(CreateOptions(connectionString));
        var lookup = new ExternalSourceLookup(readContext);
        IReadOnlyList<Track> tracks = await lookup.FindTracksAsync(
            collectionId,
            [
                ExternalSourceLookupIdentity.Create("musicbrainz", "track", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                ExternalSourceLookupIdentity.Create("musicbrainz", "recording", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
            ],
            CancellationToken.None);

        Assert.Equal(
            new[] { firstTrackId.Value, secondTrackId.Value }.OrderBy(id => id),
            tracks.Select(track => track.Id.Value));
    }

    [Fact(DisplayName = "External source lookup returns no aggregates for empty identities")]
    public async Task External_source_lookup_returns_no_aggregates_for_empty_identities()
    {
        string connectionString = await sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);

        var lookup = new ExternalSourceLookup(context);
        Assert.Empty(await lookup.FindReleasesAsync(CollectionId.New(), [], CancellationToken.None));
        Assert.Empty(await lookup.FindTracksAsync(CollectionId.New(), [], CancellationToken.None));
    }

    [Fact(DisplayName = "External source lookup indexes are collection scoped and non unique")]
    public async Task External_source_lookup_indexes_are_collection_scoped_and_non_unique()
    {
        string connectionString = await sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);

        foreach (string tableName in new[] { "release_external_sources", "track_external_sources" })
        {
            IEntityType sourceType = Assert.Single(
                context.Model.GetEntityTypes(),
                type => type.ClrType == typeof(ExternalSourceReference) && type.GetTableName() == tableName);
            Assert.Contains(
                sourceType.GetIndexes(),
                index => !index.IsUnique &&
                    index.Properties.Select(property => property.Name).SequenceEqual(
                    ["CollectionId", "ProviderName", "ResourceType", "ExternalId"]));
        }
    }

    [Theory(DisplayName = "External source lookup identities reject malformed provider codes")]
    [InlineData("", "release", "1")]
    [InlineData("1discogs", "release", "1")]
    [InlineData("discogs", "release/row", "1")]
    [InlineData("discogs", "release", "")]
    public void External_source_lookup_identities_reject_malformed_provider_codes(
        string providerCode,
        string resourceType,
        string externalId)
    {
        DomainException exception = Assert.Throws<DomainException>(() =>
            ExternalSourceLookupIdentity.Create(providerCode, resourceType, externalId));

        Assert.Equal("external_source.lookup_identity_invalid", exception.Code);
    }

    private static ExternalSourceReference Source(string providerCode, string resourceType, string externalId)
    {
        return ExternalSourceReference.Create(
            providerCode,
            resourceType,
            externalId,
            $"https://example.test/{resourceType}/{externalId}",
            new DateTimeOffset(2026, 6, 1, 12, 0, 0, TimeSpan.Zero));
    }

    private static async Task<DiscWeaveDbContext> CreateInitializedContextAsync(string connectionString)
    {
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
