using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static DiscogsOriginalRouteRetryRequest.ContextData
        ToRetryContextResponse(DiscogsRouteRetryContext context)
    {
        return new DiscogsOriginalRouteRetryRequest.ContextData
        {
            RecordingSource = ToExternalResponse(context.RecordingSource),
            Items =
            [
                .. context.Items.Select(item =>
                    new DiscogsOriginalRouteRetryRequest.ItemData
                    {
                        Route = ToRetryRouteResponse(item.Route),
                        MusicBrainzRelease =
                            ToRetryReleaseResponse(
                                item.MusicBrainzRelease)
                    })
            ]
        };
    }

    private static DiscogsOriginalRouteRetryRequest.RouteData
        ToRetryRouteResponse(RecordingReleaseRoute route)
    {
        return new DiscogsOriginalRouteRetryRequest.RouteData
        {
            ReleaseSource = ToExternalResponse(route.ReleaseSource),
            ReleaseGroupSource =
                ToExternalResponse(route.ReleaseGroupSource),
            Title = route.Title,
            Date = route.Date is { } date
                ? new ExternalOriginalCandidatePartialDateResponse
                {
                    Year = date.Year,
                    Month = date.Month,
                    Day = date.Day
                }
                : null,
            MediumPosition = route.MediumPosition,
            MusicBrainzTrackMbid = route.MusicBrainzTrackMbid,
            ReleaseGroupRerecordingContext =
                route.ReleaseGroupRerecordingContext,
            RelatedReleaseSources =
            [
                .. route.RelatedReleaseSources.Select(ToExternalResponse)
            ]
        };
    }

    private static DiscogsOriginalRouteRetryRequest.ReleaseData
        ToRetryReleaseResponse(ExternalMetadataReleaseDetail release)
    {
        return new DiscogsOriginalRouteRetryRequest.ReleaseData
        {
            Source = ToExternalResponse(release.Source),
            Title = release.Title,
            Artists = release.Artists,
            ReleaseDateEvidence =
                ToRetryDateResponse(release.ReleaseDateEvidence),
            Labels = release.Labels,
            Tracklist =
            [
                .. release.Tracklist.Select(track =>
                    new DiscogsOriginalRouteRetryRequest.TrackData
                    {
                        Title = track.Title,
                        Position = track.Position,
                        DurationMilliseconds = track.Duration is { } duration
                            ? checked((long)duration.TotalMilliseconds)
                            : null,
                        Artists = track.Artists,
                        Disc = track.Disc,
                        Side = track.Side,
                        ExternalSources =
                        [
                            .. track.ExternalSources.Select(
                                ToExternalResponse)
                        ]
                    })
            ],
            Identifiers =
            [
                .. release.Identifiers.Select(identifier =>
                    new DiscogsOriginalRouteRetryRequest.IdentifierData
                    {
                        Type = identifier.Type,
                        Value = identifier.Value
                    })
            ],
            CatalogNumber = release.CatalogNumber,
            RelatedSources =
            [
                .. release.RelatedSources.Select(ToExternalResponse)
            ],
            TracklistComplete = release.TracklistComplete
        };
    }

    private static DiscogsOriginalRouteRetryRequest.PartialDateData?
        ToRetryDateResponse(
            IOptionalValue<ExternalMetadataPartialDate> evidence)
    {
        return evidence is
            PresentOptionalValue<ExternalMetadataPartialDate> present
                ? present.Value switch
                {
                    ExternalMetadataPartialDate.YearOnly year =>
                        new DiscogsOriginalRouteRetryRequest.PartialDateData
                        {
                            Kind = "year",
                            Year = year.Year
                        },
                    ExternalMetadataPartialDate.YearMonth month =>
                        new DiscogsOriginalRouteRetryRequest.PartialDateData
                        {
                            Kind = "yearMonth",
                            Year = month.Year,
                            Month = month.Month
                        },
                    ExternalMetadataPartialDate.FullDate date =>
                        new DiscogsOriginalRouteRetryRequest.PartialDateData
                        {
                            Kind = "fullDate",
                            Year = date.Year,
                            Month = date.Month,
                            Day = date.Day
                        },
                    _ => throw new InvalidOperationException(
                        "Unknown external metadata partial date type")
                }
                : null;
    }
}
