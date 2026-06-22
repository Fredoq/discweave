using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private const string DigitalMediumType = "digital";

    public static async Task<ReleaseImportSession?> AttachLooseFilesToReleaseAsync(
        Guid sessionGuid,
        ReleaseImportLooseFileAttachmentRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        ReleaseImportLooseFileAttachmentMappingRequest[] mappings =
        [
            .. (request.Mappings ?? [])
                .Where(mapping => mapping.CandidateId != Guid.Empty && mapping.ReleaseTrackId != Guid.Empty)
                .GroupBy(mapping => mapping.CandidateId)
                .Select(group => group.First())
        ];
        if (mappings.Length == 0)
        {
            throw new DomainException(
                "release_import_loose_file.mapping_required",
                "Select at least one loose file mapping");
        }

        if (mappings.GroupBy(mapping => mapping.ReleaseTrackId).Any(group => group.Count() > 1))
        {
            throw new DomainException(
                "release_import_loose_file.release_track_duplicate",
                "Map at most one loose file candidate to each release track");
        }

        var sessionId = new ReleaseImportSessionId(sessionGuid);
        ReleaseImportSession? session = await context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.Id == sessionId,
            cancellationToken);
        if (session is null)
        {
            return null;
        }

        var releaseId = new ReleaseId(request.ReleaseId);
        Release release = await context.Releases
            .Include(release => release.Tracklist)
            .SingleOrDefaultAsync(
                candidate => candidate.CollectionId == collectionId && candidate.Id == releaseId,
                cancellationToken)
            ?? throw new DomainException("release_import_loose_file.release_not_found", "Release was not found");

        ReleaseImportLooseFileCandidateId[] candidateIds =
            [.. mappings.Select(mapping => new ReleaseImportLooseFileCandidateId(mapping.CandidateId))];
        ReleaseImportLooseFileCandidate[] candidates = await context.ReleaseImportLooseFileCandidates
            .Where(candidate =>
                candidate.CollectionId == collectionId &&
                candidate.SessionId == sessionId &&
                candidateIds.Contains(candidate.Id))
            .ToArrayAsync(cancellationToken);
        if (candidates.Length != candidateIds.Length)
        {
            throw new DomainException(
                "release_import_loose_file.not_found",
                "Loose file candidate was not found");
        }

        Dictionary<ReleaseImportLooseFileCandidateId, ReleaseImportLooseFileCandidate> candidatesById =
            candidates.ToDictionary(candidate => candidate.Id);
        var releaseTracksById = release.Tracklist.ToDictionary(track => track.Id);
        OwnedItem digitalOwnedItem = await GetOrCreateAttachDigitalOwnedItemAsync(context, collectionId, release, cancellationToken);
        DateTimeOffset now = DateTimeOffset.UtcNow;

        foreach (ReleaseImportLooseFileAttachmentMappingRequest mapping in mappings)
        {
            var candidateId = new ReleaseImportLooseFileCandidateId(mapping.CandidateId);
            var releaseTrackId = new ReleaseTrackId(mapping.ReleaseTrackId);
            ReleaseImportLooseFileCandidate candidate = RequireAttachCandidate(candidatesById, candidateId);

            if (!releaseTracksById.ContainsKey(releaseTrackId))
            {
                throw new DomainException(
                    "release_import_loose_file.release_track_not_found",
                    "Release track was not found");
            }

            if (candidate.Decision != ReleaseImportLooseFileCandidate.PendingDecision &&
                !await IsIdempotentAttachMappingAsync(
                    context,
                    collectionId,
                    digitalOwnedItem.Id,
                    releaseTrackId,
                    candidate,
                    cancellationToken))
            {
                throw new DomainException(
                    "release_import_loose_file.already_consumed",
                    "Loose file candidate has already been consumed");
            }
        }

        foreach (ReleaseImportLooseFileAttachmentMappingRequest mapping in mappings)
        {
            var candidateId = new ReleaseImportLooseFileCandidateId(mapping.CandidateId);
            var releaseTrackId = new ReleaseTrackId(mapping.ReleaseTrackId);
            ReleaseImportLooseFileCandidate candidate = RequireAttachCandidate(candidatesById, candidateId);
            LocalAudioFile localFile = await GetOrCreateAttachLocalAudioFileAsync(context, collectionId, candidate, cancellationToken);
            await UpsertAttachDigitalTrackFileLinkAsync(
                context,
                collectionId,
                digitalOwnedItem.Id,
                releaseTrackId,
                localFile.Id,
                mapping.ConfirmRelink,
                cancellationToken);

            if (candidate.Decision == ReleaseImportLooseFileCandidate.PendingDecision)
            {
                candidate.MarkAttachedToRelease(now);
            }
        }

        _ = await context.SaveChangesAsync(cancellationToken);
        return session;
    }

    private static ReleaseImportLooseFileCandidate RequireAttachCandidate(
        Dictionary<ReleaseImportLooseFileCandidateId, ReleaseImportLooseFileCandidate> candidatesById,
        ReleaseImportLooseFileCandidateId candidateId)
    {
        return candidatesById.TryGetValue(candidateId, out ReleaseImportLooseFileCandidate? candidate)
            ? candidate
            : throw new DomainException(
                "release_import_loose_file.not_found",
                "Loose file candidate was not found");
    }

    private static async Task<OwnedItem> GetOrCreateAttachDigitalOwnedItemAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        CancellationToken cancellationToken)
    {
        OwnedItem? existing = await context.OwnedItems.SingleOrDefaultAsync(
            item =>
                item.CollectionId == collectionId &&
                EF.Property<ReleaseId>(item, "_releaseId") == release.Id &&
                EF.Property<string>(item, "_mediumType") == DigitalMediumType,
            cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var item = OwnedItem.Create(collectionId, OwnedItemId.New(), release.Id, OwnershipStatus.Owned, DigitalFile.Create());
        _ = context.OwnedItems.Add(item);
        return item;
    }

    private static async Task<LocalAudioFile> GetOrCreateAttachLocalAudioFileAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportLooseFileCandidate candidate,
        CancellationToken cancellationToken)
    {
        var path = FilePath.FromAbsolutePath(candidate.FilePath);
        LocalAudioFile? existing = await context.LocalAudioFiles.SingleOrDefaultAsync(
            file => file.CollectionId == collectionId && file.Path == path,
            cancellationToken);
        if (existing is not null)
        {
            return ApplyAttachFileMetadata(existing, candidate);
        }

        LocalAudioFile created = ApplyAttachFileMetadata(LocalAudioFile.Create(collectionId, LocalAudioFileId.New(), path), candidate);
        _ = context.LocalAudioFiles.Add(created);
        return created;
    }

    private static LocalAudioFile ApplyAttachFileMetadata(LocalAudioFile file, ReleaseImportLooseFileCandidate candidate)
    {
        _ = file
            .WithFormat(candidate.Format)
            .WithSizeBytes(candidate.SizeBytes)
            .WithModifiedAt(candidate.LastModifiedAt);

        if (!string.IsNullOrWhiteSpace(candidate.Codec))
        {
            _ = file.WithCodec(candidate.Codec);
        }

        if (candidate.Quality is { } quality)
        {
            _ = file.WithQuality(quality);
        }

        if (candidate.Duration is { } duration)
        {
            _ = file.WithDuration(duration);
        }

        if (candidate.BitrateKbps is { } bitrateKbps)
        {
            _ = file.WithBitrateKbps(bitrateKbps);
        }

        if (candidate.SampleRateHz is { } sampleRateHz)
        {
            _ = file.WithSampleRateHz(sampleRateHz);
        }

        if (candidate.Channels is { } channels)
        {
            _ = file.WithChannels(channels);
        }

        var path = FilePath.FromAbsolutePath(candidate.FilePath);
        FileImportIdentity identity = string.IsNullOrWhiteSpace(candidate.ContentHash)
            ? FileImportIdentity.Create(path, candidate.SizeBytes, candidate.LastModifiedAt)
            : FileImportIdentity.Create(path, candidate.SizeBytes, candidate.LastModifiedAt, candidate.ContentHash);
        if (!string.IsNullOrWhiteSpace(candidate.ContentHash))
        {
            _ = file.WithContentHash(candidate.ContentHash);
        }

        _ = file.WithImportIdentity(identity);
        return file;
    }

    private static async Task<bool> IsIdempotentAttachMappingAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        OwnedItemId digitalOwnedItemId,
        ReleaseTrackId releaseTrackId,
        ReleaseImportLooseFileCandidate candidate,
        CancellationToken cancellationToken)
    {
        var path = FilePath.FromAbsolutePath(candidate.FilePath);
        LocalAudioFile? localFile = await context.LocalAudioFiles.AsNoTracking().SingleOrDefaultAsync(
            file => file.CollectionId == collectionId && file.Path == path,
            cancellationToken);
        return localFile is not null && await context.DigitalTrackFileLinks.AsNoTracking().AnyAsync(
            link =>
                link.CollectionId == collectionId &&
                link.DigitalOwnedItemId == digitalOwnedItemId &&
                link.ReleaseTrackId == releaseTrackId &&
                link.LocalAudioFileId == localFile.Id,
            cancellationToken);
    }

    private static async Task UpsertAttachDigitalTrackFileLinkAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        OwnedItemId digitalOwnedItemId,
        ReleaseTrackId releaseTrackId,
        LocalAudioFileId localAudioFileId,
        bool confirmRelink,
        CancellationToken cancellationToken)
    {
        DigitalTrackFileLink? existing = await context.DigitalTrackFileLinks.SingleOrDefaultAsync(
            link =>
                link.CollectionId == collectionId &&
                link.DigitalOwnedItemId == digitalOwnedItemId &&
                link.ReleaseTrackId == releaseTrackId,
            cancellationToken);
        if (existing is not null)
        {
            if (existing.LocalAudioFileId != localAudioFileId)
            {
                if (!confirmRelink)
                {
                    throw new DomainException(
                        "release_import_loose_file.link_exists",
                        "Release track already has a linked local file; confirm relink before replacing it");
                }

                _ = existing.Relink(localAudioFileId);
            }

            return;
        }

        _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
            collectionId,
            DigitalTrackFileLinkId.New(),
            digitalOwnedItemId,
            releaseTrackId,
            localAudioFileId));
    }
}
