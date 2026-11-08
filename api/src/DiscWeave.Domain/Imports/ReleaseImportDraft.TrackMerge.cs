using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    public bool RetargetMergedTrackReferences(
        IReadOnlySet<TrackId> duplicateIds,
        TrackId keeperId,
        bool dependentReferencesChanged)
    {
        HydrateExternalReviewState();
        bool sourceChanged = _bindingSourceTrackId is { } source && duplicateIds.Contains(source);
        bool selectionChanged = _selectedTrackId is { } selected && duplicateIds.Contains(selected);
        if (!sourceChanged && !selectionChanged && !dependentReferencesChanged)
        {
            return false;
        }

        long? nextRevision = SourceKind == ReleaseImportSourceKind.ExternalMetadata
            ? NextExternalReviewRevision()
            : null;

        // A merge changes identity, not the provider evidence or historical import request.
        // Rehydrate the cached binding so its typed variants retain their exact provider row.
        if (sourceChanged)
        {
            _bindingSourceTrackId = keeperId;
            _selectedOriginalBinding = RehydrateBinding();
        }

        if (selectionChanged)
        {
            _selectedTrackId = keeperId;
            _localProvenanceSelection = RehydrateLocalProvenanceSelection();
        }

        if (nextRevision is { } revision)
        {
            CommitExternalReviewRevision(revision);
        }

        return true;
    }
}
