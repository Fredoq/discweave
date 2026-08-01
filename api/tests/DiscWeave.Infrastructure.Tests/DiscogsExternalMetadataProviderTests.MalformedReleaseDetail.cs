using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Theory(DisplayName = "Malformed Discogs release detail collections map to invalid response")]
    [InlineData("artists-entry")]
    [InlineData("labels-entry")]
    [InlineData("formats-entry")]
    [InlineData("identifiers-entry")]
    [InlineData("release-credit-entry")]
    [InlineData("tracklist-null")]
    [InlineData("tracklist-entry")]
    [InlineData("track-artists-entry")]
    [InlineData("track-credits-entry")]
    [InlineData("sub-track-entry")]
    public async Task Malformed_Discogs_release_detail_collections_map_to_invalid_response(
        string vector)
    {
        string payload = MalformedReleaseDetail(vector);
        DiscogsExternalMetadataProvider provider = CreateProvider(
            JsonHandler(payload));

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
            await provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("249504"),
                CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(
            ExternalMetadataErrorKind.InvalidResponse,
            result.Error.Kind);
        Assert.Equal(
            "external_metadata.invalid_response",
            result.Error.Code);
    }

    private static string MalformedReleaseDetail(string vector)
    {
        string artists = vector == "artists-entry"
            ? "[null]"
            : /*lang=json,strict*/ """[{ "id": 1, "name": "New Order" }]""";
        string labels = vector == "labels-entry"
            ? "[null]"
            : /*lang=json,strict*/ """[{ "name": "Factory", "catno": "FAC 73" }]""";
        string formats = vector == "formats-entry"
            ? "[null]"
            : /*lang=json,strict*/ """[{ "name": "Vinyl", "descriptions": ["12\""] }]""";
        string identifiers = vector == "identifiers-entry"
            ? "[null]"
            : /*lang=json,strict*/ """[{ "type": "Barcode", "value": "5016839200371" }]""";
        string releaseCredits = vector == "release-credit-entry"
            ? "[null]"
            : /*lang=json,strict*/ """[{ "name": "Producer", "role": "Producer" }]""";
        string trackArtists = vector == "track-artists-entry"
            ? "[null]"
            : /*lang=json,strict*/ """[{ "id": 1, "name": "New Order" }]""";
        string trackCredits = vector == "track-credits-entry"
            ? "[null]"
            : /*lang=json,strict*/ """[{ "name": "Remixer", "role": "Remix" }]""";
        string subTracks = vector == "sub-track-entry"
            ? "[null]"
            : "[]";
        string tracklist = vector switch
        {
            "tracklist-null" => "null",
            "tracklist-entry" => "[null]",
            _ =>
                $$"""
                  [{
                    "type_": "track",
                    "title": "Blue Monday",
                    "position": "A1",
                    "artists": {{trackArtists}},
                    "extraartists": {{trackCredits}},
                    "sub_tracks": {{subTracks}}
                  }]
                  """
        };

        return
            $$"""
              {
                "id": 249504,
                "title": "Blue Monday",
                "artists": {{artists}},
                "labels": {{labels}},
                "formats": {{formats}},
                "identifiers": {{identifiers}},
                "extraartists": {{releaseCredits}},
                "tracklist": {{tracklist}}
              }
              """;
    }
}
