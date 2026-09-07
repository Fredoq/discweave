using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.Catalog;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Errors;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseDraftService
{
    private readonly DiscWeaveDbContext _context;
    private readonly IExternalSourceLookup _sourceLookup;
    private readonly IExternalReleaseBindingValidator _bindingValidator;
    private readonly ILocalOriginalCandidateService _localCandidateService;
    private readonly TimeProvider _timeProvider;

    public ExternalReleaseDraftService(
        DiscWeaveDbContext context,
        IExternalSourceLookup sourceLookup,
        IExternalReleaseBindingValidator bindingValidator,
        ILocalOriginalCandidateService localCandidateService,
        TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(sourceLookup);
        ArgumentNullException.ThrowIfNull(bindingValidator);
        ArgumentNullException.ThrowIfNull(localCandidateService);
        ArgumentNullException.ThrowIfNull(timeProvider);
        _context = context;
        _sourceLookup = sourceLookup;
        _bindingValidator = bindingValidator;
        _localCandidateService = localCandidateService;
        _timeProvider = timeProvider;
    }

    public async Task<ReleaseImportSession> CreateAsync( // NOSONAR: creation intentionally coordinates validation, persistence, and binding.
        CollectionId collectionId,
        ExternalReleaseDraftRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.MusicBrainzRow is null && request.DiscogsRoute is null)
        {
            throw InvalidRequest("An external release row locator is required");
        }

        string idempotencyKey = request.IdempotencyKey?.Trim() ?? string.Empty;
        if (idempotencyKey.Length is 0 or > 128 ||
            idempotencyKey.Any(character => character is < '!' or > '~'))
        {
            throw InvalidRequest("External import idempotency key is invalid");
        }

        if (request.ReviewedRelationTypeCode?.Trim() is not { Length: > 0 })
        {
            throw InvalidRequest("Reviewed relation type is required");
        }

        if (request.SourceTrackId == Guid.Empty ||
            (request.MusicBrainzRow is { } requestedRow
                ? request.RecordingMbid == Guid.Empty || requestedRow.ReleaseMbid == Guid.Empty || requestedRow.TrackMbid == Guid.Empty
                : request.RecordingMbid != Guid.Empty))
        {
            throw InvalidRequest("Source and MusicBrainz identifiers are required");
        }

        TrackId sourceTrackId = new(request.SourceTrackId);
        bool sourceTrackExists = await _context.Tracks
            .AnyAsync(
                track => track.CollectionId == collectionId && track.Id == sourceTrackId,
                cancellationToken);
        if (!sourceTrackExists)
        {
            throw new DomainException("track.not_found", "Track was not found");
        }

        LocalOriginalCandidateResult eligibility = await _localCandidateService.FindAsync(
            collectionId,
            sourceTrackId,
            cancellationToken);
        if (eligibility.Status == LocalOriginalCandidateStatus.SourceNotEligible)
        {
            throw new DomainException(
                "original_discovery.source_not_eligible",
                "Track is not eligible for original discovery");
        }

        if (eligibility.Status == LocalOriginalCandidateStatus.SourceNotFound)
        {
            throw new DomainException("track.not_found", "Track was not found");
        }

        (ReleaseImportProviderReference? recordingSource,
            MusicBrainzReleaseRowLocator? musicBrainzRow,
            DiscogsReleaseRowLocator? discogsRow,
            ExternalReleaseRoute releaseRoute,
            string fingerprint) canonicalRequest;
        try
        {
            canonicalRequest = BuildCanonicalRequest(sourceTrackId, request);
        }
        catch (DomainException exception)
        {
            throw InvalidRequest(exception.Message);
        }

        ReleaseImportProviderReference? recordingSource = canonicalRequest.recordingSource;
        MusicBrainzReleaseRowLocator? musicBrainzRow = canonicalRequest.musicBrainzRow;
        DiscogsReleaseRowLocator? discogsRow = canonicalRequest.discogsRow;
        ExternalReleaseRoute releaseRoute = canonicalRequest.releaseRoute;
        string fingerprint = canonicalRequest.fingerprint;
        ReleaseImportSession? existing = await FindIdempotentSessionAsync(
            collectionId,
            idempotencyKey,
            cancellationToken);
        if (existing is not null)
        {
            return EnsureIdempotencyReplay(existing, fingerprint);
        }

        ExternalReleaseBindingValidationResult validation = await _bindingValidator.ValidateRequestAsync(
            request,
            cancellationToken);
        (ExternalMetadataReleaseDetail providerRelease, ExternalMetadataReleaseTrack boundProviderRow) = validation switch
        {
            ExternalReleaseBindingValidationResult.DiscogsValid discogs => (discogs.Release, discogs.Row),
            ExternalReleaseBindingValidationResult.MusicBrainzValid musicBrainz => (musicBrainz.Release, musicBrainz.Row),
            ExternalReleaseBindingValidationResult.DiscogsBackedValid backed => (backed.MusicBrainzRelease, backed.MusicBrainzRow),
            ExternalReleaseBindingValidationResult.StaleBinding stale =>
                throw new DomainException(stale.Code, "The external release row is stale"),
            ExternalReleaseBindingValidationResult.AmbiguousBinding ambiguous =>
                throw new DomainException(ambiguous.Code, "The external release row is ambiguous"),
            ExternalReleaseBindingValidationResult.ProviderFailed failed =>
                throw new ExternalReleaseProviderFailureException(failed.Status),
            _ => throw new InvalidOperationException("Unknown external release validation result")
        };

        ReleaseId[] releaseIds = await FindReleaseIdsAsync(
            collectionId,
            recordingSource,
            releaseRoute,
            cancellationToken);
        TrackId[] trackIds = await FindTrackIdsAsync(
            collectionId,
            recordingSource,
            musicBrainzRow,
            discogsRow,
            cancellationToken);
        var selection = ReleaseImportLocalProvenanceSelection.Empty();
        if (releaseIds.Length == 1)
        {
            selection = selection.WithRelease(releaseIds[0]);
        }

        if (trackIds.Length == 1)
        {
            selection = selection.WithTrack(trackIds[0]);
        }

        DateTimeOffset now = _timeProvider.GetUtcNow();
        var session = ReleaseImportSession.CreateExternalMetadata(
            collectionId,
            ReleaseImportSessionId.New(),
            idempotencyKey,
            fingerprint,
            now);
        var draftId = ReleaseImportDraftId.New();
        var boundDraftTrackId = ReleaseImportDraftTrackId.New();
        ReleaseImportDraftEditableFields fields = ToDraftFields(providerRelease);
        var draft = ReleaseImportDraft.CreateExternalMetadata(
            collectionId,
            session.Id,
            draftId,
            fields,
            selection);
        _ = _context.ReleaseImportSessions.Add(session);
        _ = _context.ReleaseImportDrafts.Add(draft);
        List<ReleaseImportProviderReference> releaseSources = [.. releaseRoute.Sources];
        draft.UnionAuthoritativeExternalSources(releaseSources);

        ReleaseImportDraftTrack? boundDraftTrack = null;
        for (int index = 0; index < providerRelease.Tracklist.Count; index++)
        {
            ExternalMetadataReleaseTrack providerTrack = providerRelease.Tracklist[index];
            bool isBound = ReferenceEquals(providerTrack, boundProviderRow) ||
                (musicBrainzRow is not null && HasMusicBrainzTrack(providerTrack, musicBrainzRow.TrackMbid));
            ReleaseImportDraftTrackId trackId = isBound ? boundDraftTrackId : ReleaseImportDraftTrackId.New();
            TrackId? selectedTrackId = isBound && trackIds.Length == 1 ? trackIds[0] : null;
            ReleaseImportTrackMode mode = selectedTrackId is not null
                ? ReleaseImportTrackMode.Link
                : ReleaseImportTrackMode.Create;
            var draftTrack = ReleaseImportDraftTrack.CreateExternalMetadata(
                collectionId,
                draft.Id,
                trackId,
                ToTrackFields(
                    providerTrack,
                    index + 1,
                    providerRelease.Year,
                    mode,
                    selectedTrackId,
                    isBound));
            if (isBound)
            {
                if (recordingSource is not null && musicBrainzRow is not null)
                {
                    draftTrack.UnionAuthoritativeExternalSources(
                    [
                        recordingSource,
                    ExternalReleaseProviderReferenceFactory.MusicBrainzTrack(Guid.Parse(musicBrainzRow.TrackMbid))
                    ]);
                }
                boundDraftTrack = draftTrack;
            }

            _ = _context.ReleaseImportDraftTracks.Add(draftTrack);
        }
        if (boundDraftTrack is null)
        {
            throw new DomainException("import.external_binding_stale", "The external release row is stale");
        }

        SelectedOriginalBinding binding = BuildSelectedBinding(
            sourceTrackId, boundDraftTrack.Id, recordingSource, releaseRoute, musicBrainzRow, discogsRow);
        if (musicBrainzRow is null)
        {
            boundDraftTrack.UnionAuthoritativeExternalSources(binding.TrackSources);
        }

        var relationCode = TrackRelationTypeCodeValue.From(
            request.ReviewedRelationTypeCode.Normalize().Trim());
        session.UpdateCounts(1, providerRelease.Tracklist.Count, 0, 0, now);
        try
        {
            await using IDbContextTransaction transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            _ = await _context.SaveChangesAsync(cancellationToken);

            draft.InitializeExternalReview(
                binding,
                InferWantedIntent(providerRelease.Formats),
                boundDraftTrack);
            var suggestion = ReleaseImportRelationSuggestion.CreateRequired(
                collectionId,
                session.Id,
                draft.Id,
                ReleaseImportRelationSuggestionId.New(),
                "external-original",
                100,
                new ReleaseImportRelationSuggestionPayload(
                    ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(sourceTrackId),
                    ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(boundDraftTrack.Id),
                    relationCode.Value));
            _ = _context.ReleaseImportRelationSuggestions.Add(suggestion);
            _ = await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return session;
        }
        catch (ResourceConflictException exception) when (exception.Conflict == ResourceConflictException.IntegrityConstraint)
        {
            _context.ChangeTracker.Clear();
            ReleaseImportSession? winner = await FindIdempotentSessionAsync(
                collectionId,
                idempotencyKey,
                cancellationToken);
            if (winner is null)
            {
                throw;
            }

            return EnsureIdempotencyReplay(winner, fingerprint);
        }
    }
}
