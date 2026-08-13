namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraftTrack
{
    internal bool WouldExternalReviewEditChange(DraftTrackEditableFields fields)
    {
        var candidate = new ReleaseImportDraftTrack(
            CollectionId,
            DraftId,
            Id,
            ReleaseImportSourceKind.ExternalMetadata,
            null);
        _ = candidate.ApplyEditableFields(fields);
        return !HasSameEditableValues(candidate);
    }

    private bool HasSameEditableValues(ReleaseImportDraftTrack other)
    {
        return Duration == other.Duration &&
            Position == other.Position &&
            Disc == other.Disc &&
            Side == other.Side &&
            Title == other.Title &&
            VersionYear == other.VersionYear &&
            InheritReleaseArtistCredits == other.InheritReleaseArtistCredits &&
            IsSkipped == other.IsSkipped &&
            TrackMode == other.TrackMode &&
            SelectedTrackId == other.SelectedTrackId &&
            _artistCreditsJson == other._artistCreditsJson &&
            _artistNamesJson == other._artistNamesJson &&
            _selectedArtistIdsJson == other._selectedArtistIdsJson &&
            _issuesJson == other._issuesJson;
    }
}
