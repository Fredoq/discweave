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
    public DiscogsReleaseRouteBindingResponse? DiscogsBinding { get; init; }
    public required bool IsPreferred { get; init; }
    public required IReadOnlyList<string> EvidenceCodes { get; init; }
}
