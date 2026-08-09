using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Application.ExternalMetadata;

public interface IExternalMetadataProvider
{
    string ProviderCode { get; }

    Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>> SearchReleasesAsync(
        ExternalMetadataReleaseSearchQuery query,
        CancellationToken cancellationToken);

    Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken);

    Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseAsync(
        ExternalMetadataLookupQuery query,
        ExternalMetadataRequestFreshness freshness,
        CancellationToken cancellationToken)
    {
        _ = freshness;
        return GetReleaseAsync(query, cancellationToken);
    }

    Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>>> SearchArtistsAsync(
        ExternalMetadataArtistSearchQuery query,
        CancellationToken cancellationToken);

    Task<ExternalMetadataResult<ExternalMetadataArtistDetail>> GetArtistAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken);

    Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>>> SearchTracksAsync(
        ExternalMetadataTrackSearchQuery query,
        CancellationToken cancellationToken);

    Task<ExternalMetadataResult<ExternalMetadataTrackDetail>> GetTrackAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken);
}

public sealed class ExternalMetadataResult<T>
{
    public ExternalMetadataResult(T value)
    {
        ArgumentNullException.ThrowIfNull(value);

        IsSuccess = true;
        Value = value;
        Error = null!;
    }

    public ExternalMetadataResult(ExternalMetadataError error)
    {
        ArgumentNullException.ThrowIfNull(error);

        IsSuccess = false;
        Value = default!;
        Error = error;
    }

    public bool IsSuccess { get; }

    public T Value { get; }

    public ExternalMetadataError Error { get; }
}

public sealed record ExternalMetadataError(
    ExternalMetadataErrorKind Kind,
    string Code,
    string Message,
    TimeSpan? RetryAfter = null);

public enum ExternalMetadataErrorKind
{
    Disabled,
    NotFound,
    UnknownProvider,
    UnsupportedCapability,
    NotConfigured,
    Unauthorized,
    RateLimited,
    Timeout,
    Unavailable,
    InvalidResponse
}

public sealed record ExternalMetadataLookupQuery(string ExternalId);

public sealed record ExternalMetadataReleaseSearchQuery(
    string? Query = null,
    string? Artist = null,
    string? Title = null,
    int? Year = null,
    string? Barcode = null,
    string? CatalogNumber = null,
    int? TrackCount = null,
    int Limit = 25);

public sealed record ExternalMetadataArtistSearchQuery(
    string? Query = null,
    int Limit = 25);

public sealed record ExternalMetadataTrackSearchQuery(
    string? Title = null,
    string? Artist = null,
    string? ReleaseTitle = null,
    int? Year = null,
    string? Barcode = null,
    string? CatalogNumber = null,
    int? TrackCount = null,
    int Limit = 25,
    int Page = 1,
    ExternalMetadataTrackSearchSort Sort = ExternalMetadataTrackSearchSort.DiscogsRelevance);

public enum ExternalMetadataTrackSearchSort
{
    DiscogsRelevance,
    ReleaseYearAscending,
    ReleaseYearDescending
}

public sealed record ExternalMetadataSearchResult<T>(
    IReadOnlyList<T> Items,
    int? Total);

public sealed record ExternalMetadataSource(
    string ProviderName,
    string ResourceType,
    string ExternalId,
    string SourceUrl,
    string Attribution);

public sealed record ExternalMetadataArtistReference(
    string Name,
    ExternalMetadataSource? Source);

public sealed record ExternalMetadataReleaseCandidate(
    ExternalMetadataSource Source,
    string Title,
    IReadOnlyList<string> Artists,
    int? Year,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> Formats,
    string? CatalogNumber,
    int? TrackCount,
    IReadOnlyList<string> Barcodes);

