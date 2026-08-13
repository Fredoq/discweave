namespace DiscWeave.Api.Features.Tracks;

public sealed record DiscogsOriginalRouteRetryRequest
{
    public required ContextData RetryContext { get; init; }

    public sealed record ContextData
    {
        public required ExternalOriginalCandidateSourceResponse RecordingSource
        {
            get;
            init;
        }

        public required IReadOnlyList<ItemData> Items { get; init; }
    }

    public sealed record ItemData
    {
        public required RouteData Route { get; init; }

        public required ReleaseData MusicBrainzRelease { get; init; }
    }

    public sealed record RouteData
    {
        public required ExternalOriginalCandidateSourceResponse ReleaseSource
        {
            get;
            init;
        }

        public required ExternalOriginalCandidateSourceResponse ReleaseGroupSource { get; init; }

        public required string Title { get; init; }

        public ExternalOriginalCandidatePartialDateResponse? Date { get; init; }

        public required string MediumPosition { get; init; }

        public required string MusicBrainzTrackMbid { get; init; }

        public required bool ReleaseGroupRerecordingContext { get; init; }

        public required IReadOnlyList<ExternalOriginalCandidateSourceResponse> RelatedReleaseSources { get; init; }
    }

    public sealed record ReleaseData
    {
        public required ExternalOriginalCandidateSourceResponse Source
        {
            get;
            init;
        }

        public required string Title { get; init; }

        public required IReadOnlyList<string> Artists { get; init; }

        public PartialDateData? ReleaseDateEvidence { get; init; }

        public required IReadOnlyList<string> Labels { get; init; }

        public required IReadOnlyList<TrackData> Tracklist { get; init; }

        public required IReadOnlyList<IdentifierData> Identifiers { get; init; }

        public string? CatalogNumber { get; init; }

        public required IReadOnlyList<ExternalOriginalCandidateSourceResponse> RelatedSources { get; init; }

        public required bool TracklistComplete { get; init; }
    }

    public sealed record PartialDateData
    {
        public required string Kind { get; init; }

        public required int Year { get; init; }

        public int? Month { get; init; }

        public int? Day { get; init; }
    }

    public sealed record TrackData
    {
        public required string Title { get; init; }

        public string? Position { get; init; }

        public long? DurationMilliseconds { get; init; }

        public required IReadOnlyList<string> Artists { get; init; }

        public string? Disc { get; init; }

        public string? Side { get; init; }

        public required IReadOnlyList<ExternalOriginalCandidateSourceResponse> ExternalSources { get; init; }
    }

    public sealed record IdentifierData
    {
        public required string Type { get; init; }

        public required string Value { get; init; }
    }
}
