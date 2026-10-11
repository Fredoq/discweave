using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class SqliteSchemaUpgraderTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public SqliteSchemaUpgraderTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "A new database starts at the current schema version")]
    public async Task A_new_database_starts_at_the_current_schema_version()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = new(CreateOptions(connectionString));

        await SqliteSchemaUpgrader.InitializeAsync(context);

        Assert.Equal(SqliteSchemaUpgrader.CurrentVersion, await ReadUserVersionAsync(context));
        Assert.False(File.Exists(BackupPath(connectionString)));
    }

    [Fact(DisplayName = "A ten-point archive upgrades in place to five-point ratings with standouts")]
    public async Task A_ten_point_archive_upgrades_in_place_to_five_point_ratings_with_standouts()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        var collectionId = CollectionId.New();
        Dictionary<int, TrackId> trackIdsByLegacyRating = [];
        await using (DiscWeaveDbContext legacy = new(CreateOptions(connectionString)))
        {
            _ = await legacy.Database.EnsureCreatedAsync();
            await TestCollectionFactory.AddCollectionAsync(legacy, collectionId);
            RatingCriterion criterion = await legacy.RatingCriteria.SingleAsync(entity => entity.CollectionId == collectionId);
            foreach (int legacyRating in Enumerable.Range(1, 10))
            {
                var track = Track.Create(collectionId, TrackId.New(), $"Track rated {legacyRating}");
                trackIdsByLegacyRating[legacyRating] = track.Id;
                _ = legacy.Tracks.Add(track);
                _ = legacy.RatingValues.Add(RatingValue.Create(
                    collectionId,
                    RatingValueId.New(),
                    criterion.Id,
                    RatingTarget.ForTrack(track.Id),
                    Rating.FromValue(1)));
            }

            _ = await legacy.SaveChangesAsync();
            await DowngradeToTenPointSchemaAsync(legacy, trackIdsByLegacyRating);
        }

        SqliteConnection.ClearAllPools();
        await using DiscWeaveDbContext context = new(CreateOptions(connectionString));
        await SqliteSchemaUpgrader.InitializeAsync(context);
        await SqliteSchemaUpgrader.InitializeAsync(context);

        Dictionary<TrackId, RatingValue> ratings = (await context.RatingValues.AsNoTracking().ToArrayAsync())
            .ToDictionary(value => ((TrackRatingTarget)value.Target).TrackId);
        RatingCriterion upgradedCriterion = await context.RatingCriteria.AsNoTracking().SingleAsync(entity => entity.CollectionId == collectionId);
        Assert.All(trackIdsByLegacyRating, pair =>
        {
            (int expected, bool expectedStandout) = LegacyRatingScale.Convert(pair.Key);
            Assert.Equal(expected, ratings[pair.Value].Rating.Value);
            Assert.Equal(expectedStandout, ratings[pair.Value].IsStandout);
        });
        Assert.Equal(["mainArtist", "remixer"], upgradedCriterion.ArtistAverageRoles);
        Assert.Equal(SqliteSchemaUpgrader.CurrentVersion, await ReadUserVersionAsync(context));
        Assert.True(File.Exists(BackupPath(connectionString)));
    }

    private static async Task DowngradeToTenPointSchemaAsync(DiscWeaveDbContext context, Dictionary<int, TrackId> trackIdsByLegacyRating)
    {
        foreach ((int legacyRating, TrackId trackId) in trackIdsByLegacyRating)
        {
            _ = await context.Database.ExecuteSqlAsync(
                $"UPDATE rating_values SET rating = {legacyRating} WHERE target_track_id = {trackId.Value}");
        }

        _ = await context.Database.ExecuteSqlRawAsync("ALTER TABLE rating_values DROP COLUMN is_standout");
        _ = await context.Database.ExecuteSqlRawAsync("ALTER TABLE rating_criteria DROP COLUMN artist_average_roles");
        _ = await context.Database.ExecuteSqlRawAsync("PRAGMA user_version = 0");
    }

    private static async Task<int> ReadUserVersionAsync(DiscWeaveDbContext context)
    {
        return await context.Database.SqlQueryRaw<int>("SELECT user_version AS \"Value\" FROM pragma_user_version").SingleAsync();
    }

    private static string BackupPath(string connectionString)
    {
        return $"{new SqliteConnectionStringBuilder(connectionString).DataSource}.schema-v0.bak";
    }

    private static DbContextOptions<DiscWeaveDbContext> CreateOptions(string connectionString)
    {
        return new DbContextOptionsBuilder<DiscWeaveDbContext>()
            .UseSqlite(connectionString)
            .Options;
    }
}
