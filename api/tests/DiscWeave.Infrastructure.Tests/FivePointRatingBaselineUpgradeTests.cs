using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class FivePointRatingBaselineUpgradeTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public FivePointRatingBaselineUpgradeTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "The one-time upgrade script converts a ten-point archive to five-point ratings with standouts")]
    public async Task The_one_time_upgrade_script_converts_a_ten_point_archive_to_five_point_ratings_with_standouts()
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
        string script = await File.ReadAllTextAsync(FindUpgradeScript());
        _ = await context.Database.ExecuteSqlRawAsync(script);
        SqliteException secondRun = await Assert.ThrowsAsync<SqliteException>(() => context.Database.ExecuteSqlRawAsync(script));
        _ = await context.Database.ExecuteSqlRawAsync("ROLLBACK");

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
        Assert.Contains("duplicate column", secondRun.Message, StringComparison.Ordinal);
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
    }

    private static string FindUpgradeScript()
    {
        DirectoryInfo? directory = new(AppContext.BaseDirectory);
        while (directory is not null)
        {
            string candidate = Path.Combine(directory.FullName, "docs", "backup", "upgrade-ratings-to-five-point.sql");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new FileNotFoundException("The five-point rating upgrade script was not found");
    }

    private static DbContextOptions<DiscWeaveDbContext> CreateOptions(string connectionString)
    {
        return new DbContextOptionsBuilder<DiscWeaveDbContext>()
            .UseSqlite(connectionString)
            .Options;
    }
}
