using System.Text.Json.Serialization;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
#pragma warning disable CA1812
    private sealed class RecordingSearchResponse
    {
        public int? Count { get; init; }
        public List<RecordingDto>? Recordings { get; init; }
    }

    private sealed class RecordingDto
    {
        public string? Id { get; init; }
        public string? Title { get; init; }
        public int? Score { get; init; }
        public int? Length { get; init; }

        [JsonPropertyName("artist-credit")]
        public List<ArtistCreditDto>? ArtistCredit { get; init; }

        public List<RelationDto>? Relations { get; init; }
    }

    private sealed class ArtistCreditDto
    {
        public string? Name { get; init; }
        public ArtistDto? Artist { get; init; }
    }

    private sealed class ArtistDto
    {
        public string? Id { get; init; }
        public string? Name { get; init; }
    }

    private sealed class RelationDto
    {
        [JsonPropertyName("type-id")]
        public string? TypeId { get; init; }

        public string? Type { get; init; }
        public string? Direction { get; init; }

        [JsonPropertyName("target-type")]
        public string? TargetType { get; init; }

        public RecordingDto? Recording { get; init; }
        public WorkDto? Work { get; init; }

        [JsonPropertyName("release-group")]
        public ReleaseGroupDto? ReleaseGroup { get; init; }

        public UrlDto? Url { get; init; }
        public List<string>? Attributes { get; init; }

        [JsonPropertyName("attribute-ids")]
        public Dictionary<string, string>? AttributeIds { get; init; }
    }

    private sealed class WorkDto
    {
        public string? Id { get; init; }
        public string? Title { get; init; }
    }

    private sealed class ReleasePageResponse
    {
        [JsonPropertyName("release-count")]
        public int? ReleaseCount { get; init; }

        [JsonPropertyName("release-offset")]
        public int? ReleaseOffset { get; init; }

        public int? Count { get; init; }
        public List<ReleaseDto>? Releases { get; init; }
    }

    private sealed class ReleaseDto
    {
        public string? Id { get; init; }
        public string? Title { get; init; }
        public string? Date { get; init; }
        public string? Barcode { get; init; }

        [JsonPropertyName("artist-credit")]
        public List<ArtistCreditDto>? ArtistCredit { get; init; }

        [JsonPropertyName("label-info")]
        public List<LabelInfoDto>? LabelInfo { get; init; }

        [JsonPropertyName("release-group")]
        public ReleaseGroupDto? ReleaseGroup { get; init; }

        public List<MediumDto>? Media { get; init; }
        public List<RelationDto>? Relations { get; init; }
    }

    private sealed class LabelInfoDto
    {
        [JsonPropertyName("catalog-number")]
        public string? CatalogNumber { get; init; }

        public LabelDto? Label { get; init; }
    }

    private sealed class LabelDto
    {
        public string? Id { get; init; }
        public string? Name { get; init; }
    }

    private sealed class ReleaseGroupDto
    {
        public string? Id { get; init; }
        public string? Title { get; init; }

        [JsonPropertyName("primary-type")]
        public string? PrimaryType { get; init; }

        [JsonPropertyName("secondary-types")]
        public List<string>? SecondaryTypes { get; init; }

        public List<RelationDto>? Relations { get; init; }
    }

    private sealed class MediumDto
    {
        public int? Position { get; init; }
        public string? Format { get; init; }
        public List<TrackDto>? Tracks { get; init; }
    }

    private sealed class TrackDto
    {
        public string? Id { get; init; }
        public string? Number { get; init; }
        public int? Position { get; init; }
        public string? Title { get; init; }
        public int? Length { get; init; }

        [JsonPropertyName("artist-credit")]
        public List<ArtistCreditDto>? ArtistCredit { get; init; }

        public RecordingDto? Recording { get; init; }
    }

    private sealed class UrlDto
    {
        public string? Resource { get; init; }
    }
#pragma warning restore CA1812
}
