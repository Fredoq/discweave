using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<(Guid ReleaseId, Guid TrackId, Guid ReleaseTrackId, Guid OwnedItemId)> SeedExternalReleaseWithTrackAsync(
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        DateTimeOffset appliedAt = DateTimeOffset.UtcNow;
        var release = Release.Create(DefaultCollectionId, ReleaseId.New(), "Existing original release");
        var track = Track.Create(DefaultCollectionId, TrackId.New(), "Blue Monday");
        release.ReplaceExternalSources(
        [
            ExternalSourceReference.Create(
                "musicbrainz",
                "release",
                releaseMbid.ToString("D"),
                $"https://musicbrainz.org/release/{releaseMbid:D}",
                appliedAt)
        ]);
        track.ReplaceExternalSources(
        [
            ExternalSourceReference.Create(
                "musicbrainz",
                "recording",
                recordingMbid.ToString("D"),
                $"https://musicbrainz.org/recording/{recordingMbid:D}",
                appliedAt),
            ExternalSourceReference.Create(
                "musicbrainz",
                "track",
                trackMbid.ToString("D"),
                $"https://musicbrainz.org/track/{trackMbid:D}",
                appliedAt)
        ]);
        var releaseTrack = ReleaseTrack.Create(track.Id, TrackPosition.FromNumber(1));
        release.ReplaceTracklist([releaseTrack]);
        var ownedItem = OwnedItem.Create(
            DefaultCollectionId,
            OwnedItemId.New(),
            release.Id,
            OwnershipStatus.Owned,
            DigitalFile.Create());
        _ = context.Releases.Add(release);
        _ = context.Tracks.Add(track);
        _ = context.OwnedItems.Add(ownedItem);
        _ = await context.SaveChangesAsync(cancellationToken);

        return (release.Id.Value, track.Id.Value, releaseTrack.Id.Value, ownedItem.Id.Value);
    }

    public async Task ConfigureExternalDraftForConfirmationAsync(
        Guid sessionId,
        Guid draftId,
        Guid draftTrackId,
        Guid sourceTrackId,
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        ReleaseImportDraft draft = await context.ReleaseImportDrafts.SingleAsync(
            candidate => candidate.CollectionId == DefaultCollectionId &&
                candidate.SessionId == new ReleaseImportSessionId(sessionId) &&
                candidate.Id == new ReleaseImportDraftId(draftId),
            cancellationToken);
        ReleaseImportDraftTrack track = await context.ReleaseImportDraftTracks.SingleAsync(
            candidate => candidate.CollectionId == DefaultCollectionId && candidate.Id == new ReleaseImportDraftTrackId(draftTrackId),
            cancellationToken);
        _ = sourceTrackId;
        _ = releaseMbid;
        _ = recordingMbid;
        _ = trackMbid;
        _ = track;
        draft.SetExternalCollectionItemIntent(
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()));
        _ = await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<(int ReleaseCount, int TrackCount, int WantedCount, int RelationCount, bool Original, int TrackSourceCount, int ReleaseSourceCount)> GetExternalCatalogStateAsync(
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        Track[] tracks = await context.Tracks
            .Where(track => track.CollectionId == DefaultCollectionId)
            .ToArrayAsync(cancellationToken);
        Release[] releases = await context.Releases
            .Where(release => release.CollectionId == DefaultCollectionId)
            .ToArrayAsync(cancellationToken);
        OwnedItem[] ownedItems = await context.OwnedItems
            .Where(item => item.CollectionId == DefaultCollectionId)
            .ToArrayAsync(cancellationToken);
        int relations = await context.TrackRelations.CountAsync(
            relation => relation.CollectionId == DefaultCollectionId,
            cancellationToken);
        Track? original = tracks.SingleOrDefault(track => track.Metadata.IsOriginal);
        Release? release = releases.SingleOrDefault();
        return (
            releases.Length,
            tracks.Length,
            ownedItems.Count(item => item.Holding.Status == OwnershipStatus.Wanted),
            relations,
            original?.Metadata.IsOriginal == true,
            original?.ExternalSources.Count ?? 0,
            release?.ExternalSources.Count ?? 0);
    }

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

        var releaseMbid = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var recordingMbid = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var trackMbid = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var sourceTrackId = new TrackId(Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        _ = context.Tracks.Add(Track.Create(DefaultCollectionId, sourceTrackId, "Seeded source"));
        var recordingSource = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "recording",
            recordingMbid.ToString("D"),
            $"https://musicbrainz.org/recording/{recordingMbid:D}");
        var releaseRoute = ExternalReleaseRoute.CreateMusicBrainz(
            ReleaseImportProviderReference.Create(
                "musicbrainz",
                "release",
                releaseMbid.ToString("D"),
                $"https://musicbrainz.org/release/{releaseMbid:D}"));
        var binding = SelectedOriginalBinding.CreateMusicBrainz(
            sourceTrackId,
            draftTrackId,
            recordingSource,
            releaseRoute,
            MusicBrainzReleaseRowLocator.Create(
                releaseMbid.ToString("D"),
                "1",
                trackMbid.ToString("D")),
            promoteLinkedTargetConfirmed: false);

        _ = context.ReleaseImportSessions.Add(session);
        _ = context.ReleaseImportDrafts.Add(draft);
        _ = context.ReleaseImportDraftTracks.Add(track);
        _ = await context.SaveChangesAsync(cancellationToken);

        draft.InitializeExternalReview(
            binding,
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
            track);
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
