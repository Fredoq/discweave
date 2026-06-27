using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<(Guid SessionId, Guid CandidateId)> SeedLooseFileCandidateAsync(
        string sourceRoot,
        string filePath,
        string relativePath,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        DateTimeOffset now = DateTimeOffset.UtcNow;
        var sessionId = ReleaseImportSessionId.New();
        var candidateId = ReleaseImportLooseFileCandidateId.New();

        var session = ReleaseImportSession.Create(
            DefaultCollectionId,
            sessionId,
            sourceRoot,
            now);
        session.UpdateCounts(
            draftCount: 0,
            trackCount: 0,
            ignoredFileCount: 0,
            looseFileCandidateCount: 1,
            updatedAt: now);
        _ = context.ReleaseImportSessions.Add(session);
        _ = context.ReleaseImportLooseFileCandidates.Add(ReleaseImportLooseFileCandidate.Create(
            DefaultCollectionId,
            sessionId,
            candidateId,
            new LooseFileCandidateFields(
                filePath,
                relativePath,
                AudioFileFormat.Flac,
                SizeBytes: 9,
                LastModifiedAt: now,
                ContentHash: "outside-cover-hash",
                DurationSeconds: 123,
                Codec: "FLAC",
                Quality: AudioFileQuality.Lossless,
                BitrateKbps: 900,
                SampleRateHz: 44100,
                Channels: 2,
                TitleHint: "First",
                ArtistHints: [],
                AlbumTitleHint: "Album A",
                AlbumArtistHints: [],
                TrackNumber: 1,
                Reason: "mixed_album_tags"),
            now));
        _ = await context.SaveChangesAsync(cancellationToken);

        return (sessionId.Value, candidateId.Value);
    }
}
