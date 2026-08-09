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
    public IReadOnlyList<string> Artists { get; init; } = [];
    public IReadOnlyList<string> Labels { get; init; } = [];
    public IReadOnlyList<string> Formats { get; init; } = [];
    public string? CatalogNumber { get; init; }
    public string? TrackTitle { get; init; }
    public string? TrackPosition { get; init; }
    public TimeSpan? TrackDuration { get; init; }
}
