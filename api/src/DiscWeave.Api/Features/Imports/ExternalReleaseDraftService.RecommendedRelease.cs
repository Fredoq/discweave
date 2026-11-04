using System.Globalization;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Errors;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseDraftService
{
    public async Task<ReleaseImportSession> CreateRecommendedReleaseAsync(
        CollectionId collectionId,
        RecommendedReleaseDraftRequest request,
        CancellationToken cancellationToken)
    {
        if (!long.TryParse(request.DiscogsReleaseId, NumberStyles.None, CultureInfo.InvariantCulture, out long id) || id <= 0)
        {
            throw new DomainException("import.recommended_release_invalid", "A valid Discogs release identifier is required");
        }

        string releaseId = id.ToString(CultureInfo.InvariantCulture);
        string fingerprint = RecommendedReleaseImport.Fingerprint(releaseId);
        // Validate even before replay; an invalid key cannot create any draft.
        DateTimeOffset now = _timeProvider.GetUtcNow();
        var session = ReleaseImportSession.CreateExternalMetadata(
            collectionId, ReleaseImportSessionId.New(), request.IdempotencyKey, fingerprint, now);
        ReleaseImportSession? existing = await FindIdempotentSessionAsync(collectionId, request.IdempotencyKey.Trim(), cancellationToken);
        if (existing is not null)
        {
            return EnsureIdempotencyReplay(existing, fingerprint);
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await _bindingValidator.GetRecommendedReleaseAsync(
            releaseId, cancellationToken);
        if (!result.IsSuccess)
        {
            throw new DomainException(result.Error.Code, "The provider release could not be verified");
        }

        ExternalMetadataReleaseDetail release = result.Value;
        var draft = ReleaseImportDraft.CreateExternalMetadata(collectionId, session.Id,
            ReleaseImportDraftId.New(), ToDraftFields(release), ReleaseImportLocalProvenanceSelection.Empty());
        draft.UnionAuthoritativeExternalSources(RecommendedReleaseImport.Sources(release));
        draft.SetExternalCollectionItemIntent(ReleaseImportCollectionItemIntent.NewWanted.WithoutMedium());
        _ = _context.ReleaseImportSessions.Add(session);
        _ = _context.ReleaseImportDrafts.Add(draft);
        for (int index = 0; index < release.Tracklist.Count; index++)
        {
            var track = ReleaseImportDraftTrack.CreateExternalMetadata(collectionId, draft.Id,
                ReleaseImportDraftTrackId.New(), ToTrackFields(release.Tracklist[index], index + 1,
                    release.Year, ReleaseImportTrackMode.ReleaseOnly, null, false));
            _ = _context.ReleaseImportDraftTracks.Add(track);
        }

        session.UpdateCounts(1, release.Tracklist.Count, 0, 0, now);
        try
        {
            _ = await _context.SaveChangesAsync(cancellationToken);
            return session;
        }
        catch (ResourceConflictException exception) when (exception.Conflict == ResourceConflictException.IntegrityConstraint)
        {
            _context.ChangeTracker.Clear();
            ReleaseImportSession? winner = await FindIdempotentSessionAsync(collectionId, request.IdempotencyKey.Trim(), cancellationToken);
            if (winner is null)
            {
                throw;
            }

            return EnsureIdempotencyReplay(winner, fingerprint);
        }
    }
}
