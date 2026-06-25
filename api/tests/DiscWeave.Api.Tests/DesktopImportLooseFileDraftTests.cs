using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Loose candidates create a one-file release import draft")]
    public async Task Loose_candidates_create_one_file_release_import_draft()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "Root Single.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, audioPath, "single-hash", title: "Root Single", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds = new[] { candidateId, candidateId } });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        AssertLooseSessionCounts(document.RootElement, draftCount: 1, trackCount: 1, ignoredFileCount: 0, looseCount: 1);
        JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Equal("Root Single", draft.GetProperty("title").GetString());
        Assert.Equal("unknown", draft.GetProperty("type").GetString());
        Assert.Equal("Loose Artist", draft.GetProperty("artistNames")[0].GetString());
        JsonElement track = Assert.Single(draft.GetProperty("tracks").EnumerateArray());
        Assert.Equal("Root Single", track.GetProperty("title").GetString());
        Assert.Equal(1, track.GetProperty("position").GetInt32());
        Assert.Equal("Root Single.flac", track.GetProperty("relativePath").GetString());
        Assert.Equal("flac", track.GetProperty("format").GetString());
        JsonElement candidate = Assert.Single(document.RootElement.GetProperty("looseFileCandidates").EnumerateArray());
        Assert.Equal("convertedToDraft", candidate.GetProperty("decision").GetString());
        Assert.Equal(draft.GetProperty("id").GetGuid(), candidate.GetProperty("sourceDraftId").GetGuid());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draft.GetProperty("id").GetGuid()}/confirm", null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage releaseResponse = await client.GetAsync("/api/releases?search=Root%20Single&limit=10&offset=0");
        using JsonDocument releaseDocument = await ReadJsonAsync(releaseResponse);
        using HttpResponseMessage trackResponse = await client.GetAsync("/api/tracks?search=Root%20Single&limit=10&offset=0");
        using JsonDocument trackDocument = await ReadJsonAsync(trackResponse);
        using HttpResponseMessage itemResponse = await client.GetAsync("/api/owned-items?limit=10&offset=0");
        using JsonDocument itemDocument = await ReadJsonAsync(itemResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        Assert.Equal(1, releaseDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(1, trackDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(1, itemDocument.RootElement.GetProperty("total").GetInt32());
        JsonElement ownedItem = itemDocument.RootElement.GetProperty("items")[0];
        JsonElement digitalFile = Assert.Single(ownedItem.GetProperty("details").GetProperty("digital").GetProperty("files").EnumerateArray());
        Assert.Equal(audioPath, digitalFile.GetProperty("path").GetString());
        Assert.Equal("flac", digitalFile.GetProperty("format").GetString());
        LocalAudioFileSnapshot localFile = Assert.Single(await host.LocalAudioFilesAsync());
        Assert.Equal(audioPath, localFile.Path);
        DigitalTrackFileLinkSnapshot fileLink = Assert.Single(await host.DigitalTrackFileLinksAsync());
        Assert.Equal(localFile.Id, fileLink.LocalAudioFileId);
        Assert.Equal(ownedItem.GetProperty("id").GetGuid(), fileLink.DigitalOwnedItemId);
        Assert.NotEqual(Guid.Empty, fileLink.ReleaseTrackId);
    }

    [Fact(DisplayName = "Loose candidates create a multi-file release draft from shared album tags")]
    public async Task Loose_candidates_create_multi_file_release_draft_from_shared_album_tags()
    {
        using var root = TempImportRoot.Create();
        string firstPath = Path.Combine(root.Path, "01 First.flac");
        string secondPath = Path.Combine(root.Path, "02 Second.flac");
        await File.WriteAllTextAsync(firstPath, "fake flac 1");
        await File.WriteAllTextAsync(secondPath, "fake flac 2");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFileWithTags(root.Path, firstPath, "first-hash", title: "First", artists: ["Track Artist"], albumTitle: "Loose Album", albumArtists: ["Album Artist"], trackNumber: 1),
            LooseAudioFileWithTags(root.Path, secondPath, "second-hash", title: "Second", artists: ["Track Artist"], albumTitle: "Loose Album", albumArtists: ["Album Artist"], trackNumber: 2));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid[] candidateIds = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray().Select(candidate => candidate.GetProperty("id").GetGuid())];

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        AssertLooseSessionCounts(document.RootElement, draftCount: 1, trackCount: 2, ignoredFileCount: 0, looseCount: 2);
        JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Equal("Loose Album", draft.GetProperty("title").GetString());
        Assert.Equal("Album Artist", draft.GetProperty("artistNames")[0].GetString());
        JsonElement[] tracks = [.. draft.GetProperty("tracks").EnumerateArray()];
        Assert.Equal(["First", "Second"], [.. tracks.Select(track => track.GetProperty("title").GetString() ?? string.Empty)]);
        Assert.Equal([1, 2], [.. tracks.Select(track => track.GetProperty("position").GetInt32())]);
        Assert.All(document.RootElement.GetProperty("looseFileCandidates").EnumerateArray(), candidate => Assert.Equal("convertedToDraft", candidate.GetProperty("decision").GetString()));
    }

    [Fact(DisplayName = "Loose draft creation reopens a completed session")]
    public async Task Loose_draft_creation_reopens_completed_session()
    {
        using var root = TempImportRoot.Create();
        string regularDirectory = Path.Combine(root.Path, "Regular Album");
        _ = Directory.CreateDirectory(regularDirectory);
        string regularPath = Path.Combine(regularDirectory, "01 Regular.flac");
        string loosePath = Path.Combine(root.Path, "Loose Later.flac");
        await File.WriteAllTextAsync(regularPath, "fake regular flac");
        await File.WriteAllTextAsync(loosePath, "fake loose flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFileWithTags(
                root.Path,
                regularPath,
                "regular-hash",
                title: "Regular",
                albumTitle: "Regular Album",
                albumArtists: ["Regular Artist"],
                trackNumber: 1),
            LooseAudioFile(root.Path, loosePath, "loose-later-hash", title: "Loose Later"));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid originalDraftId = Assert.Single(scanDocument.RootElement.GetProperty("drafts").EnumerateArray()).GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();
        using HttpResponseMessage skipResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{originalDraftId}/skip", null);
        using JsonDocument skippedDocument = await ReadJsonAsync(skipResponse);
        Assert.Equal(HttpStatusCode.OK, skipResponse.StatusCode);
        Assert.Equal("completed", skippedDocument.RootElement.GetProperty("status").GetString());

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds = new[] { candidateId } });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("readyForReview", document.RootElement.GetProperty("status").GetString());
        JsonElement[] drafts = [.. document.RootElement.GetProperty("drafts").EnumerateArray()];
        Assert.Contains(drafts, draft => draft.GetProperty("status").GetString() == "skipped");
        Assert.Contains(drafts, draft =>
            draft.GetProperty("title").GetString() == "Loose Later" &&
            draft.GetProperty("status").GetString() == "ready");
    }

    [Fact(DisplayName = "Loose draft creation warns when selected album tags conflict")]
    public async Task Loose_draft_creation_warns_when_selected_album_tags_conflict()
    {
        using var root = TempImportRoot.Create();
        string firstPath = Path.Combine(root.Path, "01 First.flac");
        string secondPath = Path.Combine(root.Path, "02 Second.flac");
        await File.WriteAllTextAsync(firstPath, "fake flac 1");
        await File.WriteAllTextAsync(secondPath, "fake flac 2");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFileWithTags(root.Path, firstPath, "first-hash", title: "First", albumTitle: "Album A", trackNumber: 1),
            LooseAudioFileWithTags(root.Path, secondPath, "second-hash", title: "Second", albumTitle: "Album B", trackNumber: 2));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid[] candidateIds = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray().Select(candidate => candidate.GetProperty("id").GetGuid())];

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
        JsonElement issue = Assert.Single(draft.GetProperty("issues").EnumerateArray());
        Assert.Equal("release_import.loose_file_album_tag_conflict", issue.GetProperty("code").GetString());
        Assert.Equal("warning", issue.GetProperty("severity").GetString());
    }

    [Fact(DisplayName = "Loose draft creation uses reviewed release metadata")]
    public async Task Loose_draft_creation_uses_reviewed_release_metadata()
    {
        using var root = TempImportRoot.Create();
        string firstPath = Path.Combine(root.Path, "01 First.flac");
        string secondPath = Path.Combine(root.Path, "02 Second.flac");
        await File.WriteAllTextAsync(firstPath, "fake flac 1");
        await File.WriteAllTextAsync(secondPath, "fake flac 2");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFileWithTags(root.Path, firstPath, "first-hash", title: "First", artists: ["Track Artist"], albumTitle: "Album A", albumArtists: ["Artist A"], trackNumber: 1),
            LooseAudioFileWithTags(root.Path, secondPath, "second-hash", title: "Second", artists: ["Track Artist"], albumTitle: "Album B", albumArtists: ["Artist B"], trackNumber: 2));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid[] candidateIds = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray().Select(candidate => candidate.GetProperty("id").GetGuid())];
        string[] reviewedArtistNames = ["Reviewed Artist"];

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds, reviewedTitle = "Reviewed Album", reviewedArtistNames });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Equal("Reviewed Album", draft.GetProperty("title").GetString());
        Assert.Equal("Reviewed Artist", draft.GetProperty("artistNames")[0].GetString());
        Assert.Contains(
            draft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.loose_file_album_tag_conflict");
    }

    [Fact(DisplayName = "Loose draft creation does not write import origin as user tags")]
    public async Task Loose_draft_creation_does_not_write_import_origin_as_user_tags()
    {
        using var root = TempImportRoot.Create();
        string firstPath = Path.Combine(root.Path, "01 First.flac");
        string secondPath = Path.Combine(root.Path, "02 Second.flac");
        await File.WriteAllTextAsync(firstPath, "fake flac 1");
        await File.WriteAllTextAsync(secondPath, "fake flac 2");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFileWithTags(root.Path, firstPath, "first-hash", title: "First", albumTitle: "Loose Album", trackNumber: 1),
            LooseAudioFileWithTags(root.Path, secondPath, "second-hash", title: "Second", albumTitle: "Loose Album", trackNumber: 2));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid[] candidateIds = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray().Select(candidate => candidate.GetProperty("id").GetGuid())];

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Empty(draft.GetProperty("tags").EnumerateArray());
    }

    [Fact(DisplayName = "Loose draft creation rejects already consumed candidates")]
    public async Task Loose_draft_creation_rejects_already_consumed_candidates()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "Root Single.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, audioPath, "single-hash", title: "Root Single"));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();
        using HttpResponseMessage firstResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds = new[] { candidateId } });
        _ = await ReadJsonAsync(firstResponse);

        using HttpResponseMessage secondResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds = new[] { candidateId } });
        using JsonDocument secondDocument = await ReadJsonAsync(secondResponse);

        Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);
        Assert.Equal("release_import_loose_file.already_consumed", secondDocument.RootElement.GetProperty("code").GetString());
    }

    private static object LooseAudioFileWithTags(
        string rootPath,
        string audioPath,
        string contentHash,
        string title,
        string[]? artists = null,
        string albumTitle = "",
        string[]? albumArtists = null,
        int? trackNumber = null)
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
                albumArtists = albumArtists ?? emptyNames,
                catalogNumber = (string?)null,
                releaseDate = (string?)null,
                year = (int?)null,
                durationSeconds = 123,
                trackNumber,
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
}
