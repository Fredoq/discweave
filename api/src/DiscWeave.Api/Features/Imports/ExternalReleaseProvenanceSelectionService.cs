using DiscWeave.Application.Catalog;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed class ExternalReleaseProvenanceSelectionService
{
    private readonly DiscWeaveDbContext _context;
    private readonly IExternalSourceLookup _sourceLookup;
    private readonly IExternalReleaseBindingValidator _bindingValidator;

    public ExternalReleaseProvenanceSelectionService(
        DiscWeaveDbContext context,
        IExternalSourceLookup sourceLookup,
        IExternalReleaseBindingValidator bindingValidator)
    {
        _context = context;
        _sourceLookup = sourceLookup;
        _bindingValidator = bindingValidator;
    }

    public Task<ReleaseImportSession?> SelectReleaseAsync(
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        Guid releaseId,
        ExternalReviewMutationRequest request,
        CancellationToken cancellationToken)
    {
        return SelectAsync(
            collectionId,
            sessionId,
            draftId,
            new ReleaseId(releaseId),
            null,
            request,
            cancellationToken);
    }

    public Task<ReleaseImportSession?> SelectTrackAsync(
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        Guid trackId,
        ExternalReviewMutationRequest request,
        CancellationToken cancellationToken)
    {
        return SelectAsync(
            collectionId,
            sessionId,
            draftId,
            null,
            new TrackId(trackId),
            request,
            cancellationToken);
    }

    private async Task<ReleaseImportSession?> SelectAsync( // NOSONAR: provenance selection coordinates release and track validation.
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        ReleaseId? releaseId,
        TrackId? trackId,
        ExternalReviewMutationRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.ExpectedReviewRevision < 0)
        {
            throw new DomainException(
                "import.review_revision_conflict",
                "External review revision is stale");
        }

        var typedSessionId = new ReleaseImportSessionId(sessionId);
        var typedDraftId = new ReleaseImportDraftId(draftId);
        ReleaseImportSession? session = await _context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.Id == typedSessionId,
            cancellationToken);
        ReleaseImportDraft? draft = await _context.ReleaseImportDrafts.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.SessionId == typedSessionId && candidate.Id == typedDraftId,
            cancellationToken);
        if (session is null || draft is null)
        {
            return null;
        }

        if (draft.SourceKind != ReleaseImportSourceKind.ExternalMetadata ||
            draft.ExternalReviewRevision != request.ExpectedReviewRevision)
        {
            throw new DomainException(
                "import.review_revision_conflict",
                "External review revision is stale");
        }

        if (draft.SelectedOriginalBinding is not PresentOptionalValue<SelectedOriginalBinding> binding)
        {
            throw new DomainException(
                "import.external_binding_stale",
                "External original binding is missing");
        }

        ExternalReleaseBindingValidationResult validation = await _bindingValidator.RevalidateAsync(
            binding.Value,
            cancellationToken);
        if (validation is ExternalReleaseBindingValidationResult.ProviderFailed failed)
        {
            throw new ExternalReleaseProviderFailureException(failed.Status);
        }

        if (validation.Outcome != ExternalReleaseBindingValidationOutcome.Valid)
        {
            throw new DomainException(validation.Code, "The external original binding is no longer valid");
        }

        IReadOnlyList<Release> releaseMatches = await _sourceLookup.FindReleasesAsync(
            collectionId,
            ReleaseIdentities(binding.Value),
            cancellationToken);
        IReadOnlyList<Track> trackMatches = await _sourceLookup.FindTracksAsync(
            collectionId,
            TrackIdentities(binding.Value),
            cancellationToken);
        ReleaseImportLocalProvenanceSelection selection = draft.LocalProvenanceSelection is PresentOptionalValue<ReleaseImportLocalProvenanceSelection> present
            ? present.Value
            : ReleaseImportLocalProvenanceSelection.Empty();
        if (releaseId is ReleaseId selectedRelease)
        {
            if (!releaseMatches.Any(release => release.Id == selectedRelease))
            {
                throw SelectionInvalid();
            }

            selection = selection.WithRelease(selectedRelease);
        }
        else if (trackId is TrackId selectedTrack)
        {
            if (!trackMatches.Any(track => track.Id == selectedTrack))
            {
                throw SelectionInvalid();
            }

            selection = selection.WithTrack(selectedTrack);
        }

        if (selection.SelectedReleaseId is PresentOptionalValue<ReleaseId> selectedReleaseId &&
            !releaseMatches.Any(release => release.Id == selectedReleaseId.Value))
        {
            selection = selection.WithoutRelease();
        }

        if (selection.SelectedTrackId is PresentOptionalValue<TrackId> selectedTrackId &&
            !trackMatches.Any(track => track.Id == selectedTrackId.Value))
        {
            selection = selection.WithoutTrack();
        }

        draft.AuthoritativelySetLocalProvenanceSelection(selection);

        _ = await _context.SaveChangesAsync(cancellationToken);
        return session;
    }

    private static List<ExternalSourceLookupIdentity> ReleaseIdentities(
        SelectedOriginalBinding binding)
    {
        return [.. binding.ReleaseRoute.Sources.Select(source => ExternalSourceLookupIdentity.Create(source.ProviderCode, source.ResourceType, source.ExternalId))];
    }

    private static IReadOnlyCollection<ExternalSourceLookupIdentity> TrackIdentities(
        SelectedOriginalBinding binding)
    {
        return [.. binding.TrackSources.Select(source => ExternalSourceLookupIdentity.Create(source.ProviderCode, source.ResourceType, source.ExternalId))];
    }

    private static DomainException SelectionInvalid()
    {
        return new DomainException(
            "import.external_provenance_selection_invalid",
            "Selected local provenance is not a current match");
    }
}
