using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Fact(DisplayName = "Discogs index sub tracks make the tracklist incomplete")]
    public async Task Discogs_index_sub_tracks_make_the_tracklist_incomplete()
    {
        RecordingHttpMessageHandler handler = JsonHandler(
            // lang=json
            """
            {
              "id": 249504,
              "title": "Blue Monday",
              "uri": "/release/249504",
              "tracklist": [
                {
                  "type_": "index",
                  "title": "Movement",
                  "position": "A",
                  "sub_tracks": [
                    {
                      "type_": "track",
                      "title": "Part One",
                      "position": "A1"
                    }
                  ]
                }
              ]
            }
            """);
        DiscogsExternalMetadataProvider provider =
            CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
            await provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("249504"),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.TracklistComplete);
    }
}
