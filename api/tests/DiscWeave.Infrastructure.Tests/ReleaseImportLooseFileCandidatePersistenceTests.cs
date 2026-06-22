using DiscWeave.Application.Security;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class ReleaseImportLooseFileCandidatePersistenceTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ReleaseImportLooseFileCandidatePersistenceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Release import loose file candidate queries are filtered by current collection")]
    public async Task Release_import_loose_file_candidate_queries_are_filtered_by_current_collection()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        var firstCollectionId = CollectionId.New();
        await using (DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString))
        {
            ReleaseImportSession firstSession = await AddSessionAsync(context, firstCollectionId);
            ReleaseImportSession secondSession = await AddSessionAsync(context, CollectionId.New());
            _ = context.ReleaseImportLooseFileCandidates.Add(CreateCandidate(firstCollectionId, firstSession.Id, "first.flac"));
            _ = context.ReleaseImportLooseFileCandidates.Add(CreateCandidate(secondSession.CollectionId, secondSession.Id, "second.flac"));
            _ = await context.SaveChangesAsync();
        }

        await using DiscWeaveDbContext filteredContext = new(CreateOptions(connectionString), new TestCurrentCollection(firstCollectionId));
        ReleaseImportLooseFileCandidate[] candidates = [.. await filteredContext.ReleaseImportLooseFileCandidates.ToListAsync()];

        ReleaseImportLooseFileCandidate candidate = Assert.Single(candidates);
        Assert.Equal(firstCollectionId, candidate.CollectionId);
        Assert.Equal("first.flac", candidate.RelativePath);
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

    private static ReleaseImportLooseFileCandidate CreateCandidate(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        string relativePath)
    {
        return ReleaseImportLooseFileCandidate.Create(
            collectionId,
            sessionId,
            ReleaseImportLooseFileCandidateId.New(),
            new LooseFileCandidateFields(
                $"/music/{relativePath}",
                relativePath,
                AudioFileFormat.Flac,
                123_456,
                DateTimeOffset.UnixEpoch,
                "candidate-hash",
                DurationSeconds: 180,
                Codec: "flac",
                Quality: AudioFileQuality.Lossless,
                BitrateKbps: null,
                SampleRateHz: null,
                Channels: null,
                TitleHint: "Candidate",
                ArtistHints: [],
                AlbumTitleHint: null,
                AlbumArtistHints: [],
                TrackNumber: 1,
                Reason: "rootFile"),
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
