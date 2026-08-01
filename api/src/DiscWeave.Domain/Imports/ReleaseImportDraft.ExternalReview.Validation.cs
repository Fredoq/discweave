using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    public bool IsExternalConfirmationReady(
        ReleaseImportDraftTrack boundRow,
        ReleaseImportRelationSuggestion? requiredRelation,
        IMedium? currentReuseMedium,
        bool linkedTargetIsStandalone)
    {
        bool draftAndRowReady = SourceKind == ReleaseImportSourceKind.ExternalMetadata &&
            _selectedOriginalBinding is not null &&
            IsSelectedOriginalBindingValid &&
            _collectionItemIntent is not null &&
            IsOwnedBoundRow(boundRow) &&
            !boundRow.IsSkipped &&
            boundRow.TrackMode != ReleaseImportTrackMode.ReleaseOnly;
        bool promotionReady = !linkedTargetIsStandalone ||
            boundRow.TrackMode != ReleaseImportTrackMode.Link ||
            _selectedOriginalBinding?.PromoteLinkedTargetConfirmed == true;

        return draftAndRowReady &&
            promotionReady &&
            IsCollectionItemIntentReady(_collectionItemIntent!, currentReuseMedium) &&
            IsRelationReady(requiredRelation, boundRow);
    }

    private void EnsureExternalEditable()
    {
        EnsureEditable();
        if (SourceKind != ReleaseImportSourceKind.ExternalMetadata)
        {
            throw new DomainException(
                "release_import.external_metadata_required",
                "This operation requires an external metadata import draft");
        }
    }

    private void ValidateBoundRow(SelectedOriginalBinding binding, ReleaseImportDraftTrack row)
    {
        ArgumentNullException.ThrowIfNull(binding);
        ValidateOwnedRow(row);
        if (binding.DraftTrackId != row.Id)
        {
            throw new DomainException(
                "release_import.external_binding_row_mismatch",
                "Selected binding must reference the supplied draft row");
        }
    }

    private void ValidateOwnedRow(ReleaseImportDraftTrack row)
    {
        ArgumentNullException.ThrowIfNull(row);
        if (row.CollectionId != CollectionId || row.DraftId != Id ||
            row.SourceKind != ReleaseImportSourceKind.ExternalMetadata)
        {
            throw new DomainException(
                "release_import.external_binding_row_mismatch",
                "External draft row must belong to this draft and collection");
        }
    }

    private static void EnsureUsableBoundRow(ReleaseImportDraftTrack row)
    {
        if (row.IsSkipped)
        {
            throw new DomainException(
                "release_import.external_binding_row_skipped",
                "Selected external row cannot be skipped");
        }

        if (row.TrackMode == ReleaseImportTrackMode.ReleaseOnly)
        {
            throw new DomainException(
                "release_import.external_binding_release_only",
                "Selected external row must create or link a catalog track");
        }
    }

    private bool IsOwnedBoundRow(ReleaseImportDraftTrack row)
    {
        return row is not null &&
            row.CollectionId == CollectionId &&
            row.DraftId == Id &&
            row.SourceKind == ReleaseImportSourceKind.ExternalMetadata &&
            _selectedOriginalBinding?.DraftTrackId == row.Id;
    }

    private bool InvalidateBinding()
    {
        if (_selectedOriginalBinding is null)
        {
            return false;
        }

        bool changed = IsSelectedOriginalBindingValid ||
            _selectedOriginalBinding.PromoteLinkedTargetConfirmed ||
            CurrentSelection().SelectedReleaseId.HasValue ||
            CurrentSelection().SelectedTrackId.HasValue;
        if (_selectedOriginalBinding.PromoteLinkedTargetConfirmed)
        {
            _selectedOriginalBinding = _selectedOriginalBinding.WithPromoteLinkedTargetConfirmation(false);
        }

        IsSelectedOriginalBindingValid = false;
        _localProvenanceSelection = ReleaseImportLocalProvenanceSelection.Empty();
        return changed;
    }

    private ReleaseImportLocalProvenanceSelection CurrentSelection()
    {
        return _localProvenanceSelection ?? ReleaseImportLocalProvenanceSelection.Empty();
    }

    private long NextExternalReviewRevision()
    {
        return checked(ExternalReviewRevision + 1);
    }

    private void CommitExternalReviewRevision(long nextRevision)
    {
        ExternalReviewRevision = nextRevision;
    }

    private static bool IsCollectionItemIntentReady(
        ReleaseImportCollectionItemIntent intent,
        IMedium? currentReuseMedium)
    {
        return intent switch
        {
            ReleaseImportCollectionItemIntent.NewWanted wanted => wanted.Medium.HasValue,
            ReleaseImportCollectionItemIntent.ReuseExisting reuse when currentReuseMedium is not null =>
                reuse.MatchesCurrentMedium(currentReuseMedium),
            _ => false
        };
    }

    private bool IsRelationReady(
        ReleaseImportRelationSuggestion? relation,
        ReleaseImportDraftTrack boundRow)
    {
        if (relation is null ||
            relation.ApplicationMode != ReleaseImportRelationSuggestionApplicationMode.Required ||
            relation.CollectionId != CollectionId ||
            relation.SessionId != SessionId ||
            relation.DraftId != Id ||
            _selectedOriginalBinding is null)
        {
            return false;
        }

        ReleaseImportRelationSuggestionPayload payload = relation.ReviewedPayload;
        bool endpointsMatch = payload.Source.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack &&
            payload.Source.TrackId == _selectedOriginalBinding.SourceTrackId.Value &&
            payload.Target?.Kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack &&
            payload.Target.TrackId == _selectedOriginalBinding.DraftTrackId.Value;
        return endpointsMatch && relation.Decision switch
        {
            ReleaseImportRelationSuggestionDecision.Accepted => boundRow.IsOriginal,
            ReleaseImportRelationSuggestionDecision.Rejected => true,
            ReleaseImportRelationSuggestionDecision.Pending => false,
            _ => false
        };
    }

    private static bool HasSameCollectionItemIntent(
        ReleaseImportCollectionItemIntent? current,
        ReleaseImportCollectionItemIntent replacement)
    {
        return (current, replacement) switch
        {
            (ReleaseImportCollectionItemIntent.NewWanted left,
                ReleaseImportCollectionItemIntent.NewWanted right) =>
                HasSameMedium(left.Medium, right.Medium),
            (ReleaseImportCollectionItemIntent.ReuseExisting left,
                ReleaseImportCollectionItemIntent.ReuseExisting right) =>
                left.OwnedItemId == right.OwnedItemId &&
                left.ExpectedMedium.CanonicalKey == right.ExpectedMedium.CanonicalKey,
            _ => false
        };
    }

    private static bool HasSameMedium(
        IOptionalValue<ReleaseImportMediumIntent> left,
        IOptionalValue<ReleaseImportMediumIntent> right)
    {
        return left.Match(
            leftMedium => right.Match(
                rightMedium => leftMedium.CanonicalKey == rightMedium.CanonicalKey,
                () => false),
            () => !right.HasValue);
    }

    private static bool HasSelectedRelease(
        ReleaseImportLocalProvenanceSelection selection,
        ReleaseId releaseId)
    {
        return selection.SelectedReleaseId.Match(value => value == releaseId, () => false);
    }

    private static bool HasSelectedTrack(
        ReleaseImportLocalProvenanceSelection selection,
        TrackId trackId)
    {
        return selection.SelectedTrackId.Match(value => value == trackId, () => false);
    }
}
