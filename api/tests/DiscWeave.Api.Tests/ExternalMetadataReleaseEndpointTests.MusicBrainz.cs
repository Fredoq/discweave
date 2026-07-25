using System.Net;
using System.Text.Json;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class ExternalMetadataReleaseEndpointTests
{
    [Fact(DisplayName = "Generic release response preserves row and related external sources")]
    public async Task Generic_release_response_preserves_row_and_related_external_sources()
    {
        ExternalMetadataSource releaseSource = MusicBrainzSource(
            "release",
            "10000000-0000-0000-0000-000000000001");
        ExternalMetadataSource trackSource = MusicBrainzSource(
            "track",
            "30000000-0000-0000-0000-000000000001");
        ExternalMetadataSource recordingSource = MusicBrainzSource(
            "recording",
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var provider = new FakeExternalMetadataProvider
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
                new ExternalMetadataReleaseDetail(
                    releaseSource,
                    "Mapped Release",
                    ["Release Artist"],
                    1980,
                    new DateOnly(1980, 2, 3),
                    ["Label One"],
                    ["12\" Vinyl"],
                    "album",
                    [],
                    [
                        new ExternalMetadataReleaseTrack(
                            "Mapped Track",
                            "A1",
                            TimeSpan.FromSeconds(181),
                            ["Track Artist"],
                            "1",
                            null,
                            null,
                            [trackSource, recordingSource])
                    ],
                    [],
                    "CAT-1",
                    [],
                    [],
                    null,
                    [
                        new ExternalMetadataSource(
                            "discogs",
                            "release",
                            "12345",
                            "https://www.discogs.com/release/12345",
                            "Data provided by Discogs.")
                    ]))
        };
        await using ApiTestHost host = await ApiTestHost.CreateAsync(
            sqlite,
            services => FakeExternalMetadataProvider.Register(services, provider));
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync(
            "/api/external-metadata/discogs/releases/10000000-0000-0000-0000-000000000001");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument document = await ReadJsonAsync(response);
        JsonElement root = document.RootElement;
        Assert.Equal("discogs", root.GetProperty("relatedSources")[0].GetProperty("providerName").GetString());
        Assert.Equal("12345", root.GetProperty("relatedSources")[0].GetProperty("externalId").GetString());
        JsonElement sources = root.GetProperty("tracklist")[0].GetProperty("externalSources");
        Assert.Equal(2, sources.GetArrayLength());
        Assert.Equal("track", sources[0].GetProperty("resourceType").GetString());
        Assert.Equal("recording", sources[1].GetProperty("resourceType").GetString());
    }

    private static ExternalMetadataSource MusicBrainzSource(string resourceType, string externalId)
    {
        return new ExternalMetadataSource(
            "musicbrainz",
            resourceType,
            externalId,
            $"https://musicbrainz.org/{resourceType}/{externalId}",
            "Data provided by MusicBrainz.");
    }
}
