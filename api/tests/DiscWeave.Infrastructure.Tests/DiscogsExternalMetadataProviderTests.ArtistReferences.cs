using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Fact(DisplayName = "Release detail maps Discogs artist ids into artist references")]
    public async Task Release_detail_maps_Discogs_artist_ids_into_artist_references()
    {
        RecordingHttpMessageHandler handler = JsonHandler(
            // lang=json
            """
            {
              "id": 249504,
              "title": "Show Me Love",
              "uri": "/release/249504-Robin-Stone-Show-Me-Love",
              "artists": [
                {
                  "name": "Robin Stone (2)",
                  "id": 111,
                  "resource_url": "https://api.discogs.com/artists/111"
                }
              ],
              "tracklist": [
                {
                  "type_": "track",
                  "title": "Show Me Love (Maritius Mix)",
                  "position": "A1",
                  "artists": [
                    {
                      "name": "Robin Stone (2)",
                      "id": 111,
                      "resource_url": "https://api.discogs.com/artists/111"
                    }
                  ],
                  "extraartists": [
                    {
                      "name": "Anthony King (11)",
                      "role": "Mixed By",
                      "id": 222,
                      "resource_url": "https://api.discogs.com/artists/222"
                    }
                  ]
                }
              ],
              "extraartists": [
                {
                  "name": "StoneBridge",
                  "role": "Remix",
                  "id": 333,
                  "resource_url": "https://api.discogs.com/artists/333"
                }
              ]
            }
            """);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
            await provider.GetReleaseAsync(new ExternalMetadataLookupQuery("249504"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        ExternalMetadataArtistReference releaseArtist = Assert.Single(result.Value.ArtistReferences!);
        Assert.Equal("Robin Stone", releaseArtist.Name);
        Assert.Equal("111", releaseArtist.Source?.ExternalId);
        Assert.Equal("https://www.discogs.com/artist/111", releaseArtist.Source?.SourceUrl);

        ExternalMetadataArtistReference trackArtist = Assert.Single(result.Value.Tracklist[0].ArtistReferences!);
        Assert.Equal("Robin Stone", trackArtist.Name);
        Assert.Equal("111", trackArtist.Source?.ExternalId);

        Assert.Contains(result.Value.Credits, credit =>
            credit.Name == "Anthony King" &&
            credit.Source?.ExternalId == "222" &&
            credit.TrackPosition == "A1");
        Assert.Contains(result.Value.Credits, credit =>
            credit.Name == "StoneBridge" &&
            credit.Source?.ExternalId == "333" &&
            credit.TrackPosition is null);
    }
}
