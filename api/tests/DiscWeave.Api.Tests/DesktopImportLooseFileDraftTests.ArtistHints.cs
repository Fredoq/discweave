using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Matching multi-artist album tags do not create a conflict notice")]
    public async Task Matching_multi_artist_album_tags_do_not_create_a_conflict_notice()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        const string root = "/music/multi-artist-tags";
        using JsonDocument scan = await PostLooseScanAsync(client, root,
            LooseAudioFileWithTags(root, root + "/01 First.flac", "first-hash", title: "First",
                albumTitle: "Together", albumArtists: ["Artist A", "Artist B"], trackNumber: 1),
            LooseAudioFileWithTags(root, root + "/02 Second.flac", "second-hash", title: "Second",
                albumTitle: "Together", albumArtists: ["artist b", "Artist A"], trackNumber: 2));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid[] candidateIds = [.. scan.RootElement.GetProperty("looseFileCandidates").EnumerateArray()
            .Select(candidate => candidate.GetProperty("id").GetGuid())];
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts", new { candidateIds });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.DoesNotContain(draft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.loose_file_album_artist_conflict");
    }
}
