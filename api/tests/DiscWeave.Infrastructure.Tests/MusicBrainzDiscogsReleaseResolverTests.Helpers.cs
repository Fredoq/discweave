using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    private static ExternalMetadataReleaseDetail MusicBrainzRelease(
        ExternalMetadataPartialDate date)
    {
        return Detail(
            MusicBrainzSource(
                "release",
                "cccccccc-cccc-cccc-cccc-cccccccccccc"),
            date,
            [MusicBrainzRow()],
            ["5016839200371"],
            "FAC 73",
            ["Factory"]);
    }

    private static ExternalMetadataReleaseDetail DiscogsRelease(
        ExternalMetadataPartialDate date,
        IReadOnlyList<string> barcodes,
        string? catalogNumber = "FAC-73",
        bool tracklistComplete = true,
        IReadOnlyList<ExternalMetadataReleaseTrack>? rows = null)
    {
        return Detail(
            DiscogsSource("249504"),
            date,
            rows ?? [DiscogsRow("Blue Monday", "A1")],
            barcodes,
            catalogNumber,
            ["Factory"],
            tracklistComplete);
    }

    private static ExternalMetadataReleaseDetail Detail(
        ExternalMetadataSource source,
        ExternalMetadataPartialDate date,
        IReadOnlyList<ExternalMetadataReleaseTrack> rows,
        IReadOnlyList<string> barcodes,
        string? catalogNumber,
        IReadOnlyList<string> labels,
        bool tracklistComplete = true,
        string title = "Blue Monday",
        IReadOnlyList<string>? artists = null)
    {
        return new ExternalMetadataReleaseDetail(
            source,
            title,
            artists ?? ["New Order"],
            date.Year,
            date is ExternalMetadataPartialDate.FullDate fullDate
                ? fullDate.Value
                : null,
            labels,
            ["Vinyl"],
            "single",
            ["Electronic"],
            rows,
            [.. barcodes.Select(value =>
                new ExternalMetadataIdentifier("Barcode", value))],
            catalogNumber,
            [.. labels.Select(label =>
                new ExternalMetadataReleaseLabel(label, catalogNumber))],
            [],
            relatedSources: string.Equals(
                source.ProviderName,
                "musicbrainz",
                StringComparison.Ordinal)
                    ? [DiscogsSource("249504")]
                    : [],
            releaseDateEvidence: Optional.From(date),
            tracklistComplete: tracklistComplete);
    }

    private static ExternalMetadataReleaseTrack MusicBrainzRow()
    {
        return new ExternalMetadataReleaseTrack(
            "Blue Monday",
            "A1",
            TimeSpan.FromMinutes(3),
            ["New Order"],
            "1",
            null,
            externalSources:
            [
                MusicBrainzSource("track", TrackMbid),
                MusicBrainzSource("recording", RecordingMbid)
            ]);
    }

    private static ExternalMetadataReleaseTrack DiscogsRow(
        string title,
        string position)
    {
        return new ExternalMetadataReleaseTrack(
            title,
            position,
            TimeSpan.FromMinutes(3),
            ["New Order"],
            null,
            null);
    }

    private static ExternalMetadataSource MusicBrainzSource(
        string resourceType,
        string externalId)
    {
        return new ExternalMetadataSource(
            "musicbrainz",
            resourceType,
            externalId,
            $"https://musicbrainz.org/{resourceType}/{externalId}",
            "Data provided by MusicBrainz.");
    }

    private static ExternalMetadataSource DiscogsSource(string externalId)
    {
        return new ExternalMetadataSource(
            "discogs",
            "release",
            externalId,
            $"https://www.discogs.com/release/{externalId}",
            "Data provided by Discogs.");
    }
}
