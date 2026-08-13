namespace DiscWeave.Api.Features.Tracks;

public sealed record ExternalOriginalCandidateReleaseRouteResponse
{
    public required ExternalOriginalCandidateSourceResponse ReleaseSource { get; init; }
    public required ExternalOriginalCandidateSourceResponse ReleaseGroupSource { get; init; }
    public required string Title { get; init; }
    public ExternalOriginalCandidatePartialDateResponse? Date { get; init; }
    public required string MediumPosition { get; init; }
    public required string MusicBrainzTrackMbid { get; init; }
    public required bool ReleaseGroupRerecordingContext { get; init; }
    public required IReadOnlyList<ExternalOriginalCandidateSourceResponse> RelatedReleaseSources { get; init; }
    public required IReadOnlyList<string> Artists { get; init; }
    public required IReadOnlyList<string> Labels { get; init; }
    public required IReadOnlyList<string> Formats { get; init; }
    public string? CatalogNumber { get; init; }
    public string? TrackTitle { get; init; }
    public string? TrackPosition { get; init; }
    public double? TrackDurationSeconds { get; init; }
    public DiscogsReleaseRouteBindingResponse? DiscogsBinding { get; init; }
    public required bool IsPreferred { get; init; }
    public required IReadOnlyList<string> EvidenceCodes { get; init; }
}
