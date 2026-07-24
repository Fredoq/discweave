using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscWeaveDbContextTests
{
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
        string connectionString = await _sqlite.CreateDatabaseAsync();
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
