using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class SqliteSchemaUpgraderTests
{
    private static async Task<IReadOnlyList<string>> ReadColumnNamesAsync(
        SqliteConnection connection,
        string tableName)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName});";
        await using SqliteDataReader reader = await command.ExecuteReaderAsync();
        List<string> columns = [];
        while (await reader.ReadAsync())
        {
            columns.Add(reader.GetString(1));
        }

        return columns;
    }

    private static async Task<bool> IndexExistsAsync(SqliteConnection connection, string indexName)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = $indexName;";
        _ = command.Parameters.AddWithValue("$indexName", indexName);

        return await command.ExecuteScalarAsync() is not null;
    }

    private static async Task<string> ReadCreateTableSqlAsync(SqliteConnection connection, string tableName)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = $tableName;";
        _ = command.Parameters.AddWithValue("$tableName", tableName);

        return Assert.IsType<string>(await command.ExecuteScalarAsync());
    }
}
