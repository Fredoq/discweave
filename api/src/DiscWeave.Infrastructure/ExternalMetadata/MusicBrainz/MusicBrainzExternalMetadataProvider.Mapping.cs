using System.Globalization;
using System.Text;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private static string BuildRecordingQuery(string title, IReadOnlyList<string> artists)
    {
        string titleClause = $"recording:\"{EscapeLuceneLiteral(title.Trim())}\"";
        string[] artistClauses =
        [
            .. artists
                .Where(artist => !string.IsNullOrWhiteSpace(artist))
                .Select(artist => artist.Trim())
                .Select(artist => $"artist:\"{EscapeLuceneLiteral(artist)}\"")
        ];

        return artistClauses.Length == 0
            ? titleClause
            : $"{titleClause} AND ({string.Join(" OR ", artistClauses)})";
    }

    private static string EscapeLuceneLiteral(string value)
    {
        var escaped = new StringBuilder(value.Length * 2);
        foreach (char character in value)
        {
            if (character is '+' or '-' or '&' or '|' or '!' or '(' or ')' or
                '{' or '}' or '[' or ']' or '^' or '"' or '~' or '*' or '?' or
                ':' or '\\' or '/')
            {
                _ = escaped.Append('\\');
            }

            _ = escaped.Append(character);
        }

        return escaped.ToString();
    }

    private static bool TryMapRecordingSearch(
        RecordingSearchResponse response,
        int limit,
        out RecordingSearchOutcome outcome)
    {
        if (response.Recordings is null)
        {
            outcome = null!;
            return false;
        }

        RecordingHypothesis[] recordings =
        [
            .. response.Recordings
                .Select(TryMapRecordingHypothesis)
                .Where(recording => recording is not null)
                .Select(recording => recording!)
                .OrderByDescending(recording => recording.Score)
                .ThenBy(recording => recording.Mbid, StringComparer.Ordinal)
                .Take(limit)
        ];
        outcome = new RecordingSearchOutcome(recordings, response.Count);
        return true;
    }

    private static RecordingHypothesis? TryMapRecordingHypothesis(RecordingDto recording)
    {
        return TryNormalizeMbid(recording.Id, out string mbid) &&
            !string.IsNullOrWhiteSpace(recording.Title) &&
            recording.Score is int score
                ? new RecordingHypothesis(
                    mbid,
                    recording.Title.Trim(),
                    score,
                    Duration(recording.Length),
                    ArtistNames(recording.ArtistCredit))
                : null;
    }

    private static bool TryMapRecordingDetail(
        RecordingDto response,
        string expectedMbid,
        out RecordingDetailOutcome outcome)
    {
        if (!TryNormalizeMbid(response.Id, out string mbid) ||
            !string.Equals(mbid, expectedMbid, StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(response.Title))
        {
            outcome = null!;
            return false;
        }

        outcome = new RecordingDetailOutcome(
            mbid,
            response.Title.Trim(),
            Duration(response.Length),
            ArtistNames(response.ArtistCredit),
            MapRelations(response.Relations));
        return true;
    }

    private static bool TryMapReleaseGroupDetail(
        ReleaseGroupDto response,
        string expectedMbid,
        out ReleaseGroupDetailOutcome outcome)
    {
        if (!TryNormalizeMbid(response.Id, out string mbid) ||
            !string.Equals(mbid, expectedMbid, StringComparison.Ordinal))
        {
            outcome = null!;
            return false;
        }

        outcome = new ReleaseGroupDetailOutcome(mbid, MapRelations(response.Relations));
        return true;
    }

    private static DirectedRelation[] MapRelations(IReadOnlyList<RelationDto>? relations)
    {
        return
        [
            .. (relations ?? [])
                .Select(TryMapRelation)
                .Where(relation => relation is not null)
                .Select(relation => relation!)
        ];
    }

    private static DirectedRelation? TryMapRelation(RelationDto relation)
    {
        if (string.IsNullOrWhiteSpace(relation.TypeId) ||
            string.IsNullOrWhiteSpace(relation.Direction) ||
            string.IsNullOrWhiteSpace(relation.TargetType))
        {
            return null;
        }

        (string? id, string? title) = relation.TargetType.Trim().ToLowerInvariant() switch
        {
            "recording" => (relation.Recording?.Id, relation.Recording?.Title),
            "work" => (relation.Work?.Id, relation.Work?.Title),
            "release-group" => (relation.ReleaseGroup?.Id, relation.ReleaseGroup?.Title),
            _ => (null, null)
        };
        return TryNormalizeMbid(id, out string targetMbid)
            ? new DirectedRelation(
                relation.TypeId.Trim().ToLowerInvariant(),
                relation.Type?.Trim() ?? string.Empty,
                relation.Direction.Trim().ToLowerInvariant(),
                relation.TargetType.Trim().ToLowerInvariant(),
                targetMbid,
                EmptyToNull(title),
                CleanStrings(relation.Attributes),
                CleanStrings(relation.AttributeIds?.Values.ToArray()))
            : null;
    }

    private static string[] ArtistNames(IReadOnlyList<ArtistCreditDto>? credits)
    {
        return
        [
            .. (credits ?? [])
                .Select(credit => EmptyToNull(credit.Name) ?? EmptyToNull(credit.Artist?.Name))
                .Where(name => name is not null)
                .Select(name => name!)
        ];
    }

    private static ExternalMetadataArtistReference[] ArtistReferences(
        IReadOnlyList<ArtistCreditDto>? credits)
    {
        return
        [
            .. (credits ?? [])
                .Select(ToArtistReference)
                .Where(reference => !string.IsNullOrWhiteSpace(reference.Name))
        ];
    }

    private static ExternalMetadataArtistReference ToArtistReference(ArtistCreditDto credit)
    {
        string name = EmptyToNull(credit.Name) ?? EmptyToNull(credit.Artist?.Name) ?? string.Empty;
        return new ExternalMetadataArtistReference(name, null);
    }

    private static ExternalMetadataSource MusicBrainzSource(string resource, string mbid)
    {
        return new ExternalMetadataSource(
            ProviderCodeValue,
            resource,
            mbid,
            $"https://musicbrainz.org/{resource}/{mbid}",
            Attribution);
    }

    private static TimeSpan? Duration(int? milliseconds)
    {
        return milliseconds is > 0 ? TimeSpan.FromMilliseconds(milliseconds.Value) : null;
    }

    private static DateOnly? ParseReleaseDate(string? value)
    {
        string? normalized = EmptyToNull(value);
        return normalized is not null &&
            DateOnly.TryParseExact(
                normalized,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out DateOnly date)
                    ? date
                    : null;
    }

    private static IOptionalValue<ExternalMetadataPartialDate>
        ParseReleaseDateEvidence(string? value)
    {
        string? normalized = EmptyToNull(value);
        if (normalized is null)
        {
            return Optional.Missing<ExternalMetadataPartialDate>();
        }

        bool fullDate = DateOnly.TryParseExact(
            normalized,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out DateOnly date);
        bool yearMonth = DateTime.TryParseExact(
                normalized,
                "yyyy-MM",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out DateTime month);
        return fullDate
            ? Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForDate(date))
            : yearMonth
            ? Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForYearMonth(
                    month.Year,
                    month.Month))
            : int.TryParse(
                normalized,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out int year) &&
            year is >= 1 and <= 9999
                ? Optional.From<ExternalMetadataPartialDate>(
                    ExternalMetadataPartialDate.ForYear(year))
                : Optional.Missing<ExternalMetadataPartialDate>();
    }

    private static bool TryNormalizeMbid(string? value, out string normalized)
    {
        if (value is not null &&
            Guid.TryParseExact(value.Trim(), "D", out Guid guid))
        {
            normalized = guid.ToString("D").ToLowerInvariant();
            return true;
        }

        normalized = string.Empty;
        return false;
    }

    private static string[] CleanStrings(IReadOnlyList<string>? values)
    {
        return
        [
            .. (values ?? [])
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim())
        ];
    }

    private static string? EmptyToNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
