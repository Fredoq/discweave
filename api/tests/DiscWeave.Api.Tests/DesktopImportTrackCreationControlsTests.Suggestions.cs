using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportTrackCreationControlsTests
{
    [Fact(DisplayName = "Import track suggestions ignore typographic apostrophes and bracketed version suffixes")]
    public async Task Import_track_suggestions_ignore_typographic_apostrophes_and_bracketed_version_suffixes()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 72, 2012] Calvin Harris - 18 Months");
        _ = Directory.CreateDirectory(releaseDirectory);
        string filePath = Path.Combine(releaseDirectory, "05 We’ll Be Coming Back (Feat. Example).flac");
        await File.WriteAllTextAsync(filePath, "coming back");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid existingTrackId = await CreateTrackAsync(client, "We'll Be Coming Back (Original Mix)");
        _ = await CreateTrackAsync(client, "Mansion");

        using JsonDocument scanDocument = await PostScanAsync(client, root.Path, filePath);
        JsonElement track = scanDocument.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];
        JsonElement suggestion = Assert.Single(track.GetProperty("trackSuggestions").EnumerateArray());

        Assert.Equal(existingTrackId, suggestion.GetProperty("id").GetGuid());
        Assert.Equal("close", suggestion.GetProperty("match").GetString());
    }
}
