using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<(Guid SessionId, Guid DraftId, Guid DraftTrackId)> SeedExternalMetadataReleaseImportAsync(
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        DateTimeOffset now = DateTimeOffset.UtcNow;
        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();
        var draftTrackId = ReleaseImportDraftTrackId.New();
        var session = ReleaseImportSession.CreateExternalMetadata(
            DefaultCollectionId,
            sessionId,
            $"external-{sessionId.Value:D}",
            new string('a', 64),
            now);
        var draft = ReleaseImportDraft.CreateExternalMetadata(
            DefaultCollectionId,
            sessionId,
            draftId,
            new ReleaseImportDraftEditableFields(
                "Blue Monday",
                "single",
                Optional.From("FAC 73"),
                Optional.From("Factory"),
                Optional.From(new DateOnly(1983, 3, 7)),
                Optional.From(1983),
                false,
                false,
                Optional.Missing<string>(),
                ["New Order"],
                [],
                [],
                [],
                ["Electronic"],
                [],
                true,
                []),
            ReleaseImportLocalProvenanceSelection.Empty());

        session.UpdateCounts(
            draftCount: 1,
            trackCount: 1,
            ignoredFileCount: 0,
            looseFileCandidateCount: 0,
            updatedAt: now);
        var track = ReleaseImportDraftTrack.CreateExternalMetadata(
            DefaultCollectionId,
            draftId,
            draftTrackId,
            new DraftTrackEditableFields(
                1,
                null,
                "A",
                "Blue Monday",
                TimeSpan.FromSeconds(449),
                1983,
                ["New Order"],
                [],
                false,
                [],
                ReleaseImportTrackMode.Create,
                null,
                false,
                []));

        _ = context.ReleaseImportSessions.Add(session);
        _ = context.ReleaseImportDrafts.Add(draft);
        _ = context.ReleaseImportDraftTracks.Add(track);
        _ = await context.SaveChangesAsync(cancellationToken);

        return (sessionId.Value, draftId.Value, draftTrackId.Value);
    }

    public async Task<(long Revision, string TrackTitle)> GetExternalMetadataDraftStateAsync(
        Guid draftId,
        Guid draftTrackId,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        ReleaseImportDraft draft = await context.ReleaseImportDrafts.SingleAsync(
            candidate => candidate.CollectionId == DefaultCollectionId &&
                candidate.Id == new ReleaseImportDraftId(draftId),
            cancellationToken);
        ReleaseImportDraftTrack track = await context.ReleaseImportDraftTracks.SingleAsync(
            candidate => candidate.CollectionId == DefaultCollectionId &&
                candidate.Id == new ReleaseImportDraftTrackId(draftTrackId),
            cancellationToken);
        return (draft.ExternalReviewRevision, track.Title);
    }

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
