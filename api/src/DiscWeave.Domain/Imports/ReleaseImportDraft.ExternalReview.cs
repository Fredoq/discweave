using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    private SelectedOriginalBinding? _selectedOriginalBinding;
    private ReleaseImportCollectionItemIntent? _collectionItemIntent;
    private ReleaseImportLocalProvenanceSelection? _localProvenanceSelection;

    public long ExternalReviewRevision { get; private set; }

    public bool IsSelectedOriginalBindingValid { get; private set; }

    public static ReleaseImportDraft CreateExternalMetadata(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId id,
        ReleaseImportLocalProvenanceSelection initialLocalProvenanceSelection)
    {
        ArgumentNullException.ThrowIfNull(initialLocalProvenanceSelection);
        var draft = new ReleaseImportDraft(
            collectionId,
            sessionId,
            id,
            ReleaseImportSourceKind.ExternalMetadata,
            null,
            null)
        {
            ExternalReviewRevision = 0
        };
        draft.PersistLocalProvenanceSelection(initialLocalProvenanceSelection);
        return draft;
    }

    public static ReleaseImportDraft CreateExternalMetadata(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId id,
        ReleaseImportDraftEditableFields initialFields,
        ReleaseImportLocalProvenanceSelection initialLocalProvenanceSelection)
    {
        ArgumentNullException.ThrowIfNull(initialFields);
        ReleaseImportDraft draft = CreateExternalMetadata(
            collectionId,
            sessionId,
            id,
            initialLocalProvenanceSelection);
        draft.ApplyInitialEditableFields(initialFields);
        return draft;
    }

    public void InitializeExternalReview(
        SelectedOriginalBinding binding,
        ReleaseImportCollectionItemIntent collectionItemIntent,
        ReleaseImportDraftTrack boundRow)
    {
        EnsureExternalEditable();
        if (_selectedOriginalBinding is not null)
        {
            throw new DomainException(
                "release_import.external_binding_read_only",
                "Selected external binding can only be replaced authoritatively");
        }

        ValidateBoundRow(binding, boundRow);
        EnsureUsableBoundRow(boundRow);
        ArgumentNullException.ThrowIfNull(collectionItemIntent);
        PersistBinding(binding);
        PersistCollectionItemIntent(collectionItemIntent);
        PersistLocalProvenanceSelection(_localProvenanceSelection ?? ReleaseImportLocalProvenanceSelection.Empty());
        IsSelectedOriginalBindingValid = true;
        _ = boundRow.ApplyExternalIsOriginal(true);
    }

    public void SetExternalCollectionItemIntent(ReleaseImportCollectionItemIntent collectionItemIntent)
    {
        EnsureExternalEditable();
        ArgumentNullException.ThrowIfNull(collectionItemIntent);
        if (!HasSameCollectionItemIntent(_collectionItemIntent, collectionItemIntent))
        {
            long nextRevision = NextExternalReviewRevision();
            PersistCollectionItemIntent(collectionItemIntent);
            CommitExternalReviewRevision(nextRevision);
        }
    }

    public void SetLinkedTargetPromotionConfirmation(
        ReleaseImportDraftTrack boundRow,
        bool confirmed)
    {
        EnsureExternalEditable();
        SelectedOriginalBinding binding = _selectedOriginalBinding ?? throw new DomainException(
            "release_import.external_binding_required",
            "Selected external binding is required before promotion review");
        ValidateBoundRow(binding, boundRow);
        if (boundRow.TrackMode != ReleaseImportTrackMode.Link)
        {
            throw new DomainException(
                "release_import.external_binding_link_required",
                "Only a linked selected row can confirm target promotion");
        }

        if (binding.PromoteLinkedTargetConfirmed != confirmed)
        {
            long nextRevision = NextExternalReviewRevision();
            PersistBinding(binding.WithPromoteLinkedTargetConfirmation(confirmed));
            CommitExternalReviewRevision(nextRevision);
        }
    }

    public void SetExternalTrackIsOriginal(ReleaseImportDraftTrack row, bool value)
    {
        EnsureExternalEditable();
        ValidateOwnedRow(row);
        if (row.IsOriginal != value)
        {
            long nextRevision = NextExternalReviewRevision();
            _ = row.ApplyExternalIsOriginal(value);
            CommitExternalReviewRevision(nextRevision);
        }
    }

    public void ApplyExternalTrackReviewEdit(
        ReleaseImportDraftTrack row,
        DraftTrackEditableFields fields)
    {
        EnsureExternalEditable();
        ValidateOwnedRow(row);
        ArgumentNullException.ThrowIfNull(fields);

        if (!row.WouldExternalReviewEditChange(fields))
        {
            return;
        }

        long nextRevision = NextExternalReviewRevision();
        bool isBound = _selectedOriginalBinding?.DraftTrackId == row.Id;
        int? previousPosition = row.Position;
        bool previousSkipped = row.IsSkipped;
        ReleaseImportTrackMode previousMode = row.TrackMode;
        TrackId? previousSelectedTrackId = row.SelectedTrackId;
        _ = row.ApplyExternalReviewEdit(fields);

        if (isBound &&
            (previousPosition != row.Position ||
             previousSkipped != row.IsSkipped ||
             previousMode != row.TrackMode ||
             previousSelectedTrackId != row.SelectedTrackId))
        {
            _ = InvalidateBinding();
        }

        CommitExternalReviewRevision(nextRevision);
    }

    public void RecordExternalTrackDeleted(ReleaseImportDraftTrack row)
    {
        EnsureExternalEditable();
        ValidateOwnedRow(row);
        long nextRevision = NextExternalReviewRevision();
        if (_selectedOriginalBinding?.DraftTrackId == row.Id)
        {
            _ = InvalidateBinding();
        }

        CommitExternalReviewRevision(nextRevision);
    }

    public void RecordExternalTrackReordered(ReleaseImportDraftTrack row)
    {
        RecordExternalTrackDeleted(row);
    }

    public void AuthoritativelyRebindSelectedOriginal(
        SelectedOriginalBinding replacement,
        ReleaseImportDraftTrack boundRow)
    {
        EnsureExternalEditable();
        ArgumentNullException.ThrowIfNull(replacement);
        SelectedOriginalBinding current = _selectedOriginalBinding ?? throw new DomainException(
            "release_import.external_binding_required",
            "Selected external binding is required before rebind");
        if (current.SourceTrackId != replacement.SourceTrackId)
        {
            throw new DomainException(
                "release_import.external_binding_source_track_read_only",
                "External binding source track cannot be retargeted");
        }

        if (current.DraftTrackId != replacement.DraftTrackId)
        {
            throw new DomainException(
                "release_import.external_binding_draft_track_read_only",
                "External binding draft track cannot be retargeted");
        }

        ValidateBoundRow(replacement, boundRow);
        EnsureUsableBoundRow(boundRow);
        SelectedOriginalBinding normalizedReplacement = replacement.PromoteLinkedTargetConfirmed
            ? replacement.WithPromoteLinkedTargetConfirmation(false)
            : replacement;
        bool changed = !current.HasSameValueAs(normalizedReplacement) || !IsSelectedOriginalBindingValid;
        if (changed)
        {
            long nextRevision = NextExternalReviewRevision();
            bool identityChanged = !current.HasSameValueAs(normalizedReplacement);
            PersistBinding(normalizedReplacement);
            IsSelectedOriginalBindingValid = true;
            if (identityChanged)
            {
                PersistLocalProvenanceSelection(ReleaseImportLocalProvenanceSelection.Empty());
            }

            CommitExternalReviewRevision(nextRevision);
        }
    }

    public void AuthoritativelySelectLocalRelease(ReleaseId releaseId)
    {
        EnsureExternalEditable();
        ReleaseImportLocalProvenanceSelection current = CurrentSelection();
        if (!HasSelectedRelease(current, releaseId))
        {
            ReleaseImportLocalProvenanceSelection replacement = current.WithRelease(releaseId);
            long nextRevision = NextExternalReviewRevision();
            PersistLocalProvenanceSelection(replacement);
            CommitExternalReviewRevision(nextRevision);
        }
    }

    public void AuthoritativelySelectLocalTrack(TrackId trackId)
    {
        EnsureExternalEditable();
        ReleaseImportLocalProvenanceSelection current = CurrentSelection();
        if (!HasSelectedTrack(current, trackId))
        {
            ReleaseImportLocalProvenanceSelection replacement = current.WithTrack(trackId);
            long nextRevision = NextExternalReviewRevision();
            PersistLocalProvenanceSelection(replacement);
            CommitExternalReviewRevision(nextRevision);
        }
    }

    public void AuthoritativelyClearLocalRelease()
    {
        EnsureExternalEditable();
        ReleaseImportLocalProvenanceSelection current = CurrentSelection();
        if (current.SelectedReleaseId.HasValue)
        {
            ReleaseImportLocalProvenanceSelection replacement = current.WithoutRelease();
            long nextRevision = NextExternalReviewRevision();
            PersistLocalProvenanceSelection(replacement);
            CommitExternalReviewRevision(nextRevision);
        }
    }

    public void AuthoritativelyClearLocalTrack()
    {
        EnsureExternalEditable();
        ReleaseImportLocalProvenanceSelection current = CurrentSelection();
        if (current.SelectedTrackId.HasValue)
        {
            ReleaseImportLocalProvenanceSelection replacement = current.WithoutTrack();
            long nextRevision = NextExternalReviewRevision();
            PersistLocalProvenanceSelection(replacement);
            CommitExternalReviewRevision(nextRevision);
        }
    }
}