public sealed record ExternalMetadataReleaseDetail
{
    public ExternalMetadataReleaseDetail(
        ExternalMetadataSource source,
        string title,
        IReadOnlyList<string> artists,
        int? year,
        DateOnly? releaseDate,
        IReadOnlyList<string> labels,
        IReadOnlyList<string> formats,
        string? type,
        IReadOnlyList<string> genres,
        IReadOnlyList<ExternalMetadataReleaseTrack> tracklist,
        IReadOnlyList<ExternalMetadataIdentifier> identifiers,
        string? catalogNumber,
        IReadOnlyList<ExternalMetadataReleaseLabel> labelDetails,
        IReadOnlyList<ExternalMetadataReleaseCredit> credits,
        IReadOnlyList<ExternalMetadataArtistReference>? artistReferences = null,
        IReadOnlyList<ExternalMetadataSource>? relatedSources = null,
        IOptionalValue<ExternalMetadataPartialDate>? releaseDateEvidence = null,
        bool tracklistComplete = true)
    {
        IOptionalValue<ExternalMetadataPartialDate> normalizedDateEvidence =
            releaseDateEvidence ?? LegacyDateEvidence(year, releaseDate);

        Source = source;
        Title = title;
        Artists = artists;
        ExternalMetadataPartialDate? presentDate =
            normalizedDateEvidence is PresentOptionalValue<ExternalMetadataPartialDate> present
                ? present.Value
                : null;
        Year = presentDate?.Year;
        ReleaseDate = presentDate is ExternalMetadataPartialDate.FullDate fullDate
            ? fullDate.Value
            : null;
        Labels = labels;
        Formats = formats;
        Type = type;
        Genres = genres;
        Tracklist = tracklist;
        Identifiers = identifiers;
        CatalogNumber = catalogNumber;
        LabelDetails = labelDetails;
        Credits = credits;
        ArtistReferences = artistReferences;
        RelatedSources = relatedSources ?? [];
        ReleaseDateEvidence = normalizedDateEvidence;
        TracklistComplete = tracklistComplete;
    }

    public ExternalMetadataSource Source { get; }
    public string Title { get; }
    public IReadOnlyList<string> Artists { get; }
    public int? Year { get; }
    public DateOnly? ReleaseDate { get; }
    public IReadOnlyList<string> Labels { get; }
    public IReadOnlyList<string> Formats { get; }
    public string? Type { get; }
    public IReadOnlyList<string> Genres { get; }
    public IReadOnlyList<ExternalMetadataReleaseTrack> Tracklist { get; }
    public IReadOnlyList<ExternalMetadataIdentifier> Identifiers { get; }
    public string? CatalogNumber { get; }
    public IReadOnlyList<ExternalMetadataReleaseLabel> LabelDetails { get; }
    public IReadOnlyList<ExternalMetadataReleaseCredit> Credits { get; }
    public IReadOnlyList<ExternalMetadataArtistReference>? ArtistReferences { get; }
    public IReadOnlyList<ExternalMetadataSource> RelatedSources { get; }
    public IOptionalValue<ExternalMetadataPartialDate> ReleaseDateEvidence { get; }
    public bool TracklistComplete { get; }

    private static IOptionalValue<ExternalMetadataPartialDate> LegacyDateEvidence(
        int? year,
        DateOnly? releaseDate)
    {
        return releaseDate is DateOnly fullDate
            ? Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForDate(fullDate))
            : LegacyYearEvidence(year);
    }

    private static IOptionalValue<ExternalMetadataPartialDate> LegacyYearEvidence(int? year)
    {
        return year is >= 1 and <= 9999
            ? Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForYear(year.Value))
            : Optional.Missing<ExternalMetadataPartialDate>();
    }
}

public sealed record ExternalMetadataReleaseLabel(
    string Name,
    string? CatalogNumber);

public sealed record ExternalMetadataReleaseCredit(
    string Name,
    string Role,
    string? TrackTitle,
    string? TrackPosition,
    ExternalMetadataSource? Source = null);

public sealed record ExternalMetadataReleaseTrack
{
    public ExternalMetadataReleaseTrack(
        string title,
        string? position,
        TimeSpan? duration,
        IReadOnlyList<string> artists,
        string? disc,
        string? side,
        IReadOnlyList<ExternalMetadataArtistReference>? artistReferences = null,
        IReadOnlyList<ExternalMetadataSource>? externalSources = null)
    {
        Title = title;
        Position = position;
        Duration = duration;
        Artists = artists;
        Disc = disc;
        Side = side;
        ArtistReferences = artistReferences;
        ExternalSources = externalSources ?? [];
    }

    public string Title { get; }
    public string? Position { get; }
    public TimeSpan? Duration { get; }
    public IReadOnlyList<string> Artists { get; }
    public string? Disc { get; }
    public string? Side { get; }
    public IReadOnlyList<ExternalMetadataArtistReference>? ArtistReferences { get; }
    public IReadOnlyList<ExternalMetadataSource> ExternalSources { get; }
}

public sealed record ExternalMetadataIdentifier(
    string Type,
    string Value);
