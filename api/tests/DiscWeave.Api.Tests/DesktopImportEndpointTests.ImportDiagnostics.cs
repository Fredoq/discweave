using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Desktop scan persists diagnostics without creating catalog or file link rows")]
    public async Task Desktop_scan_persists_diagnostics_without_creating_catalog_or_file_link_rows()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = "/tmp/discweave-diagnostics",
                ignoredFileCount = 2,
                diagnostics = new[]
                {
                    new
                    {
                        code = "unsupported_extension",
                        severity = "info",
                        message = "Import scanner skipped an unsupported file extension.",
                        filePath = "/tmp/discweave-diagnostics/notes.txt",
                        relativePath = "notes.txt",
                        extension = ".txt",
                        sizeBytes = 120,
                        source = "scanner"
                    },
                    new
                    {
                        code = "metadata_read_failed",
                        severity = "warning",
                        message = "Import scanner could not read audio metadata for this file.",
                        filePath = "/tmp/discweave-diagnostics/01 Track.flac",
                        relativePath = "01 Track.flac",
                        extension = ".flac",
                        sizeBytes = 1024,
                        source = "metadata"
                    }
                },
                files = Array.Empty<object>()
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage detailResponse = await client.GetAsync($"/api/imports/{sessionId}");
        using JsonDocument detailDocument = await ReadJsonAsync(detailResponse);
        using HttpResponseMessage listResponse = await client.GetAsync("/api/imports");
        using JsonDocument listDocument = await ReadJsonAsync(listResponse);
        using HttpResponseMessage releaseResponse = await client.GetAsync("/api/releases?limit=10&offset=0");
        using JsonDocument releaseDocument = await ReadJsonAsync(releaseResponse);
        using HttpResponseMessage trackResponse = await client.GetAsync("/api/tracks?limit=10&offset=0");
        using JsonDocument trackDocument = await ReadJsonAsync(trackResponse);
        using HttpResponseMessage itemResponse = await client.GetAsync("/api/owned-items?limit=10&offset=0");
        using JsonDocument itemDocument = await ReadJsonAsync(itemResponse);

        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Equal(0, detailDocument.RootElement.GetProperty("draftCount").GetInt32());
        Assert.Equal(0, detailDocument.RootElement.GetProperty("trackCount").GetInt32());
        Assert.Equal(2, detailDocument.RootElement.GetProperty("ignoredFileCount").GetInt32());
        JsonElement[] diagnostics = [.. detailDocument.RootElement.GetProperty("diagnostics").EnumerateArray()];
        Assert.Equal(2, diagnostics.Length);
        Assert.Contains(diagnostics, diagnostic =>
            diagnostic.GetProperty("code").GetString() == "unsupported_extension" &&
            diagnostic.GetProperty("severity").GetString() == "info" &&
            diagnostic.GetProperty("relativePath").GetString() == "notes.txt");
        Assert.Contains(diagnostics, diagnostic =>
            diagnostic.GetProperty("code").GetString() == "metadata_read_failed" &&
            diagnostic.GetProperty("severity").GetString() == "warning" &&
            diagnostic.GetProperty("source").GetString() == "metadata");

        JsonElement[] summaries = [.. detailDocument.RootElement.GetProperty("diagnosticSummaries").EnumerateArray()];
        Assert.Contains(summaries, summary =>
            summary.GetProperty("code").GetString() == "unsupported_extension" &&
            summary.GetProperty("severity").GetString() == "info" &&
            summary.GetProperty("count").GetInt32() == 1);
        Assert.Contains(summaries, summary =>
            summary.GetProperty("code").GetString() == "metadata_read_failed" &&
            summary.GetProperty("severity").GetString() == "warning" &&
            summary.GetProperty("count").GetInt32() == 1);
        JsonElement[] listSummaries =
        [
            .. listDocument.RootElement.GetProperty("items")[0]
                .GetProperty("diagnosticSummaries")
                .EnumerateArray()
        ];
        Assert.Contains(listSummaries, summary =>
            summary.GetProperty("code").GetString() == "unsupported_extension" &&
            summary.GetProperty("severity").GetString() == "info" &&
            summary.GetProperty("count").GetInt32() == 1);

        Assert.Equal(0, releaseDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(0, trackDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(0, itemDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Empty(await host.LocalAudioFilesAsync());
        Assert.Empty(await host.DigitalTrackFileLinksAsync());
    }
}
