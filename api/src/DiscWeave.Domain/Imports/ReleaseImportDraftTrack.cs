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
    private string _issuesJson = "[]";
    private string _selectedArtistIdsJson = "[]";
#pragma warning disable IDE0044
    private ReleaseImportLocalFileDescriptor? _localFile;
#pragma warning restore IDE0044

    private ReleaseImportDraftTrack()
    {
        Title = string.Empty;
    }

    private ReleaseImportDraftTrack(
        CollectionId collectionId,
        ReleaseImportDraftId draftId,
        ReleaseImportDraftTrackId id,
        ReleaseImportSourceKind sourceKind,
        ReleaseImportLocalFileDescriptor? localFile)
        : this()
    {
        CollectionId = collectionId;
        DraftId = draftId;
        Id = id;
        SourceKind = sourceKind;
        _localFile = localFile;
    }

    public CollectionId CollectionId { get; private set; }
    public ReleaseImportDraftId DraftId { get; private set; }
    public ReleaseImportDraftTrackId Id { get; private set; }
    public ReleaseImportSourceKind SourceKind { get; private set; }
    public IOptionalValue<ReleaseImportLocalFileDescriptor> LocalFile => _localFile is null
        ? Optional.Missing<ReleaseImportLocalFileDescriptor>()
        : Optional.From(_localFile);
    public TimeSpan? Duration { get; private set; }
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
        return CreateLocalFile(collectionId, draftId, id, ReleaseImportLocalFileDescriptor.Create(file));
    }

    public static ReleaseImportDraftTrack CreateLocalFile(
        CollectionId collectionId,
        ReleaseImportDraftId draftId,
        ReleaseImportDraftTrackId id,
        ReleaseImportLocalFileDescriptor localFile)
    {
        ArgumentNullException.ThrowIfNull(localFile);

        return new ReleaseImportDraftTrack(
            collectionId,
            draftId,
            id,
            ReleaseImportSourceKind.LocalFiles,
            localFile);
    }

    public static ReleaseImportDraftTrack CreateExternalMetadata(
        CollectionId collectionId,
        ReleaseImportDraftId draftId,
        ReleaseImportDraftTrackId id)
    {
        return new ReleaseImportDraftTrack(
            collectionId,
            draftId,
            id,
            ReleaseImportSourceKind.ExternalMetadata,
            null);
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
                        TrimOrNull(credit.Role) ?? string.Empty,
                        NormalizeArtistCreditExternalSource(credit.ExternalSource)))
                    .Where(credit =>
                        credit.ArtistId is not null ||
                        !string.IsNullOrWhiteSpace(credit.Name) ||
                        credit.ExternalSource is not null)
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

            credits.Add(new ReleaseImportArtistCredit(artistId, name ?? string.Empty, "mainArtist", null));
        }

        return credits;
    }

    private static ReleaseImportArtistCreditExternalSource? NormalizeArtistCreditExternalSource(
        ReleaseImportArtistCreditExternalSource? source)
    {
        return ReleaseImportArtistCreditExternalSourceNormalizer.Normalize(source);
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
