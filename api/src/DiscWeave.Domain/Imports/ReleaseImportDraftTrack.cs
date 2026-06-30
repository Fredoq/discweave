using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportDraftTrack : IEntity<ReleaseImportDraftTrackId>
{
    private const int PositionMarkerMaxLength = 64;
    private const string TrackModeInvalidCode = "release_import.track_mode_invalid";

    private string _artistCreditsJson = "[]";
    private string _artistNamesJson = "[]";
    private string? _contentHash;
    private string _issuesJson = "[]";
    private string _selectedArtistIdsJson = "[]";

    private ReleaseImportDraftTrack()
    {
        FilePath = string.Empty;
        RelativePath = string.Empty;
        Title = string.Empty;
    }

    private ReleaseImportDraftTrack(CollectionId collectionId, ReleaseImportDraftId draftId, ReleaseImportDraftTrackId id, DraftTrackFileInfo file)
        : this()
    {
        CollectionId = collectionId;
        DraftId = draftId;
        Id = id;
        FilePath = Guard.RequiredText(file.FilePath, nameof(file.FilePath), "release_import.track_file_required");
        RelativePath = file.RelativePath;
        Format = file.Format;
        SizeBytes = file.SizeBytes;
        LastModifiedAt = file.LastModifiedAt;
        Codec = file.Metadata.Codec is PresentOptionalValue<string> codec
            ? TrimOrNull(codec.Value)
            : null;
        Quality = file.Metadata.Quality is PresentOptionalValue<AudioFileQuality> quality
            ? Guard.DefinedEnum(quality.Value, nameof(file.Metadata.Quality), "release_import.track_quality_invalid")
            : null;
        BitrateKbps = PositiveOrNull(file.Metadata.BitrateKbps, nameof(file.Metadata.BitrateKbps), "release_import.track_bitrate_invalid");
        SampleRateHz = PositiveOrNull(file.Metadata.SampleRateHz, nameof(file.Metadata.SampleRateHz), "release_import.track_sample_rate_invalid");
        Channels = PositiveOrNull(file.Metadata.Channels, nameof(file.Metadata.Channels), "release_import.track_channels_invalid");
        SetContentHash(file.ContentHash);
    }

    public CollectionId CollectionId { get; private set; }
    public ReleaseImportDraftId DraftId { get; private set; }
    public ReleaseImportDraftTrackId Id { get; private set; }
    public string FilePath { get; private set; }
    public string RelativePath { get; private set; }
    public AudioFileFormat Format { get; private set; }
    public long SizeBytes { get; private set; }
    public DateTimeOffset LastModifiedAt { get; private set; }
    public IOptionalValue<string> ContentHash => _contentHash is null ? Optional.Missing<string>() : Optional.From(_contentHash);
    public string? Codec { get; private set; }
    public AudioFileQuality? Quality { get; private set; }
    public TimeSpan? Duration { get; private set; }
    public int? BitrateKbps { get; private set; }
    public int? SampleRateHz { get; private set; }
    public int? Channels { get; private set; }
    public int? Position { get; private set; }
    public string? Disc { get; private set; }
    public string? Side { get; private set; }
    public string Title { get; private set; }
    public int? VersionYear { get; private set; }
    public bool InheritReleaseArtistCredits { get; private set; }
    public bool IsSkipped { get; private set; }
    public ReleaseImportTrackMode TrackMode { get; private set; } = ReleaseImportTrackMode.Create;
    public TrackId? SelectedTrackId { get; private set; }
    public IReadOnlyList<ReleaseImportArtistCredit> ArtistCredits => ImportJson.Deserialize<ReleaseImportArtistCredit>(_artistCreditsJson);
    public IReadOnlyList<string> ArtistNames => ImportJson.Deserialize<string>(_artistNamesJson);
    public IReadOnlyList<Guid> SelectedArtistIds => ImportJson.Deserialize<Guid>(_selectedArtistIdsJson);
    public IReadOnlyList<ImportReviewIssue> Issues => ImportJson.Deserialize<ImportReviewIssue>(_issuesJson);

    public static ReleaseImportDraftTrack Create(CollectionId collectionId, ReleaseImportDraftId draftId, ReleaseImportDraftTrackId id, DraftTrackFileInfo file)
    {
        return new ReleaseImportDraftTrack(collectionId, draftId, id, file);
    }

    public void UpdateEditableFields(DraftTrackEditableFields fields)
    {
        if (fields.Position is < 1)
        {
            throw new DomainException("release_import.track_position_invalid", "Release import track position must be greater than zero");
        }

        Position = fields.Position;
        Disc = TrimMarkerOrNull(fields.Disc, nameof(fields.Disc), "release_import.track_disc_too_long");
        Side = TrimMarkerOrNull(fields.Side, nameof(fields.Side), "release_import.track_side_too_long");
        Title = Guard.RequiredText(fields.Title, nameof(fields.Title), "release_import.track_title_required");
        Duration = fields.Duration;
        VersionYear = NormalizeVersionYear(fields.VersionYear);
        InheritReleaseArtistCredits = fields.InheritReleaseArtistCredits;
        IsSkipped = fields.IsSkipped;
        TrackMode = Guard.DefinedEnum(fields.TrackMode, nameof(fields.TrackMode), TrackModeInvalidCode);
        SelectedTrackId = NormalizeSelectedTrackId(TrackMode, fields.SelectedTrackId);
        _artistCreditsJson = ImportJson.Serialize(NormalizeArtistCredits(fields.ArtistCredits, fields.ArtistNames, fields.SelectedArtistIds));
        _artistNamesJson = ImportJson.Serialize(fields.ArtistNames);
        _selectedArtistIdsJson = ImportJson.Serialize(fields.SelectedArtistIds);
        _issuesJson = ImportJson.Serialize(fields.Issues);
    }

    private static List<ReleaseImportArtistCredit> NormalizeArtistCredits(
        IReadOnlyList<ReleaseImportArtistCredit>? artistCredits,
        IReadOnlyList<string> artistNames,
        IReadOnlyList<Guid> selectedArtistIds)
    {
        if (artistCredits is { Count: > 0 })
        {
            return
            [
                .. artistCredits
                    .Select(credit => new ReleaseImportArtistCredit(
                        credit.ArtistId,
                        TrimOrNull(credit.Name) ?? string.Empty,
                        TrimOrNull(credit.Role) ?? string.Empty))
                    .Where(credit => credit.ArtistId is not null || !string.IsNullOrWhiteSpace(credit.Name))
            ];
        }

        List<ReleaseImportArtistCredit> credits = [];
        for (int index = 0; index < artistNames.Count; index++)
        {
            string? name = TrimOrNull(artistNames[index]);
            Guid? artistId = index < selectedArtistIds.Count ? selectedArtistIds[index] : null;
            if (artistId is null && string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            credits.Add(new ReleaseImportArtistCredit(artistId, name ?? string.Empty, "mainArtist"));
        }

        return credits;
    }

    private void SetContentHash(IOptionalValue<string> contentHash)
    {
        _contentHash = contentHash is PresentOptionalValue<string> presentContentHash
            ? TrimOrNull(presentContentHash.Value)?.ToLowerInvariant()
            : null;
    }

    private static string? TrimOrNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static TrackId? NormalizeSelectedTrackId(ReleaseImportTrackMode mode, TrackId? selectedTrackId)
    {
        return mode switch
        {
            ReleaseImportTrackMode.Link => selectedTrackId
                ?? throw new DomainException("release_import.selected_track_required", "Linked import tracks must include a selected track"),
            ReleaseImportTrackMode.Create or ReleaseImportTrackMode.ReleaseOnly when selectedTrackId is null => null,
            ReleaseImportTrackMode.Create => throw new DomainException(TrackModeInvalidCode, "Created import tracks must not include a selected track"),
            ReleaseImportTrackMode.ReleaseOnly => throw new DomainException(TrackModeInvalidCode, "Release-only import tracks must not include a selected track"),
            _ => throw new DomainException(TrackModeInvalidCode, "Release import track mode is invalid")
        };
    }

    private static int? NormalizeVersionYear(int? versionYear)
    {
        return versionYear switch
        {
            null => null,
            < 1000 or > 9999 => throw new DomainException(
                "release_import.track_version_year_invalid",
                "Release import track version year must be a four-digit year"),
            _ => versionYear
        };
    }

    private static int? PositiveOrNull(IOptionalValue<int> value, string fieldName, string code)
    {
        return value is PresentOptionalValue<int> present
            ? Guard.Positive(present.Value, fieldName, code)
            : null;
    }

    private static string? TrimMarkerOrNull(string? value, string fieldName, string code)
    {
        string? trimmed = TrimOrNull(value);
        return trimmed switch
        {
            null => null,
            { Length: > PositionMarkerMaxLength } => throw new DomainException(code, $"{fieldName} must be at most {PositionMarkerMaxLength} characters"),
            _ => trimmed
        };
    }
}
