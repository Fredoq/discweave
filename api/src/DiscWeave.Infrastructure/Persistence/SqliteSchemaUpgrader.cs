using System.Data.Common;
using System.Globalization;
using DiscWeave.Domain.Ratings;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DiscWeave.Infrastructure.Persistence;

/// <summary>
/// Upgrades an existing SQLite archive in place. <c>EnsureCreated</c> only creates a missing schema,
/// so each schema change after the baseline is an append-only step tracked by <c>PRAGMA user_version</c>.
/// </summary>
public static class SqliteSchemaUpgrader
{
    public const int CurrentVersion = 1;

    public static async Task InitializeAsync(DiscWeaveDbContext context, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);

        bool created = await context.Database.EnsureCreatedAsync(cancellationToken);
        if (created)
        {
            await SetVersionAsync(context, CurrentVersion, cancellationToken);
            return;
        }

        int version = await ReadVersionAsync(context, cancellationToken);
        if (version >= CurrentVersion)
        {
            return;
        }

        await BackupAsync(context, version, cancellationToken);
        await using IDbContextTransaction transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await UpgradeToFivePointRatingsAsync(context, cancellationToken);
        await SetVersionAsync(context, CurrentVersion, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>
    /// Version 1: five-point ratings with a standout flag, and per-criterion artist average roles.
    /// </summary>
    private static async Task UpgradeToFivePointRatingsAsync(DiscWeaveDbContext context, CancellationToken cancellationToken)
    {
        if (!await ColumnExistsAsync(context, "rating_criteria", "artist_average_roles", cancellationToken))
        {
            // ADD COLUMN only accepts a constant default, so the newline-separated default is written afterwards.
            _ = await context.Database.ExecuteSqlRawAsync(
                "ALTER TABLE rating_criteria ADD COLUMN artist_average_roles TEXT NOT NULL DEFAULT ''",
                cancellationToken);
            _ = await context.Database.ExecuteSqlRawAsync(
                "UPDATE rating_criteria SET artist_average_roles = {0}",
                [RatingCriterionDefaults.ArtistAverageRoleCodes],
                cancellationToken);
        }

        // A present standout column means the ratings were already converted.
        if (await ColumnExistsAsync(context, "rating_values", "is_standout", cancellationToken))
        {
            return;
        }

        _ = await context.Database.ExecuteSqlRawAsync(
            "ALTER TABLE rating_values ADD COLUMN is_standout INTEGER NOT NULL DEFAULT 0",
            cancellationToken);
        _ = await context.Database.ExecuteSqlRawAsync(
            $"""
            UPDATE rating_values
            SET is_standout = CASE WHEN rating >= {LegacyRatingScale.Maximum} THEN 1 ELSE 0 END,
                rating = CASE
                    WHEN rating >= {LegacyRatingScale.Maximum} THEN {Rating.Maximum}
                    WHEN rating <= 5 THEN {Rating.Minimum}
                    ELSE rating - 4
                END
            """,
            cancellationToken);
    }

    private static async Task BackupAsync(DiscWeaveDbContext context, int version, CancellationToken cancellationToken)
    {
        string dataSource = new SqliteConnectionStringBuilder(context.Database.GetConnectionString()).DataSource;
        if (string.IsNullOrWhiteSpace(dataSource) || dataSource.Contains(":memory:", StringComparison.Ordinal))
        {
            return;
        }

        string backupPath = string.Create(CultureInfo.InvariantCulture, $"{Path.GetFullPath(dataSource)}.schema-v{version}.bak");
        if (File.Exists(backupPath))
        {
            return;
        }

        _ = await context.Database.ExecuteSqlRawAsync("VACUUM INTO {0}", [backupPath], cancellationToken);
    }

    private static async Task<bool> ColumnExistsAsync(
        DiscWeaveDbContext context,
        string table,
        string column,
        CancellationToken cancellationToken)
    {
        long count = await ScalarAsync(
            context,
            $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = '{column}'",
            cancellationToken);

        return count > 0;
    }

    private static async Task<int> ReadVersionAsync(DiscWeaveDbContext context, CancellationToken cancellationToken)
    {
        return (int)await ScalarAsync(context, "PRAGMA user_version", cancellationToken);
    }

    private static async Task SetVersionAsync(DiscWeaveDbContext context, int version, CancellationToken cancellationToken)
    {
        // PRAGMA does not accept parameters; the value is a compile-time integer.
        _ = await context.Database.ExecuteSqlRawAsync(
            string.Create(CultureInfo.InvariantCulture, $"PRAGMA user_version = {version}"),
            cancellationToken);
    }

    private static async Task<long> ScalarAsync(DiscWeaveDbContext context, string sql, CancellationToken cancellationToken)
    {
        DbConnection connection = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync(cancellationToken);
        await using DbCommand command = connection.CreateCommand();
        command.CommandText = sql;
        command.Transaction = context.Database.CurrentTransaction?.GetDbTransaction();
        object? result = await command.ExecuteScalarAsync(cancellationToken);

        return Convert.ToInt64(result, CultureInfo.InvariantCulture);
    }
}
