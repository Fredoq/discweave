using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportScanParsingTests
{
    [Theory(DisplayName = "Desktop scan applies a bounded request limit to combined cover artifacts")]
    [InlineData(3, HttpStatusCode.Created)]
    [InlineData(13, HttpStatusCode.RequestEntityTooLarge)]
    public async Task Desktop_scan_applies_a_bounded_request_limit_to_combined_cover_artifacts(
        int releaseCount,
        HttpStatusCode expectedStatus)
    {
        using var root = TempImportRoot.Create();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        host.UseKestrel();
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        client.DefaultRequestHeaders.ExpectContinue = true;
        const int coverSize = 8 * 1024 * 1024;
        string coverContent = Convert.ToBase64String(new byte[coverSize]);
        List<object> files = [];
        for (int index = 0; index < releaseCount; index++)
        {
            string releaseDirectory = Path.Combine(root.Path, $"Artist - Album {index}");
            files.Add(AudioFile(root.Path, Path.Combine(releaseDirectory, "01 Track.flac"), "flac"));
            files.Add(CoverFile(root.Path, Path.Combine(releaseDirectory, "cover.jpg"),
                "cover.jpg", ".jpg", "image/jpeg", coverSize, coverContent));
        }

        using var content = JsonContent.Create(new
        {
            sourceRoot = root.Path,
            scanMode = "full",
            files,
            ignoredFileCount = 0,
            diagnostics = Array.Empty<object>()
        });
        await content.LoadIntoBufferAsync();
        using HttpResponseMessage response = await client.PostAsync("/api/imports/desktop-folder-scans", content);

        Assert.Equal(expectedStatus, response.StatusCode);
        if (expectedStatus == HttpStatusCode.Created)
        {
            using JsonDocument document = await ReadJsonAsync(response);
            Assert.Equal(3, document.RootElement.GetProperty("draftCount").GetInt32());
            Assert.Equal(3, document.RootElement.GetProperty("trackCount").GetInt32());
            using HttpResponseMessage otherResponse = await client.PostAsync("/api/imports/external-release-drafts", content);
            Assert.Equal(HttpStatusCode.RequestEntityTooLarge, otherResponse.StatusCode);
        }
    }
}
