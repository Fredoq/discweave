using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportScanParsingTests
{
    [Fact(DisplayName = "Multiple cover candidates still report an oversized selected artifact")]
    public async Task Multiple_cover_candidates_still_report_an_oversized_selected_artifact()
    {
        const string root = "/music/covers";
        const string directory = root + "/[AA 01, 2016-07-15] Steven Julien - Fallen";
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", new
        {
            sourceRoot = root,
            ignoredFileCount = 0,
            diagnostics = Array.Empty<object>(),
            files = new[]
            {
                AudioFile(root, directory + "/01 Begins.flac", "flac"),
                CoverFile(root, directory + "/front.jpg", "front.jpg", ".jpg", "image/jpeg", 5),
                CoverFile(root, directory + "/cover.jpg", "cover.jpg", ".jpg", "image/jpeg", 10_485_761)
            }
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using JsonDocument scan = await ReadJsonAsync(response);
        JsonElement draft = Assert.Single(scan.RootElement.GetProperty("drafts").EnumerateArray());
        JsonElement issue = Assert.Single(draft.GetProperty("issues").EnumerateArray());
        Assert.Equal("release_import.cover_too_large", issue.GetProperty("code").GetString());
        Assert.Equal(directory + "/cover.jpg", draft.GetProperty("coverPath").GetString());
    }

    [Fact(DisplayName = "Multiple cover candidates retain the selected artifact and source files without a warning")]
    public async Task Multiple_cover_candidates_retain_the_selected_artifact_and_source_files_without_a_warning()
    {
        using var root = TempImportRoot.Create();
        string directory = Path.Combine(root.Path, "[AA 01, 2016-07-15] Steven Julien - Fallen");
        _ = Directory.CreateDirectory(directory);
        string audio = Path.Combine(directory, "01 Begins.flac");
        string cover = Path.Combine(directory, "cover.jpg");
        string front = Path.Combine(directory, "front.jpg");
        await File.WriteAllTextAsync(audio, "flac");
        await File.WriteAllTextAsync(cover, "source cover");
        await File.WriteAllTextAsync(front, "front");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", new
        {
            sourceRoot = root.Path,
            ignoredFileCount = 0,
            diagnostics = Array.Empty<object>(),
            files = new[]
            {
                AudioFile(root.Path, audio, "flac"),
                CoverFile(root.Path, front, "front.jpg", ".jpg", "image/jpeg", 5, "ZnJvbnQ="),
                CoverFile(root.Path, cover, "cover.jpg", ".jpg", "image/jpeg", 5)
            }
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using JsonDocument scan = await ReadJsonAsync(response);
        JsonElement draft = Assert.Single(scan.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Empty(draft.GetProperty("issues").EnumerateArray());
        Assert.Equal(cover, draft.GetProperty("coverPath").GetString());
        Assert.Equal(0, scan.RootElement.GetProperty("ignoredFileCount").GetInt32());

        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = draft.GetProperty("id").GetGuid();
        using HttpResponseMessage confirmed = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        using JsonDocument confirmation = await ReadJsonAsync(confirmed);
        Guid releaseId = confirmation.RootElement.GetProperty("drafts")[0].GetProperty("confirmedReleaseId").GetGuid();
        using HttpResponseMessage artwork = await client.GetAsync($"/api/releases/{releaseId}/cover-image");
        Assert.Equal(HttpStatusCode.OK, artwork.StatusCode);
        Assert.Equal("cover", await artwork.Content.ReadAsStringAsync());
        Assert.Equal("source cover", await File.ReadAllTextAsync(cover));
        Assert.Equal("front", await File.ReadAllTextAsync(front));
    }
}
