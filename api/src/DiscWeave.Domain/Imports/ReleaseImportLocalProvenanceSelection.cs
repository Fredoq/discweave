using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportLocalProvenanceSelection
{
    private ReleaseImportLocalProvenanceSelection(
        IOptionalValue<ReleaseId> selectedReleaseId,
        IOptionalValue<TrackId> selectedTrackId)
    {
        SelectedReleaseId = selectedReleaseId;
        SelectedTrackId = selectedTrackId;
    }

    public IOptionalValue<ReleaseId> SelectedReleaseId { get; }

    public IOptionalValue<TrackId> SelectedTrackId { get; }

    public static ReleaseImportLocalProvenanceSelection Empty()
    {
        return new ReleaseImportLocalProvenanceSelection(
            Optional.Missing<ReleaseId>(),
            Optional.Missing<TrackId>());
    }

    public ReleaseImportLocalProvenanceSelection WithRelease(ReleaseId releaseId)
    {
        EnsureId(releaseId.Value, nameof(releaseId));
        return new ReleaseImportLocalProvenanceSelection(Optional.From(releaseId), SelectedTrackId);
    }

    public ReleaseImportLocalProvenanceSelection WithTrack(TrackId trackId)
    {
        EnsureId(trackId.Value, nameof(trackId));
        return new ReleaseImportLocalProvenanceSelection(SelectedReleaseId, Optional.From(trackId));
    }

    public ReleaseImportLocalProvenanceSelection WithoutRelease()
    {
        return new ReleaseImportLocalProvenanceSelection(Optional.Missing<ReleaseId>(), SelectedTrackId);
    }

    public ReleaseImportLocalProvenanceSelection WithoutTrack()
    {
        return new ReleaseImportLocalProvenanceSelection(SelectedReleaseId, Optional.Missing<TrackId>());
    }

    private static void EnsureId(Guid id, string fieldName)
    {
        if (id == Guid.Empty)
        {
            throw new DomainException(
                "release_import.local_provenance_id_required",
                $"{fieldName} is required");
        }
    }
}
