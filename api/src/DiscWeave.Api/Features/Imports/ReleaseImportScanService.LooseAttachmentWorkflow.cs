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
    private static ReleaseImportLooseFileAttachmentMappingRequest[] NormalizedAttachMappings(
        ReleaseImportLooseFileAttachmentRequest request)
    {
        ReleaseImportLooseFileAttachmentMappingRequest[] mappings =
        [
            .. (request.Mappings ?? [])
                .Where(mapping => mapping.CandidateId != Guid.Empty && mapping.ReleaseTrackId != Guid.Empty)
        ];

        return mappings.GroupBy(mapping => mapping.CandidateId).Any(group => group.Count() > 1)
            ? throw new DomainException(
                "release_import_loose_file.candidate_duplicate",
                "Map each loose file candidate at most once")
            : mappings;
    }

    private static void EnsureAttachMappingsAreValid(ReleaseImportLooseFileAttachmentMappingRequest[] mappings)
    {
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
    }

    private static async Task<ReleaseImportSession?> FindAttachSessionAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        CancellationToken cancellationToken)
    {
        return await context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.Id == sessionId,
            cancellationToken);
    }

    private static async Task<Release> FindAttachReleaseAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseId releaseId,
        CancellationToken cancellationToken)
    {
        return await context.Releases
            .Include(release => release.Tracklist)
            .SingleOrDefaultAsync(
                candidate => candidate.CollectionId == collectionId && candidate.Id == releaseId,
                cancellationToken)
            ?? throw new DomainException("release_import_loose_file.release_not_found", "Release was not found");
    }

    private static async Task<Dictionary<ReleaseImportLooseFileCandidateId, ReleaseImportLooseFileCandidate>> LoadAttachCandidatesByIdAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        IReadOnlyList<ReleaseImportLooseFileAttachmentMappingRequest> mappings,
        CancellationToken cancellationToken)
    {
        ReleaseImportLooseFileCandidateId[] candidateIds =
            [.. mappings.Select(mapping => new ReleaseImportLooseFileCandidateId(mapping.CandidateId))];
        ReleaseImportLooseFileCandidate[] candidates = await context.ReleaseImportLooseFileCandidates
            .Where(candidate =>
                candidate.CollectionId == collectionId &&
                candidate.SessionId == sessionId &&
                candidateIds.Contains(candidate.Id))
            .ToArrayAsync(cancellationToken);
        return candidates.Length != candidateIds.Length
            ? throw new DomainException(
                "release_import_loose_file.not_found",
                "Loose file candidate was not found")
            : candidates.ToDictionary(candidate => candidate.Id);
    }

    private static async Task ValidateAttachMappingsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        OwnedItemId digitalOwnedItemId,
        IReadOnlyDictionary<ReleaseTrackId, ReleaseTrack> releaseTracksById,
        Dictionary<ReleaseImportLooseFileCandidateId, ReleaseImportLooseFileCandidate> candidatesById,
        IReadOnlyList<ReleaseImportLooseFileAttachmentMappingRequest> mappings,
        CancellationToken cancellationToken)
    {
        foreach (ReleaseImportLooseFileAttachmentMappingRequest mapping in mappings)
        {
            var candidateId = new ReleaseImportLooseFileCandidateId(mapping.CandidateId);
            var releaseTrackId = new ReleaseTrackId(mapping.ReleaseTrackId);
            ReleaseImportLooseFileCandidate candidate = RequireAttachCandidate(candidatesById, candidateId);
            EnsureAttachReleaseTrackExists(releaseTracksById, releaseTrackId);
            if (!await IsAttachCandidateAvailableAsync(context, collectionId, digitalOwnedItemId, releaseTrackId, candidate, cancellationToken))
            {
                throw new DomainException(
                    "release_import_loose_file.already_consumed",
                    "Loose file candidate has already been consumed");
            }
        }
    }

    private static async Task ApplyAttachMappingsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        OwnedItemId digitalOwnedItemId,
        Dictionary<ReleaseImportLooseFileCandidateId, ReleaseImportLooseFileCandidate> candidatesById,
        IReadOnlyList<ReleaseImportLooseFileAttachmentMappingRequest> mappings,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        foreach (ReleaseImportLooseFileAttachmentMappingRequest mapping in mappings)
        {
            var candidateId = new ReleaseImportLooseFileCandidateId(mapping.CandidateId);
            var releaseTrackId = new ReleaseTrackId(mapping.ReleaseTrackId);
            ReleaseImportLooseFileCandidate candidate = RequireAttachCandidate(candidatesById, candidateId);
            LocalAudioFile localFile = await GetOrCreateAttachLocalAudioFileAsync(context, collectionId, candidate, cancellationToken);
            await UpsertAttachDigitalTrackFileLinkAsync(
                context,
                collectionId,
                digitalOwnedItemId,
                releaseTrackId,
                localFile.Id,
                mapping.ConfirmRelink,
                cancellationToken);

            if (candidate.Decision == ReleaseImportLooseFileCandidate.PendingDecision)
            {
                candidate.MarkAttachedToRelease(now);
            }
        }
    }

    private static void EnsureAttachReleaseTrackExists(
        IReadOnlyDictionary<ReleaseTrackId, ReleaseTrack> releaseTracksById,
        ReleaseTrackId releaseTrackId)
    {
        if (!releaseTracksById.ContainsKey(releaseTrackId))
        {
            throw new DomainException(
                "release_import_loose_file.release_track_not_found",
                "Release track was not found");
        }
    }

    private static async Task<bool> IsAttachCandidateAvailableAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        OwnedItemId digitalOwnedItemId,
        ReleaseTrackId releaseTrackId,
        ReleaseImportLooseFileCandidate candidate,
        CancellationToken cancellationToken)
    {
        return candidate.Decision == ReleaseImportLooseFileCandidate.PendingDecision ||
            await IsIdempotentAttachMappingAsync(
                context,
                collectionId,
                digitalOwnedItemId,
                releaseTrackId,
                candidate,
                cancellationToken);
    }
}
