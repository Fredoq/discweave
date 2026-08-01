using System.Globalization;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class DiscogsExternalMetadataProvider
{
    private static ExternalMetadataReleaseCandidate MapReleaseCandidate(DiscogsSearchResult result)
    {
        return new ExternalMetadataReleaseCandidate(
            Source(result, "release"),
            result.Title ?? string.Empty,
            ArtistNamesFromTitle(result.Title),
            result.Year,
            result.Label ?? [],
            result.Format ?? [],
            EmptyToNull(result.Catno),
            null,
            result.Barcode ?? []);
    }

    private static ExternalMetadataArtistCandidate MapArtistCandidate(DiscogsSearchResult result)
    {
        return new ExternalMetadataArtistCandidate(
            Source(result, "artist"),
            result.Title ?? string.Empty,
            null,
            []);
    }

    private static ExternalMetadataReleaseDetail MapReleaseDetail(DiscogsReleaseDetailResponse response)
    {
        IOptionalValue<ExternalMetadataPartialDate> dateEvidence =
            ParseReleaseDateEvidence(response.Year, response.Released);
        return new ExternalMetadataReleaseDetail(
            Source(response.Id, "release", response.Uri),
            response.Title ?? string.Empty,
            ArtistNames(response.Artists),
            null,
            null,
            response.Labels?.Select(label => label.Name).WhereNotBlank() ?? [],
            response.Formats?.Select(format => format.Name).WhereNotBlank() ?? [],
            ReleaseTypeCode(response.Formats),
            GenreCodes(response),
            MapReleaseTracklist(response.Tracklist),
            response.Identifiers?.Select(ToIdentifier).ToArray() ?? [],
            response.Labels?.Select(label => label.CatalogNumber).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)),
            response.Labels?.Select(ToReleaseLabel).Where(label => !string.IsNullOrWhiteSpace(label.Name)).ToArray() ?? [],
            ReleaseCredits(response),
            ArtistReferences(response.Artists),
            releaseDateEvidence: dateEvidence,
            tracklistComplete: IsCompleteTracklist(response.Tracklist));
    }

    private static ExternalMetadataArtistDetail MapArtistDetail(DiscogsArtistDetailResponse response)
    {
        return new ExternalMetadataArtistDetail(
            Source(response.Id, "artist", response.Uri),
            response.Name ?? string.Empty,
            EmptyToNull(response.RealName),
            EmptyToNull(response.Profile),
            response.Aliases?.Select(alias => alias.Name).WhereNotBlank() ?? [],
            response.Members?.Select(member => member.Name).WhereNotBlank() ?? [],
            response.NameVariations ?? []);
    }

    private static ExternalMetadataArtistReference ToArtistReference(DiscogsNamedResource artist)
    {
        string name = DiscogsArtistNameCleaner.Clean(artist.Name);
        return new ExternalMetadataArtistReference(name, ArtistSource(artist));
    }

    private static ExternalMetadataSource? ArtistSource(DiscogsNamedResource artist)
    {
        return artist.Id is { } id
            ? Source(id, "artist", $"/artist/{id.ToString(CultureInfo.InvariantCulture)}")
            : null;
    }

    private static string[] ArtistNames(IReadOnlyList<DiscogsNamedResource>? artists)
    {
        return artists?.Select(artist => DiscogsArtistNameCleaner.Clean(artist.Name)).WhereNotBlank() ?? [];
    }

    private static ExternalMetadataArtistReference[] ArtistReferences(IReadOnlyList<DiscogsNamedResource>? artists)
    {
        return [.. (artists ?? []).Select(ToArtistReference).Where(reference => !string.IsNullOrWhiteSpace(reference.Name))];
    }

    private static ExternalMetadataIdentifier ToIdentifier(DiscogsIdentifierResponse identifier)
    {
        return new ExternalMetadataIdentifier(identifier.Type ?? string.Empty, identifier.Value ?? string.Empty);
    }

    private static ExternalMetadataReleaseLabel ToReleaseLabel(DiscogsLabelResource label)
    {
        return new ExternalMetadataReleaseLabel(label.Name?.Trim() ?? string.Empty, EmptyToNull(label.CatalogNumber));
    }

    private static ExternalMetadataReleaseCredit[] ReleaseCredits(DiscogsReleaseDetailResponse response)
    {
        IEnumerable<ExternalMetadataReleaseCredit> releaseCredits = response.ExtraArtists
            ?.Select(artist => ToReleaseCredit(artist, null, null)) ?? [];
        IEnumerable<ExternalMetadataReleaseCredit> trackCredits = response.Tracklist
            ?.Where(IsTrackRow)
            .SelectMany(track => track.ExtraArtists?.Select(artist => ToReleaseCredit(artist, track.Title, track.Position)) ?? []) ?? [];

        return [.. releaseCredits.Concat(trackCredits).Where(credit => !string.IsNullOrWhiteSpace(credit.Name))];
    }

    private static string? ReleaseTypeCode(IReadOnlyList<DiscogsFormatResource>? formats)
    {
        return formats?
            .SelectMany(format => format.Descriptions ?? [])
            .Where(IsReleaseTypeDescription)
            .Select(ToDictionaryCode)
            .FirstOrDefault(code => code.Length > 0);
    }

    private static string[] GenreCodes(DiscogsReleaseDetailResponse response)
    {
        return
        [
            .. (response.Genres ?? [])
                .Concat(response.Styles ?? [])
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim())
                .Distinct(StringComparer.Ordinal)
        ];
    }

    private static bool IsReleaseTypeDescription(string? value)
    {
        return value?.Trim() is { Length: > 0 } description &&
            DiscogsReleaseTypeDescriptions.Contains(description);
    }

    private static string ToDictionaryCode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        string[] words = value
            .Trim()
            .Split([' ', '_', '-', '/', '\\', '.', ',', ':', ';', '(', ')', '[', ']'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (words.Length == 0)
        {
            return string.Empty;
        }

        string first = words[0].ToLowerInvariant();
        return first + string.Concat(words.Skip(1).Select(word => string.Concat(
            word[..1].ToUpperInvariant(),
            word[1..].ToLowerInvariant())));
    }

    private static ExternalMetadataReleaseCredit ToReleaseCredit(DiscogsNamedResource artist, string? trackTitle, string? trackPosition)
    {
        return new ExternalMetadataReleaseCredit(
            DiscogsArtistNameCleaner.Clean(artist.Name),
            artist.Role?.Trim() ?? string.Empty,
            EmptyToNull(trackTitle),
            EmptyToNull(trackPosition),
            ArtistSource(artist));
    }

    private static ExternalMetadataSource Source(DiscogsSearchResult result, string resourceType)
    {
        return Source(result.Id, resourceType, result.Uri);
    }

    private static ExternalMetadataSource Source(long id, string resourceType, string? uri)
    {
        string sourceUrl = string.IsNullOrWhiteSpace(uri)
            ? $"https://www.discogs.com/{resourceType}/{id.ToString(CultureInfo.InvariantCulture)}"
            : ToDiscogsWebsiteUrl(uri);

        return new ExternalMetadataSource(
            ProviderCodeValue,
            resourceType,
            id.ToString(CultureInfo.InvariantCulture),
            sourceUrl,
            Attribution);
    }

    private static string ToDiscogsWebsiteUrl(string uri)
    {
        string trimmed = uri.Trim();
        return trimmed switch
        {
            _ when trimmed.StartsWith('/') => $"https://www.discogs.com{trimmed}",
            _ when Uri.TryCreate(trimmed, UriKind.Absolute, out Uri? absolute) => absolute.ToString(),
            _ => $"https://www.discogs.com/{trimmed}"
        };
    }

    private static IReadOnlyList<string> ArtistNamesFromTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return [];
        }

        string[] parts = title.Split(" - ", 2, StringSplitOptions.TrimEntries);
        return parts.Length == 2 && !string.IsNullOrWhiteSpace(parts[0])
            ? [parts[0]]
            : [];
    }

    private static TimeSpan? ParseDuration(string? duration)
    {
        if (string.IsNullOrWhiteSpace(duration))
        {
            return null;
        }

        string[] parts = duration.Split(':', StringSplitOptions.TrimEntries);
        return parts.Length == 2 &&
            int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out int minutes) &&
            int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out int seconds)
                ? TimeSpan.FromMinutes(minutes) + TimeSpan.FromSeconds(seconds)
                : null;
    }

    private static IOptionalValue<ExternalMetadataPartialDate>
        ParseReleaseDateEvidence(int? year, string? released)
    {
        string? normalized = EmptyToNull(released);
        ExternalMetadataPartialDate? releasedDate =
            ParseReleasedPartialDate(normalized);
        bool validYear = year is >= 1 and <= 9999;
        return normalized is not null && releasedDate is null
            ? Optional.Missing<ExternalMetadataPartialDate>()
            : releasedDate is not null
            ? validYear && year != releasedDate.Year
                ? Optional.Missing<ExternalMetadataPartialDate>()
                : Optional.From(releasedDate)
            : validYear
            ? Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForYear(year!.Value))
            : Optional.Missing<ExternalMetadataPartialDate>();
    }

    private static ExternalMetadataPartialDate? ParseReleasedPartialDate(
        string? released)
    {
        bool fullDate = DateOnly.TryParseExact(
            released,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out DateOnly releaseDate);
        bool yearMonth = DateTime.TryParseExact(
                released,
                "yyyy-MM",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out DateTime releaseMonth);
        return fullDate
            ? ExternalMetadataPartialDate.ForDate(releaseDate)
            : yearMonth
                ? ExternalMetadataPartialDate.ForYearMonth(
                releaseMonth.Year,
                releaseMonth.Month)
            : int.TryParse(
                released,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out int releaseYear) &&
            releaseYear is >= 1 and <= 9999
                ? ExternalMetadataPartialDate.ForYear(releaseYear)
                : null;
    }

    private static string? EmptyToNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
