using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Persistence;

internal static class RelationalPersistenceErrors
{
    private const string RatingValueTargetUniqueIndexPrefix = "IX_rating_values_collection_id_criterion_id_target_type_targe";
    private const int SqliteConstraintErrorCode = 19;
    private const int SqliteConstraintForeignKeyExtendedErrorCode = 787;
    private const int SqliteConstraintUniqueExtendedErrorCode = 2067;

    public static bool IsReferencedResourceMissing(DbUpdateException exception)
    {
        ArgumentNullException.ThrowIfNull(exception);

        return FindSqliteException(exception)?.SqliteExtendedErrorCode == SqliteConstraintForeignKeyExtendedErrorCode &&
            exception.Entries.Any(entry => entry.State is EntityState.Added or EntityState.Modified);
    }

    public static bool IsUniqueConstraintViolation(DbUpdateException exception, string constraintName)
    {
        ArgumentNullException.ThrowIfNull(exception);

        SqliteException? sqliteException = FindSqliteException(exception);

        return sqliteException?.SqliteExtendedErrorCode == SqliteConstraintUniqueExtendedErrorCode &&
            IsSqliteUniqueConstraint(exception, constraintName);
    }

    public static bool IsRatingValueTargetConflict(DbUpdateException exception)
    {
        ArgumentNullException.ThrowIfNull(exception);

        SqliteException? sqliteException = FindSqliteException(exception);

        string message = exception.ToString();
        return sqliteException?.SqliteExtendedErrorCode == SqliteConstraintUniqueExtendedErrorCode &&
            (message.Contains(RatingValueTargetUniqueIndexPrefix, StringComparison.OrdinalIgnoreCase) ||
                (message.Contains("rating_values.collection_id", StringComparison.OrdinalIgnoreCase) &&
                    message.Contains("rating_values.criterion_id", StringComparison.OrdinalIgnoreCase) &&
                    message.Contains("rating_values.target_type", StringComparison.OrdinalIgnoreCase)));
    }

    public static bool IsResourceHasDependents(DbUpdateException exception)
    {
        ArgumentNullException.ThrowIfNull(exception);

        return FindSqliteException(exception)?.SqliteExtendedErrorCode == SqliteConstraintForeignKeyExtendedErrorCode &&
            exception.Entries.Any(entry => entry.State == EntityState.Deleted);
    }

    public static bool IsIntegrityConstraintViolation(DbUpdateException exception)
    {
        ArgumentNullException.ThrowIfNull(exception);

        return FindSqliteException(exception)?.SqliteErrorCode == SqliteConstraintErrorCode;
    }

    private static SqliteException? FindSqliteException(DbUpdateException exception)
    {
        ArgumentNullException.ThrowIfNull(exception);

        Exception? current = exception;
        while (current is not null)
        {
            if (current is SqliteException sqliteException)
            {
                return sqliteException;
            }

            current = current.InnerException;
        }

        return null;
    }

    private static bool IsSqliteUniqueConstraint(DbUpdateException exception, string constraintName)
    {
        string message = exception.ToString();
        return constraintName switch
        {
            "IX_rating_criteria_collection_id_code" =>
                message.Contains("rating_criteria.collection_id", StringComparison.OrdinalIgnoreCase) &&
                message.Contains("rating_criteria.code", StringComparison.OrdinalIgnoreCase),
            _ => message.Contains(constraintName, StringComparison.OrdinalIgnoreCase)
        };
    }
}
