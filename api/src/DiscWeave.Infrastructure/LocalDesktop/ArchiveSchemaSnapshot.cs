using System.Globalization;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.LocalDesktop;

internal static class ArchiveSchemaSnapshot
{
    internal const string LinkTable = "label_import_session_links";
    internal const string LedgerTable = "archive_schema_upgrades";

    public static async Task<Dictionary<string, string>> ReadAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var schema = new Dictionary<string, string>(StringComparer.Ordinal);
        List<string[]> objects = await RowsAsync(connection,
            "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name", cancellationToken);
        foreach (string[] item in objects.Where(item => item[0] != "index"))
        {
            if (item[0] != "table")
            {
                schema.Add($"{item[0]}:{item[1]}", item[2]);
                continue;
            }

            string table = Quote(item[1]);
            List<string[]> columns = await RowsAsync(connection, $"PRAGMA table_xinfo({table})", cancellationToken);
            List<string[]> keys = await RowsAsync(connection, $"PRAGMA foreign_key_list({table})", cancellationToken);
            List<string[]> indexes = await RowsAsync(connection, $"PRAGMA index_list({table})", cancellationToken);
            var indexDetails = new List<string>();
            foreach (string[] index in indexes)
            {
                List<string[]> fields = await RowsAsync(connection, $"PRAGMA index_xinfo({Quote(index[1])})", cancellationToken);
                string definition = objects.Find(value => value[0] == "index" && value[1] == index[1])?[2] ?? string.Empty;
                string normalizedDefinition = NormalizeSql(definition);
                int where = normalizedDefinition.IndexOf("WHERE", StringComparison.Ordinal);
                indexDetails.Add(JsonSerializer.Serialize(new
                {
                    Unique = index[2],
                    Origin = index[3],
                    Partial = index[4],
                    Fields = fields.Select(value => new[] { value[0], value[2], value[3], value[4], value[5] }),
                    Predicate = where < 0 ? string.Empty : normalizedDefinition[where..],
                }));
            }

            string normalized = NormalizeSql(item[2]);
            schema.Add(item[1], JsonSerializer.Serialize(new
            {
                Columns = columns.Select(value => value.Skip(1).ToArray()).OrderBy(value => value[0], StringComparer.Ordinal),
                Keys = keys.GroupBy(value => value[0]).Select(group => JsonSerializer.Serialize(group.OrderBy(value => int.Parse(value[1], CultureInfo.InvariantCulture)).Select(value => value.Skip(1)))).Order(StringComparer.Ordinal),
                Indexes = indexDetails.Order(StringComparer.Ordinal),
                Checks = ExtractChecks(normalized),
                AutoIncrement = normalized.Contains("AUTOINCREMENT", StringComparison.Ordinal),
                WithoutRowId = normalized.Contains("WITHOUTROWID", StringComparison.Ordinal),
                Strict = normalized.EndsWith("STRICT", StringComparison.Ordinal),
                Deferred = normalized.Contains("DEFERRABLE", StringComparison.Ordinal),
                Virtual = normalized.StartsWith("CREATEVIRTUAL", StringComparison.Ordinal),
                CollationClauses = normalized.Contains("COLLATE", StringComparison.Ordinal),
                ConflictClauses = normalized.Contains("ONCONFLICT", StringComparison.Ordinal),
            }));
        }

        return schema;
    }

    private static List<string> ExtractChecks(string sql)
    {
        var result = new List<string>();
        int start = 0;
        while ((start = sql.IndexOf("CHECK(", start, StringComparison.Ordinal)) >= 0)
        {
            int depth = 1;
            int end = start + 6;
            bool quoted = false;
            for (; end < sql.Length && depth > 0; end++)
            {
                if (sql[end] == '\'')
                {
                    if (quoted && end + 1 < sql.Length && sql[end + 1] == '\'')
                    {
                        end++;
                    }
                    else
                    {
                        quoted = !quoted;
                    }
                }
                else if (!quoted && sql[end] == '(')
                {
                    depth++;
                }
                else if (!quoted && sql[end] == ')')
                {
                    depth--;
                }
            }

            result.Add(sql[start..end]);
            start = end;
        }

        result.Sort(StringComparer.Ordinal);
        return result;
    }

    private static string NormalizeSql(string sql)
    {
        var result = new System.Text.StringBuilder();
        bool quoted = false;
        foreach (char character in sql)
        {
            if (character == '\'')
            {
                quoted = !quoted;
                _ = result.Append(character);
            }
            else if (quoted || (!char.IsWhiteSpace(character) && character != '"' && character != ';'))
            {
                _ = result.Append(quoted ? character : char.ToUpperInvariant(character));
            }
        }

        return result.ToString();
    }

    internal static string Quote(string identifier)
    {
        return "\"" + identifier.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
    }

    internal static async Task<List<string[]>> RowsAsync(SqliteConnection connection, string sql, CancellationToken cancellationToken)
    {
        using SqliteCommand command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = 5;
        await using SqliteDataReader reader = await command.ExecuteReaderAsync(cancellationToken);
        var rows = new List<string[]>();
        while (await reader.ReadAsync(cancellationToken))
        {
            string[] row = new string[reader.FieldCount];
            for (int index = 0; index < row.Length; index++)
            {
                row[index] = reader.IsDBNull(index) ? "<null>" : Convert.ToString(reader.GetValue(index), CultureInfo.InvariantCulture) ?? string.Empty;
            }

            rows.Add(row);
        }

        return rows;
    }
}
