using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseMatcher
    : IExternalReleaseRouteMatcher
{
    private const int MaximumTracklistRowsForCompatibility = 128;

    public ExternalReleaseRouteMatchResult Match(
        ExternalReleaseRouteMatchInput input)
    {
        ArgumentNullException.ThrowIfNull(input);

        var evidence = new SortedSet<string>(StringComparer.Ordinal);
        var contradictions = new SortedSet<string>(StringComparer.Ordinal);
        ExternalMetadataReleaseTrack? selectedRow = FindSelectedRow(input);
        if (selectedRow is null)
        {
            _ = contradictions.Add("musicbrainz.release_row_invalid");
            return Result([], evidence, contradictions);
        }

        if (input.Authority == ExternalReleaseRouteMatchAuthority.DirectRelationship)
        {
            _ = HasDirectRelationship(input)
                ? evidence.Add("discogs.direct_relationship")
                : contradictions.Add("discogs.direct_relationship_missing");
        }

        AddReleaseContradictions(input, contradictions);
        bool completeTracklists = input.MusicBrainzRelease.TracklistComplete &&
            input.DiscogsRelease.TracklistComplete;
        bool tracklistsTooLarge = completeTracklists &&
            (input.MusicBrainzRelease.Tracklist.Count > MaximumTracklistRowsForCompatibility ||
                input.DiscogsRelease.Tracklist.Count > MaximumTracklistRowsForCompatibility);
        bool compatibleTracklists = completeTracklists && !tracklistsTooLarge &&
            TracklistsAreCompatible(
                input.MusicBrainzRelease.Tracklist,
                input.DiscogsRelease.Tracklist);
        if (!completeTracklists)
        {
            _ = contradictions.Add("discogs.tracklist_incomplete");
        }
        else if (tracklistsTooLarge)
        {
            _ = contradictions.Add("discogs.tracklist_too_large");
        }
        else if (!compatibleTracklists)
        {
            _ = contradictions.Add("discogs.tracklist_contradiction");
        }

        if (input.Authority == ExternalReleaseRouteMatchAuthority.DeterministicEvidence &&
            !HasDeterministicAnchor(input, evidence))
        {
            _ = contradictions.Add("discogs.deterministic_anchor_missing");
        }

        DiscogsReleaseRouteBinding[] bindings =
        [
            .. input.DiscogsRelease.Tracklist
                .Select((row, ordinal) => new { Row = row, Ordinal = ordinal })
                .Where(item => RowIsCompatible(selectedRow, item.Row))
                .Select(item => new DiscogsReleaseRouteBinding
                {
                    ReleaseSource = CanonicalDiscogsReleaseSource(
                        input.DiscogsRelease.Source),
                    RowOrdinal = item.Ordinal,
                    Position = item.Row.Position?.Trim() ?? string.Empty,
                    Fingerprint = DiscogsReleaseRowFingerprint.Create(
                        item.Row.Position,
                        item.Row.Title,
                        item.Row.Artists,
                        item.Row.Duration)
                })
        ];
        if (bindings.Length > 0)
        {
            _ = evidence.Add("discogs.row_compatible");
        }

        return Result(bindings, evidence, contradictions);
    }

    private static ExternalReleaseRouteMatchResult Result(
        DiscogsReleaseRouteBinding[] bindings,
        IEnumerable<string> evidence,
        IEnumerable<string> contradictions)
    {
        string[] orderedContradictions =
            [.. contradictions.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal)];
        ExternalReleaseRouteMatchOutcome outcome = ExternalReleaseRouteMatchOutcome.NotMatched;
        if (orderedContradictions.Length == 0)
        {
            outcome = bindings.Length switch
            {
                1 => ExternalReleaseRouteMatchOutcome.Matched,
                > 1 => ExternalReleaseRouteMatchOutcome.AmbiguousRows,
                _ => ExternalReleaseRouteMatchOutcome.NotMatched
            };
        }
        return new ExternalReleaseRouteMatchResult
        {
            Outcome = outcome,
            CompatibleRows = bindings,
            EvidenceCodes =
                [.. evidence.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal)],
            ContradictionCodes = orderedContradictions
        };
    }

    private static ExternalMetadataReleaseTrack? FindSelectedRow(
        ExternalReleaseRouteMatchInput input)
    {
        if (!TryCanonicalMbid(input.MusicBrainzTrackMbid, out string trackMbid) ||
            !TryCanonicalMbid(input.MusicBrainzRecordingMbid, out string recordingMbid) ||
            !TryPositivePosition(input.MusicBrainzMediumPosition, out int medium))
        {
            return null;
        }

        ExternalMetadataReleaseTrack[] rows =
        [
            .. input.MusicBrainzRelease.Tracklist.Where(row =>
                TryPositivePosition(row.Disc, out int rowMedium) &&
                rowMedium == medium &&
                HasExactMusicBrainzSources(row, trackMbid, recordingMbid))
        ];
        return rows.Length == 1 ? rows[0] : null;
    }

    private static bool HasExactMusicBrainzSources(
        ExternalMetadataReleaseTrack row,
        string trackMbid,
        string recordingMbid)
    {
        return row.ExternalSources.Count == 2 &&
            row.ExternalSources.Count(source =>
                IsCanonicalMusicBrainzSource(source, "track", trackMbid)) == 1 &&
            row.ExternalSources.Count(source =>
                IsCanonicalMusicBrainzSource(source, "recording", recordingMbid)) == 1;
    }

    private static bool IsCanonicalMusicBrainzSource(
        ExternalMetadataSource source,
        string resourceType,
        string mbid)
    {
        return string.Equals(source.ProviderName, "musicbrainz", StringComparison.Ordinal) &&
            string.Equals(source.ResourceType, resourceType, StringComparison.Ordinal) &&
            string.Equals(source.ExternalId, mbid, StringComparison.Ordinal) &&
            string.Equals(
                source.SourceUrl,
                $"https://musicbrainz.org/{resourceType}/{mbid}",
                StringComparison.Ordinal);
    }

    private static bool HasDirectRelationship(
        ExternalReleaseRouteMatchInput input)
    {
        string releaseId = input.DiscogsRelease.Source.ExternalId;
        return IsDiscogsReleaseIdentity(input.DiscogsRelease.Source) &&
            input.MusicBrainzRelease.RelatedSources.Any(source =>
                IsCanonicalDiscogsRelease(source) &&
                string.Equals(source.ExternalId, releaseId, StringComparison.Ordinal));
    }

    private static ExternalMetadataSource CanonicalDiscogsReleaseSource(
        ExternalMetadataSource source)
    {
        return !IsDiscogsReleaseIdentity(source)
            ? throw new InvalidOperationException(
                "Discogs release source identity is invalid")
            : new ExternalMetadataSource(
                "discogs",
                "release",
                source.ExternalId,
                $"https://www.discogs.com/release/{source.ExternalId}",
                "Data provided by Discogs.");
    }

    private static bool IsCanonicalDiscogsRelease(ExternalMetadataSource source)
    {
        return IsDiscogsReleaseIdentity(source) &&
            string.Equals(
                source.SourceUrl,
                $"https://www.discogs.com/release/{source.ExternalId}",
                StringComparison.Ordinal);
    }

    private static bool IsDiscogsReleaseIdentity(ExternalMetadataSource source)
    {
        return string.Equals(source.ProviderName, "discogs", StringComparison.Ordinal) &&
            string.Equals(source.ResourceType, "release", StringComparison.Ordinal) &&
            long.TryParse(
                source.ExternalId,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out long id) &&
            id > 0;
    }

}
