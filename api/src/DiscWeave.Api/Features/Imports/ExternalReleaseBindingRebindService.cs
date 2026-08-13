using DiscWeave.Application.Catalog;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseBindingRebindService
{
    private const string RelationSuggestionToken = "external-original";

    private readonly DiscWeaveDbContext _context;
    private readonly IExternalReleaseBindingValidator _bindingValidator;
    private readonly IExternalSourceLookup _sourceLookup;

    public ExternalReleaseBindingRebindService(
        DiscWeaveDbContext context,
        IExternalReleaseBindingValidator bindingValidator,
        IExternalSourceLookup sourceLookup)
    {
        _context = context;
        _bindingValidator = bindingValidator;
        _sourceLookup = sourceLookup;
    }

    public Task<ReleaseImportSession?> RebindMusicBrainzAsync(
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        ExternalMusicBrainzBindingRebindRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(request.MusicBrainzRow);
        return RebindAsync(
            collectionId,
            sessionId,
            draftId,
            request.ExpectedReviewRevision,
            request.RecordingMbid,
            request.MusicBrainzRow,
            null,
            cancellationToken);
    }

    public Task<ReleaseImportSession?> RebindDiscogsAsync(
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        ExternalDiscogsBindingRebindRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(request.MusicBrainzRow);
        ArgumentNullException.ThrowIfNull(request.DiscogsRoute);
        return RebindAsync(
            collectionId,
            sessionId,
            draftId,
            request.ExpectedReviewRevision,
            request.RecordingMbid,
            request.MusicBrainzRow,
            request.DiscogsRoute,
            cancellationToken);
    }

    private async Task<ReleaseImportSession?> RebindAsync( // NOSONAR: this private orchestration method mirrors the rebind workflow context.
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        long expectedRevision,
        Guid recordingMbid,
        MusicBrainzReleaseRowLocatorRequest musicBrainzRowRequest,
        DiscogsReleaseRouteRequest? discogsRouteRequest,
        CancellationToken cancellationToken)
    {
        if (expectedRevision < 0 || recordingMbid == Guid.Empty)
        {
            throw InvalidRequest();
        }

        ReleaseImportSessionId typedSessionId = new(sessionId);
        ReleaseImportDraftId typedDraftId = new(draftId);
        ReleaseImportSession? session = await _context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.Id == typedSessionId,
            cancellationToken);
        ReleaseImportDraft? draft = await _context.ReleaseImportDrafts.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId &&
                candidate.SessionId == typedSessionId &&
                candidate.Id == typedDraftId,
            cancellationToken);
        if (session is null || draft is null)
        {
            return null;
        }

        if (draft.SourceKind != ReleaseImportSourceKind.ExternalMetadata ||
            draft.ExternalReviewRevision != expectedRevision)
        {
            throw RevisionConflict();
        }

        if (draft.SelectedOriginalBinding is not PresentOptionalValue<SelectedOriginalBinding> currentBinding)
        {
            throw new DomainException(
                "import.external_binding_stale",
                "External original binding is missing");
        }

        ReleaseImportDraftTrack boundRow = await _context.ReleaseImportDraftTracks.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId &&
                candidate.DraftId == typedDraftId &&
                candidate.Id == currentBinding.Value.DraftTrackId,
            cancellationToken) ?? throw new DomainException(
                "import.external_binding_stale",
                "External original binding row is missing");

        var musicBrainzRow = MusicBrainzReleaseRowLocator.Create(
            musicBrainzRowRequest.ReleaseMbid.ToString("D"),
            musicBrainzRowRequest.MediumPosition,
            musicBrainzRowRequest.TrackMbid.ToString("D"));
        ReleaseImportProviderReference recordingSource =
            ExternalReleaseProviderReferenceFactory.MusicBrainzRecording(recordingMbid);
        DiscogsReleaseRowLocator? discogsRow = discogsRouteRequest is null
            ? null
            : DiscogsReleaseRowLocator.Create(
                discogsRouteRequest.ReleaseId,
                discogsRouteRequest.RowOrdinal,
                discogsRouteRequest.Position,
                discogsRouteRequest.Fingerprint);
        ExternalReleaseBindingValidationResult validation = discogsRow is null
            ? await _bindingValidator.ValidateMusicBrainzRebindAsync(recordingSource, musicBrainzRow, cancellationToken)
            : await _bindingValidator.ValidateDiscogsRebindAsync(recordingSource, musicBrainzRow, discogsRow, cancellationToken);
        return await ApplyValidatedRebindAsync(
            collectionId,
            session,
            draft,
            currentBinding.Value,
            boundRow,
            recordingSource,
            musicBrainzRow,
            discogsRow,
            validation,
            cancellationToken);
    }

    private async Task<ReleaseImportSession> ApplyValidatedRebindAsync( // NOSONAR: the validated rebind requires all persistence context values.
        CollectionId collectionId,
        ReleaseImportSession session,
        ReleaseImportDraft draft,
        SelectedOriginalBinding currentBinding,
        ReleaseImportDraftTrack boundRow,
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        DiscogsReleaseRowLocator? discogsRow,
        ExternalReleaseBindingValidationResult validation,
        CancellationToken cancellationToken)
    {
        if (validation is ExternalReleaseBindingValidationResult.ProviderFailed failed)
        {
            throw new ExternalReleaseProviderFailureException(failed.Status);
        }

        if (validation is not ExternalReleaseBindingValidationResult.MusicBrainzValid and
            not ExternalReleaseBindingValidationResult.DiscogsBackedValid)
        {
            throw new DomainException(validation.Code, "The proposed external original binding is no longer valid");
        }

        ReleaseImportProviderReference musicBrainzRelease =
            ExternalReleaseProviderReferenceFactory.MusicBrainzRelease(Guid.Parse(musicBrainzRow.ReleaseMbid));
        ExternalReleaseRoute route = discogsRow is null
            ? ExternalReleaseRoute.CreateMusicBrainz(musicBrainzRelease)
            : ExternalReleaseRoute.CreateDiscogsBacked(
                musicBrainzRelease,
                ExternalReleaseProviderReferenceFactory.DiscogsRelease(discogsRow.ReleaseId));
        SelectedOriginalBinding replacement = discogsRow is null
            ? SelectedOriginalBinding.CreateMusicBrainz(
                currentBinding.SourceTrackId,
                currentBinding.DraftTrackId,
                recordingSource,
                route,
                musicBrainzRow,
                false)
            : SelectedOriginalBinding.CreateDiscogsBacked(
                currentBinding.SourceTrackId,
                currentBinding.DraftTrackId,
                recordingSource,
                route,
                musicBrainzRow,
                discogsRow,
                false);

        ReleaseImportLocalProvenanceSelection selection = await RebuildSelectionAsync(
            collectionId,
            replacement,
            cancellationToken);
        draft.AuthoritativelyRebindSelectedOriginal(replacement, boundRow, selection);
        ReleaseImportRelationSuggestion? relationSuggestion = await _context.ReleaseImportRelationSuggestions.SingleOrDefaultAsync(
            suggestion => suggestion.CollectionId == collectionId &&
                suggestion.SessionId == draft.SessionId &&
                suggestion.DraftId == draft.Id &&
                suggestion.Token == RelationSuggestionToken,
            cancellationToken);
        relationSuggestion?.Reset();
        _ = await _context.SaveChangesAsync(cancellationToken);
        return session;
    }

    private async Task<ReleaseImportLocalProvenanceSelection> RebuildSelectionAsync(
        CollectionId collectionId,
        SelectedOriginalBinding binding,
        CancellationToken cancellationToken)
    {
        var selection = ReleaseImportLocalProvenanceSelection.Empty();
        IReadOnlyList<Release> releases = await _sourceLookup.FindReleasesAsync(
            collectionId,
            ReleaseIdentities(binding),
            cancellationToken);
        if (releases.Count == 1)
        {
            selection = selection.WithRelease(releases[0].Id);
        }

        IReadOnlyList<Track> tracks = await _sourceLookup.FindTracksAsync(
            collectionId,
            TrackIdentities(binding),
            cancellationToken);
        return tracks.Count == 1
            ? selection.WithTrack(tracks[0].Id)
            : selection;
    }

    private static List<ExternalSourceLookupIdentity> ReleaseIdentities(
        SelectedOriginalBinding binding)
    {
        List<ExternalSourceLookupIdentity> identities =
        [
            ExternalSourceLookupIdentity.Create(
                binding.ReleaseRoute.MusicBrainzRelease.ProviderCode,
                binding.ReleaseRoute.MusicBrainzRelease.ResourceType,
                binding.ReleaseRoute.MusicBrainzRelease.ExternalId)
        ];
        _ = binding.ReleaseRoute.DiscogsRelease.Match(
            source =>
            {
                identities.Add(ExternalSourceLookupIdentity.Create(
                    source.ProviderCode,
                    source.ResourceType,
                    source.ExternalId));
                return true;
            },
            () => true);
        return identities;
    }

    private static IReadOnlyCollection<ExternalSourceLookupIdentity> TrackIdentities(
        SelectedOriginalBinding binding)
    {
        return
        [
            ExternalSourceLookupIdentity.Create(
                binding.RecordingSource.ProviderCode,
                binding.RecordingSource.ResourceType,
                binding.RecordingSource.ExternalId),
            ExternalSourceLookupIdentity.Create(
                "musicbrainz",
                "track",
                binding.MusicBrainzRow.TrackMbid)
        ];
    }

    private static DomainException InvalidRequest()
    {
        return new DomainException(
            "import.external_request_invalid",
            "External binding rebind request is invalid");
    }

    private static DomainException RevisionConflict()
    {
        return new DomainException(
            "import.review_revision_conflict",
            "External review revision is stale");
    }
}
