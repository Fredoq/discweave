using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private const string CreateTrackMode = "create";
    private const string LinkTrackMode = "link";
    private const string ReleaseOnlyTrackMode = "releaseOnly";

    private static string NormalizeTrackMode(ReleaseTrackRequest trackRequest)
    {
        string? rawMode = string.IsNullOrWhiteSpace(trackRequest.TrackMode)
            ? DefaultTrackMode(trackRequest)
            : trackRequest.TrackMode.Trim();

        return rawMode switch
        {
            CreateTrackMode => trackRequest.TrackId is null
                ? CreateTrackMode
                : throw new DomainException("release_track.track_mode_invalid", "Release track create mode must not include trackId"),
            LinkTrackMode => LinkTrackMode,
            ReleaseOnlyTrackMode => trackRequest.TrackId is null
                ? ReleaseOnlyTrackMode
                : throw new DomainException("release_track.track_mode_invalid", "Release-only tracklist row must not include trackId"),
            _ => throw new DomainException("release_track.track_mode_invalid", "Release track mode is invalid")
        };
    }

    private static string DefaultTrackMode(ReleaseTrackRequest trackRequest)
    {
        return trackRequest.TrackId.HasValue ? LinkTrackMode : CreateTrackMode;
    }

    private static void EnsureExistingTrackRequestHasNoExternalSources(ReleaseTrackRequest trackRequest)
    {
        if (trackRequest.ExternalSources is { Count: > 0 })
        {
            throw new DomainException(
                "release_track.external_sources_shape_invalid",
                "Release track with trackId must not include externalSources");
        }
    }

    private static void EnsureTracklistHasNoDuplicateTrackIds(IReadOnlyList<ReleaseTrackRequest> trackRequests)
    {
        var requestedTrackIds = new HashSet<Guid>();
        foreach (ReleaseTrackRequest trackRequest in trackRequests)
        {
            if (trackRequest.TrackId is { } trackId && !requestedTrackIds.Add(trackId))
            {
                throw new DomainException(
                    "release_track.track_duplicate",
                    "Release tracklist contains duplicate track entries");
            }
        }
    }
}
