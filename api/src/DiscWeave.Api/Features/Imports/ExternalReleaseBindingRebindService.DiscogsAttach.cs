using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseBindingRebindService
{
    public async Task<ReleaseImportSession?> AttachDiscogsReleaseAsync(
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        ExternalDiscogsReleaseAttachRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.ExpectedReviewRevision < 0 || string.IsNullOrWhiteSpace(request.ReleaseId))
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
            draft.ExternalReviewRevision != request.ExpectedReviewRevision)
        {
            throw RevisionConflict();
        }

        if (draft.SelectedOriginalBinding is not PresentOptionalValue<SelectedOriginalBinding> currentBinding)
        {
            throw new DomainException(
                "import.external_binding_stale",
                "External original binding is missing");
        }

        if (currentBinding.Value.RecordingSource is null || currentBinding.Value.MusicBrainzRow is null)
        {
            throw new DomainException("import.external_request_invalid", "Discogs-only bindings cannot attach a MusicBrainz-backed route");
        }

        ReleaseImportDraftTrack boundRow = await _context.ReleaseImportDraftTracks.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId &&
                candidate.DraftId == typedDraftId &&
                candidate.Id == currentBinding.Value.DraftTrackId,
            cancellationToken) ?? throw new DomainException(
                "import.external_binding_stale",
                "External original binding row is missing");
        ExternalReleaseBindingValidationResult validation =
            await _bindingValidator.ValidateDiscogsReleaseAttachAsync(
                currentBinding.Value.RecordingSource,
                currentBinding.Value.MusicBrainzRow,
                request.ReleaseId,
                cancellationToken);
        DiscogsReleaseRowLocator? locator = validation is ExternalReleaseBindingValidationResult.DiscogsBackedValid valid
            ? valid.Locator
            : null;
        return await ApplyValidatedRebindAsync(
            collectionId,
            session,
            draft,
            currentBinding.Value,
            boundRow,
            currentBinding.Value.RecordingSource,
            currentBinding.Value.MusicBrainzRow,
            locator,
            validation,
            cancellationToken);
    }
}
