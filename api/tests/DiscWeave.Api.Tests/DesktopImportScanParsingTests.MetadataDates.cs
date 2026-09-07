using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportScanParsingTests
{
    [Theory(DisplayName = "Desktop scan recovers valid years from dates and folders when audio metadata years are invalid")]
    [InlineData("2006", 6, "06 Mar 2006", 2006, "2006-03-06")]
    [InlineData("2006", 2, "02 Sep 2006", 2006, "2006-09-02")]
    [InlineData("2006", 0, null, 2006, null)]
    [InlineData("2006", 999, "0001-01-01", 2006, null)]
    [InlineData("2006", 10000, "0000-00-00", 2006, null)]
    [InlineData("Unknown", -1, null, null, null)]
    [InlineData("2006", 2007, "2006-03-06", 2007, "2006-03-06")]
    public async Task Desktop_scan_recovers_valid_years_from_dates_and_folders_when_audio_metadata_years_are_invalid(
        string sourceFolder, int metadataYear, string? metadataDate, int? expectedYear, string? expectedDate)
    {
        using var root = TempImportRoot.Create();
        string sourceRoot = Path.Combine(root.Path, sourceFolder);
        string audioPath = Path.Combine(sourceRoot, "Artist - Album", "01 Track.flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", new
        {
            sourceRoot,
            scanMode = "full",
            files = new[] { AudioFile(sourceRoot, audioPath, "flac", year: metadataYear, releaseDate: metadataDate) },
            ignoredFileCount = 0,
            diagnostics = Array.Empty<object>()
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using JsonDocument document = await ReadJsonAsync(response);
        JsonElement draft = document.RootElement.GetProperty("drafts")[0];
        Assert.Equal(expectedYear, draft.GetProperty("year").Deserialize<int?>());
        Assert.Equal(expectedYear, draft.GetProperty("tracks")[0].GetProperty("versionYear").Deserialize<int?>());
        Assert.Equal(expectedDate, draft.GetProperty("releaseDate").GetString());
        Assert.Equal(metadataYear is < 1000 or > 9999,
            draft.GetProperty("issues").EnumerateArray().Any(issue => issue.GetProperty("code").GetString() == "import.release_year_invalid"));
    }
}
