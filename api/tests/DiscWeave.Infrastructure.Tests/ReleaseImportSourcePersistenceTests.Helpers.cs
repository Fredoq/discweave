using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class ReleaseImportSourcePersistenceTests
{
    private static IEntityType AssertEntityType<TEntity>(DiscWeaveDbContext context)
        where TEntity : class
    {
        return Assert.IsAssignableFrom<IEntityType>(context.Model.FindEntityType(typeof(TEntity)));
    }

    private static void AssertRequiredLocalFilesDefault(IEntityType entityType)
    {
        IProperty sourceKind = Assert.IsAssignableFrom<IProperty>(entityType.FindProperty("SourceKind"));
        Assert.False(sourceKind.IsNullable);
        Assert.Equal(ReleaseImportSourceKind.LocalFiles, sourceKind.GetDefaultValue());
    }

    private static void AssertCompositeForeignKey(
        IEntityType dependentType,
        Type principalType,
        string[] dependentProperties,
        string[] principalProperties)
    {
        IForeignKey foreignKey = Assert.Single(
            dependentType.GetForeignKeys(),
            key =>
                key.PrincipalEntityType.ClrType == principalType &&
                key.Properties.Select(property => property.Name).SequenceEqual(dependentProperties));
        Assert.Equal(principalProperties, foreignKey.PrincipalKey.Properties.Select(property => property.Name));
    }

    private static async Task AssertExternalColumnsAreNullAsync(
        string connectionString,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        ReleaseImportDraftTrackId trackId)
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();

        await AssertColumnsAreNullAsync(
            connection,
            "SELECT source_root, scan_mode FROM release_import_sessions WHERE release_import_session_id = $id",
            sessionId.Value,
            2);
        await AssertColumnsAreNullAsync(
            connection,
            "SELECT source_path, relative_path FROM release_import_drafts WHERE release_import_draft_id = $id",
            draftId.Value,
            2);
        await AssertColumnsAreNullAsync(
            connection,
            """
            SELECT file_path,
                   relative_path,
                   audio_file_format,
                   size_bytes,
                   last_modified_at,
                   content_hash,
                   codec,
                   quality,
                   bitrate_kbps,
                   sample_rate_hz,
                   channels
            FROM release_import_draft_tracks
            WHERE release_import_draft_track_id = $id
            """,
            trackId.Value,
            11);
    }

    private static async Task AssertColumnsAreNullAsync(
        SqliteConnection connection,
        string commandText,
        Guid id,
        int fieldCount)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = commandText;
        _ = command.Parameters.AddWithValue("$id", id);
        await using SqliteDataReader reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());

        for (int index = 0; index < fieldCount; index++)
        {
            Assert.True(reader.IsDBNull(index));
        }
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

    private sealed class TestCurrentCollection(CollectionId collectionId) : ICurrentCollection
    {
        public CollectionId CollectionId { get; } = collectionId;
    }
}
