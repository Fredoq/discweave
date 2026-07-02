using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportDiscogsProvenanceTests
{
    [Fact(DisplayName = "Desktop import confirmation creates Discogs sourced artist separate from same-name local artist")]
    public async Task Desktop_import_confirmation_creates_Discogs_sourced_artist_separate_from_same_name_local_artist()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[SHOW 01, 1993] Robin Stone - Show Me Love");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Show Me Love.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage localArtistResponse = await client.PostAsJsonAsync(
            "/api/artists",
            new { name = "Robin Stone", type = "person" });
        Assert.Equal(HttpStatusCode.Created, localArtistResponse.StatusCode);

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid trackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayloadWithArtistSource(trackId, "111"));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            null);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Robin%20Stone&limit=10&offset=0");
        using JsonDocument artists = await ReadJsonAsync(artistsResponse);

        Assert.Equal(HttpStatusCode.OK, artistsResponse.StatusCode);
        Assert.Equal(2, artists.RootElement.GetProperty("total").GetInt32());
        JsonElement sourcedArtist = Assert.Single(
            artists.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("externalSources").EnumerateArray().Any(source =>
                source.GetProperty("providerName").GetString() == "discogs" &&
                source.GetProperty("resourceType").GetString() == "artist" &&
                source.GetProperty("externalId").GetString() == "111"));
        Assert.Equal("Robin Stone", sourcedArtist.GetProperty("name").GetString());
    }

    [Fact(DisplayName = "Desktop import confirmation reuses selected artist for later same Discogs source credit")]
    public async Task Desktop_import_confirmation_reuses_selected_artist_for_later_same_discogs_source_credit()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[SHOW 01, 1993] Robin Stone - Show Me Love");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Show Me Love.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage selectedArtistResponse = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Robin Stone",
                type = "person",
                externalSources = new[]
                {
                    ExternalArtistSource(
                        "musicbrainz",
                        "artist",
                        "mb-robin-stone",
                        "https://musicbrainz.org/artist/mb-robin-stone")
                }
            });
        using JsonDocument selectedArtist = await ReadJsonAsync(selectedArtistResponse);
        Assert.Equal(HttpStatusCode.Created, selectedArtistResponse.StatusCode);
        Guid selectedArtistId = selectedArtist.RootElement.GetProperty("id").GetGuid();

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid trackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayloadWithSelectedArtistAndTrackArtistSource(trackId, selectedArtistId, "111"));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            null);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Robin%20Stone&limit=10&offset=0");
        using JsonDocument artists = await ReadJsonAsync(artistsResponse);

        Assert.Equal(HttpStatusCode.OK, artistsResponse.StatusCode);
        Assert.Equal(1, artists.RootElement.GetProperty("total").GetInt32());
        JsonElement artist = Assert.Single(artists.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal(selectedArtistId, artist.GetProperty("id").GetGuid());
        JsonElement[] externalSources = [.. artist.GetProperty("externalSources").EnumerateArray()];
        Assert.Contains(externalSources, source =>
            source.GetProperty("providerName").GetString() == "musicbrainz" &&
            source.GetProperty("resourceType").GetString() == "artist" &&
            source.GetProperty("externalId").GetString() == "mb-robin-stone");
        Assert.Contains(externalSources, source =>
            source.GetProperty("providerName").GetString() == "discogs" &&
            source.GetProperty("resourceType").GetString() == "artist" &&
            source.GetProperty("externalId").GetString() == "111");
    }

    [Fact(DisplayName = "Desktop import confirmation preserves non-Discogs artist disambiguation suffix")]
    public async Task Desktop_import_confirmation_preserves_non_discogs_artist_disambiguation_suffix()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[ALT 01, 1993] Robin Stone (2) - Show Me Love");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Show Me Love.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid trackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayloadWithNonDiscogsArtistSource(trackId, "Robin Stone (2)", "mb-robin-stone-2"));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            null);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Robin%20Stone%20%282%29&limit=10&offset=0");
        using JsonDocument artists = await ReadJsonAsync(artistsResponse);

        Assert.Equal(HttpStatusCode.OK, artistsResponse.StatusCode);
        JsonElement artist = Assert.Single(artists.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal("Robin Stone (2)", artist.GetProperty("name").GetString());
        JsonElement source = Assert.Single(artist.GetProperty("externalSources").EnumerateArray());
        Assert.Equal("musicbrainz", source.GetProperty("providerName").GetString());
        Assert.Equal("artist", source.GetProperty("resourceType").GetString());
        Assert.Equal("mb-robin-stone-2", source.GetProperty("externalId").GetString());
    }

    [Fact(DisplayName = "Desktop import draft update ignores incomplete artist credit external source")]
    public async Task Desktop_import_draft_update_ignores_incomplete_artist_credit_external_source()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[SHOW 01, 1993] Robin Stone - Show Me Love");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Show Me Love.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid trackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayloadWithBlankArtistSource(trackId));
        using JsonDocument update = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(
            JsonValueKind.Null,
            update.RootElement
                .GetProperty("drafts")[0]
                .GetProperty("artistCredits")[0]
                .GetProperty("externalSource")
                .ValueKind);
    }
}
