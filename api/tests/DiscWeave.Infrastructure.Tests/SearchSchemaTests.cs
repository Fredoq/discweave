using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class SearchSchemaTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public SearchSchemaTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Search schema has SQLite indexes for filter facets")]
    public async Task Search_schema_has_sqlite_indexes_for_filter_facets()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync();

        string[] indexes = [.. await ReadIndexNamesAsync(context, "search_documents")];

        Assert.Contains("ix_search_documents_role_facet", indexes);
        Assert.Contains("ix_search_documents_media_facet", indexes);
        Assert.Contains("ix_search_documents_status_facet", indexes);
        Assert.Contains("ix_search_documents_tag_facet", indexes);
        Assert.Contains("ix_search_documents_label_id_facet", indexes);
        Assert.Contains("ix_search_documents_collector_signal_facet", indexes);
    }

    private static async Task<IReadOnlyList<string>> ReadIndexNamesAsync(DiscWeaveDbContext context, string tableName)
    {
        FormattableString sql = $"""
            SELECT name AS "Value"
            FROM sqlite_master
            WHERE type = 'index'
              AND tbl_name = {tableName}
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
