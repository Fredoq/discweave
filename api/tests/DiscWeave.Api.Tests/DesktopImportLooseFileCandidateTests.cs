using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Desktop scan persists root audio as loose candidates without catalog rows")]
    public async Task Desktop_scan_persists_root_audio_as_loose_candidates_without_catalog_rows()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "Root Track.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, audioPath, "root-hash", title: "Root Track", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage detailResponse = await client.GetAsync($"/api/imports/{sessionId}");
        using JsonDocument detailDocument = await ReadJsonAsync(detailResponse);
        using HttpResponseMessage releaseResponse = await client.GetAsync("/api/releases?limit=10&offset=0");
        using JsonDocument releaseDocument = await ReadJsonAsync(releaseResponse);
        using HttpResponseMessage trackResponse = await client.GetAsync("/api/tracks?limit=10&offset=0");
        using JsonDocument trackDocument = await ReadJsonAsync(trackResponse);
        using HttpResponseMessage itemResponse = await client.GetAsync("/api/owned-items?limit=10&offset=0");
        using JsonDocument itemDocument = await ReadJsonAsync(itemResponse);
        string rawResponse = detailDocument.RootElement.GetRawText();

        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        AssertLooseSessionCounts(detailDocument.RootElement, draftCount: 0, trackCount: 0, ignoredFileCount: 0, looseCount: 1);
        JsonElement candidate = Assert.Single(detailDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray());
        Assert.Equal(audioPath, candidate.GetProperty("filePath").GetString());
        Assert.Equal("Root Track.flac", candidate.GetProperty("relativePath").GetString());
        Assert.Equal("flac", candidate.GetProperty("format").GetString());
        Assert.Equal("root-hash", candidate.GetProperty("contentHash").GetString());
        Assert.Equal("Root Track", candidate.GetProperty("titleHint").GetString());
        Assert.Equal("Loose Artist", candidate.GetProperty("artistHints")[0].GetString());
        Assert.Equal("root_audio_unclear_release_context", candidate.GetProperty("reason").GetString());
        Assert.Equal("pending", candidate.GetProperty("decision").GetString());
        Assert.False(rawResponse.Contains("contentBase64", StringComparison.OrdinalIgnoreCase));
        Assert.False(rawResponse.Contains("audioBytes", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(0, releaseDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(0, trackDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(0, itemDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Empty(await host.LocalAudioFilesAsync());
        Assert.Empty(await host.DigitalTrackFileLinksAsync());
    }

    [Fact(DisplayName = "Desktop loose candidates survive reload and are idempotent by relative path")]
    public async Task Desktop_loose_candidates_survive_reload_and_are_idempotent_by_relative_path()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "Duplicate Loose.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        object file = LooseAudioFile(root.Path, audioPath, "duplicate-hash", title: "Duplicate Loose");

        using JsonDocument scanDocument = await PostLooseScanAsync(client, root.Path, file, file);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        using HttpResponseMessage detailResponse = await client.GetAsync($"/api/imports/{sessionId}");
        using JsonDocument detailDocument = await ReadJsonAsync(detailResponse);

        AssertLooseSessionCounts(scanDocument.RootElement, draftCount: 0, trackCount: 0, ignoredFileCount: 0, looseCount: 1);
        JsonElement candidate = Assert.Single(detailDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray());
        Assert.Equal("Duplicate Loose.flac", candidate.GetProperty("relativePath").GetString());
        Assert.Equal("duplicate-hash", candidate.GetProperty("contentHash").GetString());
    }

    [Fact(DisplayName = "Desktop loose candidates are isolated by collection")]
    public async Task Desktop_loose_candidates_are_isolated_by_collection()
    {
        using var rootA = TempImportRoot.Create();
        using var rootB = TempImportRoot.Create();
        string audioPathA = Path.Combine(rootA.Path, "A Loose.flac");
        string audioPathB = Path.Combine(rootB.Path, "B Loose.flac");
        await File.WriteAllTextAsync(audioPathA, "fake flac a");
        await File.WriteAllTextAsync(audioPathB, "fake flac b");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient clientA, HttpClient clientB) = await CreateLooseFileIsolationClientsAsync(host);

        using JsonDocument scanA = await PostLooseScanAsync(
            clientA,
            rootA.Path,
            LooseAudioFile(rootA.Path, audioPathA, "a-hash", title: "A Loose"));
        using JsonDocument scanB = await PostLooseScanAsync(
            clientB,
            rootB.Path,
            LooseAudioFile(rootB.Path, audioPathB, "b-hash", title: "B Loose"));
        Guid sessionAId = scanA.RootElement.GetProperty("id").GetGuid();
        Guid sessionBId = scanB.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage blockedResponse = await clientB.GetAsync($"/api/imports/{sessionAId}");
        using JsonDocument blockedDocument = await ReadJsonAsync(blockedResponse);
        using HttpResponseMessage detailBResponse = await clientB.GetAsync($"/api/imports/{sessionBId}");
        using JsonDocument detailBDocument = await ReadJsonAsync(detailBResponse);

        Assert.Equal(HttpStatusCode.NotFound, blockedResponse.StatusCode);
        Assert.Equal("release_import.not_found", blockedDocument.RootElement.GetProperty("code").GetString());
        JsonElement candidateB = Assert.Single(detailBDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray());
        Assert.Equal("B Loose.flac", candidateB.GetProperty("relativePath").GetString());
    }

    [Fact(DisplayName = "Desktop scan persists mixed album tag folders as loose candidates")]
    public async Task Desktop_scan_persists_mixed_album_tag_folders_as_loose_candidates()
    {
        using var root = TempImportRoot.Create();
        string folder = Path.Combine(root.Path, "Mixed Folder");
        _ = Directory.CreateDirectory(folder);
        string alphaPath = Path.Combine(folder, "01 Alpha.flac");
        string betaPath = Path.Combine(folder, "02 Beta.flac");
        await File.WriteAllTextAsync(alphaPath, "fake flac a");
        await File.WriteAllTextAsync(betaPath, "fake flac b");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, alphaPath, "alpha-hash", title: "Alpha", albumTitle: "Album A"),
            LooseAudioFile(root.Path, betaPath, "beta-hash", title: "Beta", albumTitle: "Album B"));

        AssertLooseSessionCounts(scanDocument.RootElement, draftCount: 0, trackCount: 0, ignoredFileCount: 0, looseCount: 2);
        JsonElement[] candidates = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()];
        Assert.All(candidates, candidate => Assert.Equal("mixed_album_tags", candidate.GetProperty("reason").GetString()));
        Assert.Contains(candidates, candidate => candidate.GetProperty("albumTitleHint").GetString() == "Album A");
        Assert.Contains(candidates, candidate => candidate.GetProperty("albumTitleHint").GetString() == "Album B");
    }

    private static async Task<JsonDocument> PostLooseScanAsync(HttpClient client, string rootPath, params object[] files)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = rootPath,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files
            });
        JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document;
    }

    private static object LooseAudioFile(
        string rootPath,
        string audioPath,
        string contentHash,
        string title,
        string albumTitle = "",
        string[]? artists = null)
    {
        string[] emptyNames = [];
        return new
        {
            filePath = audioPath,
            relativePath = Path.GetRelativePath(rootPath, audioPath),
            format = "flac",
            contentHash,
            sizeBytes = 9,
            lastModifiedAt = DateTimeOffset.UtcNow,
            audioMetadata = new
            {
                title,
                artists = artists ?? emptyNames,
                albumTitle,
                albumArtists = emptyNames,
                catalogNumber = (string?)null,
                releaseDate = (string?)null,
                year = (int?)null,
                durationSeconds = 123,
                trackNumber = (int?)null,
                codec = "FLAC",
                container = "flac",
                lossless = true,
                bitrateKbps = 900,
                sampleRateHz = 44100,
                channels = 2
            },
            coverArtifact = (object?)null
        };
    }

    private static async Task<(HttpClient OwnerClient, HttpClient CollectorClient)> CreateLooseFileIsolationClientsAsync(ApiTestHost host)
    {
        string suffix = Guid.NewGuid().ToString("N");
        string ownerEmail = $"owner-{suffix}@example.com";
        string collectorEmail = $"collector-{suffix}@example.com";
        HttpClient ownerClient = host.CreateClient();
        using HttpResponseMessage registerResponse = await ownerClient.PostAsJsonAsync(
            "/api/auth/register",
            new LooseFileAuthRequest(ownerEmail, "Password1!"));
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);
        using HttpResponseMessage createUserResponse = await ownerClient.PostAsJsonAsync(
            "/api/admin/users",
            new LooseFileCreateUserRequest(collectorEmail, "Password1!"));
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);

        HttpClient collectorClient = host.CreateClient();
        using HttpResponseMessage loginResponse = await collectorClient.PostAsJsonAsync(
            "/api/auth/login",
            new LooseFileAuthRequest(collectorEmail, "Password1!"));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return (ownerClient, collectorClient);
    }

    private sealed record LooseFileAuthRequest(string Email, string Password);

    private sealed record LooseFileCreateUserRequest(string Email, string Password);

    private static void AssertLooseSessionCounts(
        JsonElement session,
        int draftCount,
        int trackCount,
        int ignoredFileCount,
        int looseCount)
    {
        Assert.Equal(draftCount, session.GetProperty("draftCount").GetInt32());
        Assert.Equal(trackCount, session.GetProperty("trackCount").GetInt32());
        Assert.Equal(ignoredFileCount, session.GetProperty("ignoredFileCount").GetInt32());
        Assert.Equal(looseCount, session.GetProperty("looseFileCandidateCount").GetInt32());
        Assert.Equal(looseCount, session.GetProperty("looseFileCandidates").GetArrayLength());
    }
}
