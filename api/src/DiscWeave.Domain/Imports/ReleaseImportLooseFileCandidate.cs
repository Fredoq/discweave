using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Validation;

// EF Core materializes these private backing fields after construction.
#pragma warning disable IDE0032, IDE0044, S2933

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportLooseFileCandidate : IEntity<ReleaseImportLooseFileCandidateId>
{
    public const string PendingDecision = "pending";
    public const string ConsumedDecision = "consumed";
    public const string ConvertedToDraftDecision = "convertedToDraft";
    public const string AttachedToReleaseDecision = "attachedToRelease";

    private string _albumArtistHintsJson = "[]";
    private string _artistHintsJson = "[]";
    private string? _contentHash;

    private ReleaseImportLooseFileCandidate()
    {
        FilePath = string.Empty;
        RelativePath = string.Empty;
        Reason = string.Empty;
        Decision = PendingDecision;
    }

    private ReleaseImportLooseFileCandidate(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportLooseFileCandidateId id,
        LooseFileCandidateFields fields,
        DateTimeOffset createdAt)
        : this()
    {
        CollectionId = collectionId;
        SessionId = sessionId;
        Id = id;
        FilePath = Guard.RequiredText(fields.FilePath, nameof(fields.FilePath), "release_import_loose_file.file_path_required");
        RelativePath = Guard.RequiredText(fields.RelativePath, nameof(fields.RelativePath), "release_import_loose_file.relative_path_required");
        Format = Guard.DefinedEnum(fields.Format, nameof(fields.Format), "release_import_loose_file.format_invalid");
        SizeBytes = fields.SizeBytes < 0
            ? throw new DomainException("release_import_loose_file.size_invalid", "Loose file candidate size cannot be negative")
            : fields.SizeBytes;
        LastModifiedAt = fields.LastModifiedAt;
        _contentHash = TrimOrNull(fields.ContentHash)?.ToLowerInvariant();
        Duration = fields.DurationSeconds is null ? null : TimeSpan.FromSeconds(fields.DurationSeconds.Value);
        Codec = TrimOrNull(fields.Codec);
        Quality = fields.Quality is { } quality
            ? Guard.DefinedEnum(quality, nameof(fields.Quality), "release_import_loose_file.quality_invalid")
            : null;
        BitrateKbps = PositiveOrNull(fields.BitrateKbps, nameof(fields.BitrateKbps), "release_import_loose_file.bitrate_invalid");
        SampleRateHz = PositiveOrNull(fields.SampleRateHz, nameof(fields.SampleRateHz), "release_import_loose_file.sample_rate_invalid");
        Channels = PositiveOrNull(fields.Channels, nameof(fields.Channels), "release_import_loose_file.channels_invalid");
        TitleHint = TrimOrNull(fields.TitleHint);
        _artistHintsJson = ImportJson.Serialize(CleanNames(fields.ArtistHints));
        AlbumTitleHint = TrimOrNull(fields.AlbumTitleHint);
        _albumArtistHintsJson = ImportJson.Serialize(CleanNames(fields.AlbumArtistHints));
        TrackNumber = fields.TrackNumber is < 1 ? null : fields.TrackNumber;
        Reason = Guard.RequiredText(fields.Reason, nameof(fields.Reason), "release_import_loose_file.reason_required");
        Decision = PendingDecision;
        SourceDraftId = fields.SourceDraftId;
        SourceDraftTrackId = fields.SourceDraftTrackId;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public CollectionId CollectionId { get; private set; }
    public ReleaseImportSessionId SessionId { get; private set; }
    public ReleaseImportLooseFileCandidateId Id { get; private set; }
    public string FilePath { get; private set; }
    public string RelativePath { get; private set; }
    public AudioFileFormat Format { get; private set; }
    public long SizeBytes { get; private set; }
    public DateTimeOffset LastModifiedAt { get; private set; }
    public string? ContentHash => _contentHash;
    public TimeSpan? Duration { get; private set; }
    public string? Codec { get; private set; }
    public AudioFileQuality? Quality { get; private set; }
    public int? BitrateKbps { get; private set; }
    public int? SampleRateHz { get; private set; }
    public int? Channels { get; private set; }
    public string? TitleHint { get; private set; }
    public IReadOnlyList<string> ArtistHints => ImportJson.Deserialize<string>(_artistHintsJson);
    public string? AlbumTitleHint { get; private set; }
    public IReadOnlyList<string> AlbumArtistHints => ImportJson.Deserialize<string>(_albumArtistHintsJson);
    public int? TrackNumber { get; private set; }
    public string Reason { get; private set; }
    public string Decision { get; private set; }
    public ReleaseImportDraftId? SourceDraftId { get; private set; }
    public ReleaseImportDraftTrackId? SourceDraftTrackId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public static ReleaseImportLooseFileCandidate Create(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportLooseFileCandidateId id,
        LooseFileCandidateFields fields,
        DateTimeOffset createdAt)
    {
        return new ReleaseImportLooseFileCandidate(collectionId, sessionId, id, fields, createdAt);
    }

    public void MarkConvertedToDraft(ReleaseImportDraftId sourceDraftId, DateTimeOffset updatedAt)
    {
        if (Decision != PendingDecision)
        {
            throw new DomainException(
                "release_import_loose_file.already_consumed",
                "Loose file candidate has already been consumed");
        }

        SourceDraftId = sourceDraftId;
        Decision = ConvertedToDraftDecision;
        UpdatedAt = updatedAt;
    }

    public void MarkAttachedToRelease(DateTimeOffset updatedAt)
    {
        if (Decision != PendingDecision)
        {
            throw new DomainException(
                "release_import_loose_file.already_consumed",
                "Loose file candidate has already been consumed");
        }

        Decision = AttachedToReleaseDecision;
        UpdatedAt = updatedAt;
    }

    private static IReadOnlyList<string> CleanNames(IReadOnlyList<string>? values)
    {
        return values is null
            ? []
            : [.. values.Select(TrimOrNull).Where(value => value is not null).Select(value => value!).Distinct(StringComparer.OrdinalIgnoreCase)];
    }

    private static int? PositiveOrNull(int? value, string fieldName, string code)
    {
        return value is null
            ? null
            : value <= 0
            ? throw new DomainException(code, $"{fieldName} must be greater than zero")
            : value;
    }

    private static string? TrimOrNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}

public sealed record LooseFileCandidateFields(
    string FilePath,
    string RelativePath,
    AudioFileFormat Format,
    long SizeBytes,
    DateTimeOffset LastModifiedAt,
    string? ContentHash,
    int? DurationSeconds,
    string? Codec,
    AudioFileQuality? Quality,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels,
    string? TitleHint,
    IReadOnlyList<string> ArtistHints,
    string? AlbumTitleHint,
    IReadOnlyList<string> AlbumArtistHints,
    int? TrackNumber,
    string Reason,
    ReleaseImportDraftId? SourceDraftId = null,
    ReleaseImportDraftTrackId? SourceDraftTrackId = null);
