using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraftTrack
{
    public void SetIsOriginal(bool value)
    {
        if (SourceKind == ReleaseImportSourceKind.ExternalMetadata)
        {
            throw new DomainException(
                "release_import.external_binding_read_only",
                "External row original review must be edited through the release import draft");
        }

        IsOriginal = value;
    }

    internal bool ApplyExternalIsOriginal(bool value)
    {
        bool changed = IsOriginal != value;
        IsOriginal = value;
        return changed;
    }
}
