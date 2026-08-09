using System.Text.Json.Serialization;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
#pragma warning disable CA1812
#pragma warning disable CA1805
    private sealed class RecordingSearchResponse
    {
        public int? Count { get; init; } = null;
        public List<RecordingDto>? Recordings { get; init; } = null;
    }

    private sealed class RecordingDto
    {
        public string? Id { get; init; } = null;
        public string? Title { get; init; } = null;
        public int? Score { get; init; } = null;
        public int? Length { get; init; } = null;

        [JsonPropertyName("artist-credit")]
        public List<ArtistCreditDto>? ArtistCredit { get; init; } = null;

        public List<RelationDto>? Relations { get; init; } = null;
    }

    private sealed class ArtistCreditDto
    {
        public string? Name { get; init; } = null;
        public ArtistDto? Artist { get; init; } = null;
    }

    private sealed class ArtistDto
    {
        public string? Id { get; init; } = null;
        public string? Name { get; init; } = null;
    }

    private sealed class RelationDto
    {
        [JsonPropertyName("type-id")]
        public string? TypeId { get; init; } = null;

        public string? Type { get; init; } = null;
        public string? Direction { get; init; } = null;

        [JsonPropertyName("target-type")]
        public string? TargetType { get; init; } = null;

        public RecordingDto? Recording { get; init; } = null;
        public WorkDto? Work { get; init; } = null;

        [JsonPropertyName("release-group")]
        public ReleaseGroupDto? ReleaseGroup { get; init; } = null;

        public UrlDto? Url { get; init; } = null;
        public List<string>? Attributes { get; init; } = null;

        [JsonPropertyName("attribute-ids")]
        public Dictionary<string, string>? AttributeIds { get; init; } = null;
    }

    private sealed class WorkDto
    {
        public string? Id { get; init; } = null;
        public string? Title { get; init; } = null;
        public List<RelationDto>? Relations { get; init; } = null;
    }

    private sealed class ReleaseGroupSearchResponse
    {
        public int? Count { get; init; } = null;

        [JsonPropertyName("release-groups")]
        public List<ReleaseGroupDto>? ReleaseGroups { get; init; } = null;
    }

    private sealed class ReleasePageResponse
    {
        [JsonPropertyName("release-count")]
        public int? ReleaseCount { get; init; } = null;

        [JsonPropertyName("release-offset")]
        public int? ReleaseOffset { get; init; } = null;

        public int? Count { get; init; } = null;
        public List<ReleaseDto>? Releases { get; init; } = null;
    }

    private sealed class ReleaseDto
    {
        public string? Id { get; init; } = null;
        public string? Title { get; init; } = null;
        public string? Date { get; init; } = null;
        public string? Barcode { get; init; } = null;
        public string? Status { get; init; } = null;
        public string? Country { get; init; } = null;

        [JsonPropertyName("artist-credit")]
        public List<ArtistCreditDto>? ArtistCredit { get; init; } = null;

        [JsonPropertyName("label-info")]
        public List<LabelInfoDto>? LabelInfo { get; init; } = null;

        [JsonPropertyName("release-group")]
        public ReleaseGroupDto? ReleaseGroup { get; init; } = null;

        public List<MediumDto>? Media { get; init; } = null;
        public List<RelationDto>? Relations { get; init; } = null;
    }

    private sealed class LabelInfoDto
    {
        [JsonPropertyName("catalog-number")]
        public string? CatalogNumber { get; init; } = null;

        public LabelDto? Label { get; init; } = null;
    }

    private sealed class LabelDto
    {
        public string? Id { get; init; } = null;
        public string? Name { get; init; } = null;
    }

    private sealed class ReleaseGroupDto
    {
        public string? Id { get; init; } = null;
        public string? Title { get; init; } = null;

        [JsonPropertyName("primary-type")]
        public string? PrimaryType { get; init; } = null;

        [JsonPropertyName("secondary-types")]
        public List<string>? SecondaryTypes { get; init; } = null;

        public List<RelationDto>? Relations { get; init; } = null;
    }

    private sealed class MediumDto
    {
        public int? Position { get; init; } = null;
        public string? Format { get; init; } = null;
        public List<TrackDto>? Tracks { get; init; } = null;
    }

    private sealed class TrackDto
    {
        public string? Id { get; init; } = null;
        public string? Number { get; init; } = null;
        public int? Position { get; init; } = null;
        public string? Title { get; init; } = null;
        public int? Length { get; init; } = null;

        [JsonPropertyName("artist-credit")]
        public List<ArtistCreditDto>? ArtistCredit { get; init; } = null;

        public RecordingDto? Recording { get; init; } = null;
    }

    private sealed class UrlDto
    {
        public string? Resource { get; init; } = null;
    }
#pragma warning restore CA1805
#pragma warning restore CA1812
}
