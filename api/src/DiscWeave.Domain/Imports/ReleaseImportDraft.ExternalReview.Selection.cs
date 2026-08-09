namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    public void AuthoritativelySetLocalProvenanceSelection(
        ReleaseImportLocalProvenanceSelection selection)
    {
        EnsureExternalEditable();
        ArgumentNullException.ThrowIfNull(selection);
        ReleaseImportLocalProvenanceSelection current = CurrentSelection();
        bool sameRelease = current.SelectedReleaseId.Match(
            value => selection.SelectedReleaseId.Match(candidate => candidate == value, () => false),
            () => !selection.SelectedReleaseId.HasValue);
        bool sameTrack = current.SelectedTrackId.Match(
            value => selection.SelectedTrackId.Match(candidate => candidate == value, () => false),
            () => !selection.SelectedTrackId.HasValue);
        if (sameRelease && sameTrack)
        {
            return;
        }

        long nextRevision = NextExternalReviewRevision();
        PersistLocalProvenanceSelection(selection);
        CommitExternalReviewRevision(nextRevision);
    }
}
