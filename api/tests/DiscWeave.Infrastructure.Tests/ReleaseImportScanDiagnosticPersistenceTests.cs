using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class ReleaseImportScanDiagnosticPersistenceTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ReleaseImportScanDiagnosticPersistenceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Release import scan diagnostic persists and reloads session-scoped details")]
    public async Task Release_import_scan_diagnostic_persists_and_reloads_session_scoped_details()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        var collectionId = CollectionId.New();
        ReleaseImportSessionId sessionId;
        ReleaseImportScanDiagnosticId diagnosticId;
        var createdAt = new DateTimeOffset(2026, 6, 20, 12, 0, 0, TimeSpan.Zero);

        await using (DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString))
        {
            ReleaseImportSession session = await AddSessionAsync(context, collectionId);
            sessionId = session.Id;
            var diagnostic = ReleaseImportScanDiagnostic.Create(
                collectionId,
                session.Id,
                ReleaseImportScanDiagnosticId.New(),
                new ReleaseImportScanDiagnostic.Fields
                {
                    Code = "metadata_read_failed",
                    Severity = ReleaseImportScanDiagnosticSeverity.Warning,
                    Message = "Import scanner could not read audio metadata for this file.",
                    FilePath = "/music/Release/01 Track.flac",
                    RelativePath = "Release/01 Track.flac",
                    Extension = ".flac",
                    SizeBytes = 123_456,
                    Source = "metadata"
                },
                createdAt);
            diagnosticId = diagnostic.Id;
            _ = context.ReleaseImportScanDiagnostics.Add(diagnostic);
            _ = await context.SaveChangesAsync();
        }

        await using DiscWeaveDbContext reloadContext = await CreateInitializedContextAsync(connectionString);
        ReleaseImportScanDiagnostic saved = await reloadContext.ReleaseImportScanDiagnostics.AsNoTracking().SingleAsync();

        Assert.Equal(collectionId, saved.CollectionId);
        Assert.Equal(sessionId, saved.SessionId);
        Assert.Equal(diagnosticId, saved.Id);
        Assert.Equal("metadata_read_failed", saved.Code);
        Assert.Equal(ReleaseImportScanDiagnosticSeverity.Warning, saved.Severity);
        Assert.Equal("Import scanner could not read audio metadata for this file.", saved.Message);
        Assert.Equal("/music/Release/01 Track.flac", saved.FilePath);
        Assert.Equal("Release/01 Track.flac", saved.RelativePath);
        Assert.Equal(".flac", saved.Extension);
        Assert.Equal(123_456, saved.SizeBytes);
        Assert.Equal("metadata", saved.Source);
        Assert.Equal(createdAt, saved.CreatedAt);
    }

    [Fact(DisplayName = "Release import scan diagnostic queries are filtered by current collection")]
    public async Task Release_import_scan_diagnostic_queries_are_filtered_by_current_collection()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        var firstCollectionId = CollectionId.New();
        await using (DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString))
        {
            ReleaseImportSession firstSession = await AddSessionAsync(context, firstCollectionId);
            ReleaseImportSession secondSession = await AddSessionAsync(context, CollectionId.New());
            _ = context.ReleaseImportScanDiagnostics.Add(CreateDiagnostic(firstCollectionId, firstSession.Id, "unsupported_extension"));
            _ = context.ReleaseImportScanDiagnostics.Add(CreateDiagnostic(secondSession.CollectionId, secondSession.Id, "hidden_path"));
            _ = await context.SaveChangesAsync();
        }

        await using DiscWeaveDbContext filteredContext = new(CreateOptions(connectionString), new TestCurrentCollection(firstCollectionId));
        ReleaseImportScanDiagnostic[] diagnostics = [.. await filteredContext.ReleaseImportScanDiagnostics.ToListAsync()];

        ReleaseImportScanDiagnostic diagnostic = Assert.Single(diagnostics);
        Assert.Equal(firstCollectionId, diagnostic.CollectionId);
        Assert.Equal("unsupported_extension", diagnostic.Code);
    }

    [Fact(DisplayName = "Release import scan diagnostic is deleted when its session is deleted")]
    public async Task Release_import_scan_diagnostic_is_deleted_when_its_session_is_deleted()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(await _sqlite.CreateDatabaseAsync());
        ReleaseImportSession session = await AddSessionAsync(context, CollectionId.New());
        _ = context.ReleaseImportScanDiagnostics.Add(CreateDiagnostic(session.CollectionId, session.Id, "directory_unreadable"));
        _ = await context.SaveChangesAsync();

        _ = context.ReleaseImportSessions.Remove(session);
        _ = await context.SaveChangesAsync();

        Assert.Empty(await context.ReleaseImportScanDiagnostics.IgnoreQueryFilters().ToListAsync());
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

    private static async Task<ReleaseImportSession> AddSessionAsync(DiscWeaveDbContext context, CollectionId collectionId)
    {
        await TestCollectionFactory.AddCollectionAsync(context, collectionId);
        var session = ReleaseImportSession.Create(
            collectionId,
            ReleaseImportSessionId.New(),
            "/imports",
            DateTimeOffset.UnixEpoch);
        _ = context.ReleaseImportSessions.Add(session);
        _ = await context.SaveChangesAsync();

        return session;
    }

    private static ReleaseImportScanDiagnostic CreateDiagnostic(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        string code)
    {
        return ReleaseImportScanDiagnostic.Create(
            collectionId,
            sessionId,
            ReleaseImportScanDiagnosticId.New(),
            new ReleaseImportScanDiagnostic.Fields
            {
                Code = code,
                Severity = ReleaseImportScanDiagnosticSeverity.Info,
                Message = "Import scanner diagnostic.",
                FilePath = "/music/file.txt",
                RelativePath = "file.txt",
                Extension = ".txt",
                Source = "scanner"
            },
            DateTimeOffset.UnixEpoch);
    }

    private sealed class TestCurrentCollection : ICurrentCollection
    {
        public TestCurrentCollection(CollectionId collectionId)
        {
            CollectionId = collectionId;
        }

        public CollectionId CollectionId { get; }
    }
}
