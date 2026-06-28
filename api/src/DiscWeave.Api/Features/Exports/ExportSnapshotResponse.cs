using DiscWeave.Api.Features.ArtistRelations;
using DiscWeave.Api.Features.Artists;
using DiscWeave.Api.Features.Credits;
using DiscWeave.Api.Features.Labels;
using DiscWeave.Api.Features.OwnedItems;
using DiscWeave.Api.Features.Playlists;
using DiscWeave.Api.Features.Ratings;
using DiscWeave.Api.Features.Releases;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Api.Features.Tracks;
using System.Text.Json.Serialization;

namespace DiscWeave.Api.Features.Exports;

public sealed record ExportSnapshotResponse
{
    public int FormatVersion { get; init; }

    public IReadOnlyList<ArtistResponse> Artists { get; init; } = [];

    public IReadOnlyList<LabelResponse> Labels { get; init; } = [];

    public IReadOnlyList<ReleaseResponse> Releases { get; init; } = [];

    public IReadOnlyList<TrackResponse> Tracks { get; init; } = [];

    public IReadOnlyList<OwnedItemResponse> OwnedItems { get; init; } = [];

    public IReadOnlyList<LocalAudioFileExportResponse> LocalAudioFiles { get; init; } = [];

    public IReadOnlyList<DigitalTrackFileLinkExportResponse> DigitalTrackFileLinks { get; init; } = [];

    public IReadOnlyList<PlaylistResponse> Playlists { get; init; } = [];

    public IReadOnlyList<CreditResponse> Credits { get; init; } = [];

    public IReadOnlyList<ArtistRelationResponse> ArtistRelations { get; init; } = [];

    public IReadOnlyList<TrackRelationResponse> TrackRelations { get; init; } = [];

    public IReadOnlyList<DictionaryEntryResponse> Dictionaries { get; init; } = [];

    public IReadOnlyList<ImportPatternResponse> ImportPatterns { get; init; } = [];

    public IReadOnlyList<NamingProfileResponse> NamingProfiles { get; init; } = [];

    public IReadOnlyList<TagRoleMappingResponse> TagRoleMappings { get; init; } = [];

    public TrackStackSettingsResponse? TrackStackSettings { get; init; }

    public IReadOnlyList<TrackRelationParserRuleResponse> TrackRelationParserRules { get; init; } = [];

    public IReadOnlyList<ReleaseNamingOverrideResponse> ReleaseNamingOverrides { get; init; } = [];

    public IReadOnlyList<RatingCriterionResponse> RatingCriteria { get; init; } = [];

    public IReadOnlyList<RatingValueResponse> Ratings { get; init; } = [];

    [JsonIgnore]
    public IReadOnlyList<ReviewReportItemResponse> ReviewReportItems { get; init; } = [];
}

public sealed record LocalAudioFileExportResponse(
    Guid Id,
    string Path,
    string? Format,
    string? Codec,
    string? Quality,
    long? SizeBytes,
    DateTimeOffset? ModifiedAt,
    string? ContentHash,
    int? DurationSeconds,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels);

public sealed record DigitalTrackFileLinkExportResponse(
    Guid Id,
    Guid DigitalOwnedItemId,
    Guid ReleaseTrackId,
    Guid LocalAudioFileId);

public sealed record ReviewReportItemResponse(
    string Category,
    string Subtype,
    string Title,
    string SourceDetector,
    string TargetKind,
    Guid TargetId,
    string TargetTitle,
    string? TargetSubtitle);
