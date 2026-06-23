using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    private static readonly string[] AttachElectronicGenres = ["Electronic"];

    [Fact(DisplayName = "Loose candidates attach to an existing release track and create file links idempotently")]
    public async Task Loose_candidates_attach_to_existing_release_track_and_create_file_links_idempotently()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "01 Root Single.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateAttachArtistAsync(client, "Loose Artist");
        using JsonDocument releaseDocument = await CreateAttachReleaseAsync(
            client,
            "Existing Single",
            artistId,
            [
                new
                {
                    title = "Root Single",
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
            LooseAudioFile(root.Path, audioPath, "attach-hash", title: "Root Single", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId, releaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);
        using HttpResponseMessage repeatResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId, releaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument repeatDocument = await ReadJsonAsync(repeatResponse);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, repeatResponse.StatusCode);
        JsonElement candidate = Assert.Single(document.RootElement.GetProperty("looseFileCandidates").EnumerateArray());
        Assert.Equal("attachedToRelease", candidate.GetProperty("decision").GetString());
        JsonElement repeatCandidate = Assert.Single(repeatDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray());
        Assert.Equal("attachedToRelease", repeatCandidate.GetProperty("decision").GetString());
        LocalAudioFileSnapshot localFile = Assert.Single(await host.LocalAudioFilesAsync());
        Assert.Equal(audioPath, localFile.Path);
        Assert.Equal("attach-hash", localFile.ContentHash);
        DigitalTrackFileLinkSnapshot fileLink = Assert.Single(await host.DigitalTrackFileLinksAsync());
        Assert.Equal(releaseTrackId, fileLink.ReleaseTrackId);
        Assert.Equal(localFile.Id, fileLink.LocalAudioFileId);
        using HttpResponseMessage itemResponse = await client.GetAsync("/api/owned-items?limit=10&offset=0");
        using JsonDocument itemDocument = await ReadJsonAsync(itemResponse);
        Assert.Equal(1, itemDocument.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Loose attach allows partial mapping and leaves unmapped candidates pending")]
    public async Task Loose_attach_allows_partial_mapping_and_leaves_unmapped_candidates_pending()
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
            "Partial Release",
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
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, firstPath, "partial-first-hash", title: "First", artists: ["Loose Artist"]),
            LooseAudioFile(root.Path, secondPath, "partial-second-hash", title: "Second", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement[] candidates = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()];
        Guid firstCandidateId = candidates.Single(candidate => candidate.GetProperty("relativePath").GetString() == "01 First.flac").GetProperty("id").GetGuid();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId = firstCandidateId, releaseTrackId = firstReleaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement[] updatedCandidates = [.. document.RootElement.GetProperty("looseFileCandidates").EnumerateArray()];
        Assert.Contains(updatedCandidates, candidate =>
            candidate.GetProperty("relativePath").GetString() == "01 First.flac" &&
            candidate.GetProperty("decision").GetString() == "attachedToRelease");
        Assert.Contains(updatedCandidates, candidate =>
            candidate.GetProperty("relativePath").GetString() == "02 Second.flac" &&
            candidate.GetProperty("decision").GetString() == "pending");
        _ = Assert.Single(await host.LocalAudioFilesAsync());
        _ = Assert.Single(await host.DigitalTrackFileLinksAsync());
    }

    [Fact(DisplayName = "Loose attach requires explicit confirmation before relinking an existing file link")]
    public async Task Loose_attach_requires_explicit_confirmation_before_relinking_existing_file_link()
    {
        using var root = TempImportRoot.Create();
        string firstPath = Path.Combine(root.Path, "01 First.flac");
        string replacementPath = Path.Combine(root.Path, "01 Replacement.flac");
        await File.WriteAllTextAsync(firstPath, "fake flac 1");
        await File.WriteAllTextAsync(replacementPath, "fake flac replacement");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateAttachArtistAsync(client, "Loose Artist");
        using JsonDocument releaseDocument = await CreateAttachReleaseAsync(
            client,
            "Relink Release",
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
            LooseAudioFile(root.Path, firstPath, "relink-first-hash", title: "First", artists: ["Loose Artist"]),
            LooseAudioFile(root.Path, replacementPath, "relink-replacement-hash", title: "First", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement[] candidates = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()];
        Guid firstCandidateId = candidates.Single(candidate => candidate.GetProperty("relativePath").GetString() == "01 First.flac").GetProperty("id").GetGuid();
        Guid replacementCandidateId = candidates.Single(candidate => candidate.GetProperty("relativePath").GetString() == "01 Replacement.flac").GetProperty("id").GetGuid();
        using JsonDocument firstAttachDocument = await AttachLooseFileAsync(client, sessionId, releaseId, firstCandidateId, releaseTrackId, confirmRelink: false);
        Assert.Contains(firstAttachDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray(), candidate =>
            candidate.GetProperty("id").GetGuid() == firstCandidateId &&
            candidate.GetProperty("decision").GetString() == "attachedToRelease");
        DigitalTrackFileLinkSnapshot originalLink = Assert.Single(await host.DigitalTrackFileLinksAsync());

        using HttpResponseMessage blockedResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId = replacementCandidateId, releaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument blockedDocument = await ReadJsonAsync(blockedResponse);
        using JsonDocument relinkDocument = await AttachLooseFileAsync(client, sessionId, releaseId, replacementCandidateId, releaseTrackId, confirmRelink: true);

        Assert.Equal(HttpStatusCode.BadRequest, blockedResponse.StatusCode);
        Assert.Equal("release_import_loose_file.link_exists", blockedDocument.RootElement.GetProperty("code").GetString());
        DigitalTrackFileLinkSnapshot relinked = Assert.Single(await host.DigitalTrackFileLinksAsync());
        Assert.Equal(originalLink.Id, relinked.Id);
        Assert.NotEqual(originalLink.LocalAudioFileId, relinked.LocalAudioFileId);
        JsonElement replacementCandidate = relinkDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetGuid() == replacementCandidateId);
        Assert.Equal("attachedToRelease", replacementCandidate.GetProperty("decision").GetString());
    }

    [Fact(DisplayName = "Loose attach is isolated by collection")]
    public async Task Loose_attach_is_isolated_by_collection()
    {
        using var rootCollector = TempImportRoot.Create();
        string collectorPath = Path.Combine(rootCollector.Path, "01 Collector.flac");
        await File.WriteAllTextAsync(collectorPath, "fake collector flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient ownerClient, HttpClient collectorClient) = await CreateLooseFileIsolationClientsAsync(host);
        Guid ownerArtistId = await CreateAttachArtistAsync(ownerClient, "Owner Artist");
        using JsonDocument ownerReleaseDocument = await CreateAttachReleaseAsync(
            ownerClient,
            "Owner Release",
            ownerArtistId,
            [
                new
                {
                    title = "Collector",
                    position = 1,
                    durationSeconds = 123,
                    artistCredits = Array.Empty<object>()
                }
            ]);
        Guid ownerReleaseId = ownerReleaseDocument.RootElement.GetProperty("id").GetGuid();
        Guid ownerReleaseTrackId = ownerReleaseDocument.RootElement.GetProperty("tracklist")[0].GetProperty("releaseTrackId").GetGuid();
        using JsonDocument collectorScan = await PostLooseScanAsync(
            collectorClient,
            rootCollector.Path,
            LooseAudioFile(rootCollector.Path, collectorPath, "collector-hash", title: "Collector"));
        Guid collectorSessionId = collectorScan.RootElement.GetProperty("id").GetGuid();
        Guid collectorCandidateId = Assert.Single(collectorScan.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage response = await collectorClient.PostAsJsonAsync(
            $"/api/imports/{collectorSessionId}/loose-file-attachments",
            new
            {
                releaseId = ownerReleaseId,
                mappings = new[]
                {
                    new { candidateId = collectorCandidateId, releaseTrackId = ownerReleaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("release_import_loose_file.release_not_found", document.RootElement.GetProperty("code").GetString());
    }

}
