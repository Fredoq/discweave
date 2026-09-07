using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    public void AuthoritativelyRebindSelectedOriginal(
        SelectedOriginalBinding replacement,
        ReleaseImportDraftTrack boundRow,
        ReleaseImportLocalProvenanceSelection localProvenanceSelection)
    {
        EnsureExternalEditable();
        ArgumentNullException.ThrowIfNull(replacement);
        ArgumentNullException.ThrowIfNull(localProvenanceSelection);
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
        bool identityChanged = !current.HasSameValueAs(normalizedReplacement);
        if (identityChanged || !IsSelectedOriginalBindingValid)
        {
            long nextRevision = NextExternalReviewRevision();
            ReplaceBindingSources(current, normalizedReplacement, boundRow);
            PersistBinding(normalizedReplacement);
            PersistLocalProvenanceSelection(localProvenanceSelection);
            TrackId? selectedTrackId = localProvenanceSelection.SelectedTrackId is PresentOptionalValue<TrackId> selected
                ? selected.Value
                : null;
            boundRow.AuthoritativelySetExternalTrackResolution(selectedTrackId);
            IsSelectedOriginalBindingValid = true;
            CommitExternalReviewRevision(nextRevision);
        }
    }

    private void ReplaceBindingSources(
        SelectedOriginalBinding current,
        SelectedOriginalBinding replacement,
        ReleaseImportDraftTrack boundRow)
    {
        List<ReleaseImportProviderReference> currentReleaseSources = BindingReleaseSources(current);
        List<ReleaseImportProviderReference> replacementReleaseSources = BindingReleaseSources(replacement);
        ReplaceBindingExternalSources(currentReleaseSources, replacementReleaseSources);
        boundRow.ReplaceBindingExternalSources(
            current.TrackSources,
            replacement.TrackSources);
    }

    private static List<ReleaseImportProviderReference> BindingReleaseSources(SelectedOriginalBinding binding)
    {
        return [.. binding.ReleaseRoute.Sources];
    }

}
