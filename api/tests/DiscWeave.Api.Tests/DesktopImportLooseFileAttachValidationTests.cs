using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Loose attach rejects consumed candidates for a different release track")]
    public async Task Loose_attach_rejects_consumed_candidates_for_a_different_release_track()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "01 Shared.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateAttachArtistAsync(client, "Loose Artist");
        using JsonDocument releaseDocument = await CreateAttachReleaseAsync(
            client,
            "Reuse Release",
            artistId,
            [
                new
                {
                    title = "First",
                    position = 1,
                    durationSeconds = 123,
                    artistCredits = Array.Empty<object>()
                },
                new
                {
                    title = "Second",
                    position = 2,
                    durationSeconds = 123,
                    artistCredits = Array.Empty<object>()
                }
            ]);
        Guid releaseId = releaseDocument.RootElement.GetProperty("id").GetGuid();
        Guid firstReleaseTrackId = releaseDocument.RootElement.GetProperty("tracklist")[0].GetProperty("releaseTrackId").GetGuid();
        Guid secondReleaseTrackId = releaseDocument.RootElement.GetProperty("tracklist")[1].GetProperty("releaseTrackId").GetGuid();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, audioPath, "reuse-hash", title: "Shared", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();
        using JsonDocument firstAttach = await AttachLooseFileAsync(client, sessionId, releaseId, candidateId, firstReleaseTrackId, confirmRelink: false);

        using HttpResponseMessage blockedResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId, releaseTrackId = secondReleaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument blockedDocument = await ReadJsonAsync(blockedResponse);

        Assert.Contains(firstAttach.RootElement.GetProperty("looseFileCandidates").EnumerateArray(), candidate =>
            candidate.GetProperty("id").GetGuid() == candidateId &&
            candidate.GetProperty("decision").GetString() == "attachedToRelease");
        Assert.Equal(HttpStatusCode.BadRequest, blockedResponse.StatusCode);
        Assert.Equal("release_import_loose_file.already_consumed", blockedDocument.RootElement.GetProperty("code").GetString());
        DigitalTrackFileLinkSnapshot link = Assert.Single(await host.DigitalTrackFileLinksAsync());
        Assert.Equal(firstReleaseTrackId, link.ReleaseTrackId);
    }

    [Fact(DisplayName = "Loose attach rejects duplicate release track mappings in one request")]
    public async Task Loose_attach_rejects_duplicate_release_track_mappings_in_one_request()
    {
        using var root = TempImportRoot.Create();
        string firstPath = Path.Combine(root.Path, "01 First.flac");
        string secondPath = Path.Combine(root.Path, "02 Second.flac");
        await File.WriteAllTextAsync(firstPath, "fake flac 1");
        await File.WriteAllTextAsync(secondPath, "fake flac 2");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateAttachArtistAsync(client, "Loose Artist");
        using JsonDocument releaseDocument = await CreateAttachReleaseAsync(
            client,
            "Duplicate Mapping Release",
            artistId,
            [
                new
                {
                    title = "First",
                    position = 1,
                    durationSeconds = 123,
                    artistCredits = Array.Empty<object>()
                }
            ]);
        Guid releaseId = releaseDocument.RootElement.GetProperty("id").GetGuid();
        Guid releaseTrackId = releaseDocument.RootElement.GetProperty("tracklist")[0].GetProperty("releaseTrackId").GetGuid();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, firstPath, "duplicate-map-first-hash", title: "First", artists: ["Loose Artist"]),
            LooseAudioFile(root.Path, secondPath, "duplicate-map-second-hash", title: "Second", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement[] candidates = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()];
        Guid firstCandidateId = candidates.Single(candidate => candidate.GetProperty("relativePath").GetString() == "01 First.flac").GetProperty("id").GetGuid();
        Guid secondCandidateId = candidates.Single(candidate => candidate.GetProperty("relativePath").GetString() == "02 Second.flac").GetProperty("id").GetGuid();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId = firstCandidateId, releaseTrackId, confirmRelink = false },
                    new { candidateId = secondCandidateId, releaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("release_import_loose_file.release_track_duplicate", document.RootElement.GetProperty("code").GetString());
        Assert.Empty(await host.LocalAudioFilesAsync());
        Assert.Empty(await host.DigitalTrackFileLinksAsync());
    }

    [Fact(DisplayName = "Loose attach rejects duplicate candidate mappings in one request")]
    public async Task Loose_attach_rejects_duplicate_candidate_mappings_in_one_request()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "01 Shared.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateAttachArtistAsync(client, "Loose Artist");
        using JsonDocument releaseDocument = await CreateAttachReleaseAsync(
            client,
            "Duplicate Candidate Release",
            artistId,
            [
                new
                {
                    title = "First",
                    position = 1,
                    durationSeconds = 123,
                    artistCredits = Array.Empty<object>()
                },
                new
                {
                    title = "Second",
                    position = 2,
                    durationSeconds = 123,
                    artistCredits = Array.Empty<object>()
                }
            ]);
        Guid releaseId = releaseDocument.RootElement.GetProperty("id").GetGuid();
        Guid firstReleaseTrackId = releaseDocument.RootElement.GetProperty("tracklist")[0].GetProperty("releaseTrackId").GetGuid();
        Guid secondReleaseTrackId = releaseDocument.RootElement.GetProperty("tracklist")[1].GetProperty("releaseTrackId").GetGuid();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, audioPath, "duplicate-candidate-hash", title: "Shared", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId, releaseTrackId = firstReleaseTrackId, confirmRelink = false },
                    new { candidateId, releaseTrackId = secondReleaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("release_import_loose_file.candidate_duplicate", document.RootElement.GetProperty("code").GetString());
        Assert.Empty(await host.LocalAudioFilesAsync());
        Assert.Empty(await host.DigitalTrackFileLinksAsync());
    }
}
