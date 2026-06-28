using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static ReleaseImportTrackMode ParseTrackMode(
        string? rawTrackMode,
        TrackId? selectedTrackId,
        bool createCatalogTracksByDefault)
    {
        string mode = string.IsNullOrWhiteSpace(rawTrackMode)
            ? DefaultTrackMode(selectedTrackId, createCatalogTracksByDefault)
            : rawTrackMode.Trim();

        return mode switch
        {
            "create" => ReleaseImportTrackMode.Create,
            "link" => ReleaseImportTrackMode.Link,
            "releaseOnly" => ReleaseImportTrackMode.ReleaseOnly,
            _ => throw new DomainException("release_import.track_mode_invalid", "Release import track mode is invalid")
        };
    }

    private static string DefaultTrackMode(TrackId? selectedTrackId, bool createCatalogTracksByDefault)
    {
        return selectedTrackId.HasValue ? "link" : createCatalogTracksByDefault ? "create" : "releaseOnly";
    }

    private static bool ShouldDefaultTrackInheritance(ReleaseImportDraftTrackUpdateRequest trackRequest)
    {
        return trackRequest.ArtistCredits is not { Count: > 0 } && trackRequest.ArtistNames is not { Count: > 0 };
    }
}
