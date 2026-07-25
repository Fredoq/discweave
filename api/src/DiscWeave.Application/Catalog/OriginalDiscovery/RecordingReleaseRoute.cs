using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record RecordingReleaseRoute
{
    public required ExternalMetadataSource ReleaseSource { get; init; }
    public required ExternalMetadataSource ReleaseGroupSource { get; init; }
    public required string Title { get; init; }
    public ProviderPartialDate? Date { get; init; }
    public required string MediumPosition { get; init; }
    public required string MusicBrainzTrackMbid { get; init; }
    public required bool ReleaseGroupRerecordingContext { get; init; }
    public required IReadOnlyList<ExternalMetadataSource> RelatedReleaseSources { get; init; }
}
