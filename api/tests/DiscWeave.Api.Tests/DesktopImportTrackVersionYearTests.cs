using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportConfirmationDetailsTests
{
    [Fact(DisplayName = "Desktop import draft track year inherits selected year root folder")]
    public async Task Desktop_import_draft_track_year_inherits_selected_year_root_folder()
    {
        using var root = TempImportRoot.Create();
        string yearDirectory = Path.Combine(root.Path, "1991");
        string releaseDirectory = Path.Combine(yearDirectory, "The Orb's Adventures Beyond The Ultraworld");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Little Fluffy Clouds.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await PostScanAsync(client, yearDirectory, audioPath, coverPath);
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        JsonElement track = draft.GetProperty("tracks")[0];

        Assert.Equal(1991, draft.GetProperty("year").GetInt32());
        Assert.Equal(1991, track.GetProperty("versionYear").GetInt32());
    }

    [Fact(DisplayName = "Desktop import draft track year inherits release year and can be overridden")]
    public async Task Desktop_import_draft_track_year_inherits_release_year_and_can_be_overridden()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[AA 01, 2016-07-15] Steven Julien - Fallen");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Begins.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid existingArtistId = await CreateArtistAsync(client, "Version Import Artist");
        Guid labelId = await CreateLabelAsync(client, "Version Import Label");

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid trackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        Assert.Equal(2016, draft.GetProperty("tracks")[0].GetProperty("versionYear").GetInt32());

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayload(existingArtistId, labelId, trackId, trackVersionYear: 2014));
        using JsonDocument update = await ReadJsonAsync(updateResponse);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(2014, update.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0].GetProperty("versionYear").GetInt32());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirm = await ReadJsonAsync(confirmResponse);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        using HttpResponseMessage tracksResponse = await client.GetAsync("/api/tracks?search=Edited%20Begins&limit=10&offset=0");
        using JsonDocument tracks = await ReadJsonAsync(tracksResponse);

        Assert.Equal(HttpStatusCode.OK, tracksResponse.StatusCode);
        Assert.Equal(1, tracks.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(2014, tracks.RootElement.GetProperty("items")[0].GetProperty("versionYear").GetInt32());
    }

    [Fact(DisplayName = "Desktop import confirmation applies inherited track year to linked existing track")]
    public async Task Desktop_import_confirmation_applies_inherited_track_year_to_linked_existing_track()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[AA 01, 2016-07-15] Steven Julien - Fallen");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Begins.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid existingArtistId = await CreateArtistAsync(client, "Linked Version Import Artist");
        Guid labelId = await CreateLabelAsync(client, "Linked Version Import Label");
        using HttpResponseMessage existingTrackResponse = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title = "Edited Begins", durationSeconds = 321 });
        using JsonDocument existingTrackDocument = await ReadJsonAsync(existingTrackResponse);
        Assert.Equal(HttpStatusCode.Created, existingTrackResponse.StatusCode);
        Guid existingTrackId = existingTrackDocument.RootElement.GetProperty("id").GetGuid();

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid trackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayload(
                existingArtistId,
                labelId,
                trackId,
                selectedTrackId: existingTrackId,
                trackMode: "link"));
        using JsonDocument update = await ReadJsonAsync(updateResponse);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(2016, update.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0].GetProperty("versionYear").GetInt32());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirm = await ReadJsonAsync(confirmResponse);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        using HttpResponseMessage trackResponse = await client.GetAsync($"/api/tracks/{existingTrackId}");
        using JsonDocument track = await ReadJsonAsync(trackResponse);

        Assert.Equal(HttpStatusCode.OK, trackResponse.StatusCode);
        Assert.Equal(2016, track.RootElement.GetProperty("versionYear").GetInt32());
    }
}
