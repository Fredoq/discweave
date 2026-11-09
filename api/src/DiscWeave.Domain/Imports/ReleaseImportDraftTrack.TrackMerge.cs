using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraftTrack
{
    public bool RetargetMergedTrack(IReadOnlySet<TrackId> duplicateIds, TrackId keeperId)
    {
        if (SelectedTrackId is not { } selected || !duplicateIds.Contains(selected))
        {
            return false;
        }

        SelectedTrackId = keeperId;
        return true;
    }
}
