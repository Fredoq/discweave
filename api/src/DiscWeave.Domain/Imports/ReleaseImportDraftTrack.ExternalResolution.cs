using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraftTrack
{
    public void AuthoritativelySetExternalTrackResolution(TrackId? selectedTrackId)
    {
        if (SourceKind != ReleaseImportSourceKind.ExternalMetadata)
        {
            throw new DomainException(
                "release_import.external_metadata_required",
                "External track resolution requires an external metadata row");
        }

        TrackMode = selectedTrackId.HasValue
            ? ReleaseImportTrackMode.Link
            : ReleaseImportTrackMode.Create;
        SelectedTrackId = selectedTrackId;
    }
}
