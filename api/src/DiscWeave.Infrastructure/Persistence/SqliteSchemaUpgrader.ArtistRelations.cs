using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    public static async Task EnsureArtistRelationAliasOfSchemaAsync(
        DbConnection connection,
        CancellationToken cancellationToken = default)
    {
        bool shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await RunOnceAsync(
                connection,
                "artist_relations.alias_to_alias_of",
                """
                UPDATE artist_relations
                SET type = 'aliasOf'
                WHERE type = 'alias';

                DELETE FROM collection_dictionary_entries
                WHERE kind = 'ArtistRelationType'
                    AND code = 'alias'
                    AND EXISTS (
                        SELECT 1
                        FROM collection_dictionary_entries existing
                        WHERE existing.collection_id = collection_dictionary_entries.collection_id
                            AND existing.kind = 'ArtistRelationType'
                            AND existing.code = 'aliasOf'
                    );

                UPDATE collection_dictionary_entries
                SET code = 'aliasOf', name = 'Alias of'
                WHERE kind = 'ArtistRelationType' AND code = 'alias';
                """,
                cancellationToken);

            await EnsureIndexAsync(
                connection,
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ux_artist_relations_collection_source_alias_of
                ON artist_relations (collection_id, source_artist_id, type)
                WHERE type = 'aliasOf';
                """,
                cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }
}
