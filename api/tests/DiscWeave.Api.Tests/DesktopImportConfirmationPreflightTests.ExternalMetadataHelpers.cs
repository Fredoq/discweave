using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportReviewDeduplicationTests
{
    private async Task<ApiTestHost> CreateExternalMetadataTestHostAsync()
    {
        return await ApiTestHost.CreateAsync(
            _sqlite,
            services => FakeExternalMetadataProvider.Register(
                services,
                SeededMusicBrainzProvider(),
                new FakeExternalMetadataProvider("discogs")));
    }

    private static FakeExternalMetadataProvider SeededMusicBrainzProvider()
    {
        var releaseMbid = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var recordingMbid = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var trackMbid = Guid.Parse("33333333-3333-3333-3333-333333333333");
        ExternalMetadataReleaseTrack track = new(
            "Blue Monday",
            "1",
            TimeSpan.FromSeconds(449),
            ["New Order"],
            "1",
            null,
            externalSources:
            [
                new ExternalMetadataSource(
                    "musicbrainz",
                    "track",
                    trackMbid.ToString("D"),
                    $"https://musicbrainz.org/track/{trackMbid:D}",
                    "MusicBrainz"),
                new ExternalMetadataSource(
                    "musicbrainz",
                    "recording",
                    recordingMbid.ToString("D"),
                    $"https://musicbrainz.org/recording/{recordingMbid:D}",
                    "MusicBrainz")
            ]);
        ExternalMetadataReleaseDetail detail = new(
            new ExternalMetadataSource(
                "musicbrainz",
                "release",
                releaseMbid.ToString("D"),
                $"https://musicbrainz.org/release/{releaseMbid:D}",
                "MusicBrainz"),
            "Blue Monday",
            ["New Order"],
            1983,
            new DateOnly(1983, 3, 7),
            ["Factory"],
            [],
            "single",
            [],
            [track],
            [],
            null,
            [],
            []);
        return new FakeExternalMetadataProvider("musicbrainz")
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(detail)
        };
    }
}
