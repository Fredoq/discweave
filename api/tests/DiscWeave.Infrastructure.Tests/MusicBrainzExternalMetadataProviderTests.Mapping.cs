using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Fact]
    public async Task Generic_release_maps_track_and_recording_sources_without_retaining_invalid_rows()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-detail.json"))));
        using var harness = new ProviderHarness(handler, ValidOptions());

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Tracklist.Count);
        ExternalMetadataReleaseTrack first = result.Value.Tracklist[0];
        Assert.Equal("1", first.Disc);
        Assert.Equal("A1", first.Position);
        Assert.Equal(
            ["musicbrainz/track", "musicbrainz/recording"],
            first.ExternalSources.Select(source => $"{source.ProviderName}/{source.ResourceType}"));
        Assert.All(first.ExternalSources, source => Assert.Equal(source.ExternalId.ToLowerInvariant(), source.ExternalId));
        Assert.Equal("Mismatched Recording", result.Value.Tracklist[1].Title);
    }

    [Fact]
    public async Task Official_Discogs_release_relationship_is_the_only_related_source_preserved()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-related-discogs-url.json"))));
        using var harness = new ProviderHarness(handler, ValidOptions());

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000004"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        ExternalMetadataSource source = Assert.Single(result.Value.RelatedSources);
        Assert.Equal("discogs", source.ProviderName);
        Assert.Equal("release", source.ResourceType);
        Assert.Equal("12345", source.ExternalId);
        Assert.Equal("https://www.discogs.com/release/12345", source.SourceUrl);
    }

    [Theory]
    [InlineData("https://discogs.com/release/42", true)]
    [InlineData("https://www.discogs.com/en/release/42-name", true)]
    [InlineData("https://www.discogs.com:443/release/42", true)]
    [InlineData("http://www.discogs.com/release/42", false)]
    [InlineData("https://user@www.discogs.com/release/42", false)]
    [InlineData("https://www.discogs.com:444/release/42", false)]
    [InlineData("https://www.discogs.com/master/42", false)]
    [InlineData("https://www.discogs.com/release/0", false)]
    [InlineData("https://www.discogs.com/release/42/extra", false)]
    [InlineData("https://www.discogs.com/release%2F42", false)]
    [InlineData("https://example.com/release/42", false)]
    public async Task Discogs_relationship_URL_validation_is_strict(string resource, bool accepted)
    {
        string fixture = ReadFixture("release-related-discogs-url.json").Replace(
            "https://www.discogs.com/ru/release/12345-release-name?utm_source=test#fragment",
            resource,
            StringComparison.Ordinal);
        var handler = new CapturingHandler((_, _) => Task.FromResult(JsonResponse(fixture)));
        using var harness = new ProviderHarness(handler, ValidOptions());

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000004"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(accepted ? 1 : 0, result.Value.RelatedSources.Count);
    }

    [Fact]
    public async Task Cached_release_detail_avoids_a_second_handler_call()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-detail.json"))));
        using var harness = new ProviderHarness(handler, ValidOptions());
        var query = new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001");

        ExternalMetadataResult<ExternalMetadataReleaseDetail> first =
            await harness.Provider.GetReleaseAsync(query, CancellationToken.None);
        ExternalMetadataResult<ExternalMetadataReleaseDetail> second =
            await harness.Provider.GetReleaseAsync(query, CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Search_caps_valid_hypotheses_after_deterministic_ordering()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("recording-search.json"))));
        using var harness = new ProviderHarness(handler, ValidOptions(maxRecordingCandidates: 2));

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.RecordingSearchOutcome> result =
            await harness.Provider.SearchRecordingsAsync(
            "First",
            ["Artist"],
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(
            ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"],
            result.Value.Recordings.Select(recording => recording.Mbid));
    }
}
