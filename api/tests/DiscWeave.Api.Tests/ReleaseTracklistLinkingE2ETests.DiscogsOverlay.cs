using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReleaseTracklistLinkingE2ETests
{
    [Fact(DisplayName = "Release entry update overlays new tracklist metadata onto existing release positions")]
    public async Task Release_entry_update_overlays_new_tracklist_metadata_onto_existing_release_positions()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "The Orb");

        using JsonDocument importedDocument = await CreateReleaseAsync(
            client,
            "The Orb's Adventures Beyond The Ultraworld",
            artistId,
            [
                new
                {
                    title = "Back Side Of The Moon",
                    position = 1,
                    durationSeconds = 855,
                    artistCredits = Array.Empty<object>()
                },
                new
                {
                    title = "A Huge Ever Growing Pulsating Brain That Rules From The Centre Of The Ultraworld (Live Mix mk 10)",
                    position = 2,
                    durationSeconds = 1128,
                    artistCredits = Array.Empty<object>()
                }
            ],
            type: "album",
            year: 1991);
        Guid releaseId = importedDocument.RootElement.GetProperty("id").GetGuid();
        Guid backSideTrackId = importedDocument.RootElement.GetProperty("tracklist")[0].GetProperty("trackId").GetGuid();
        Guid brainTrackId = importedDocument.RootElement.GetProperty("tracklist")[1].GetProperty("trackId").GetGuid();
        Guid ownedItemId = await host.SeedDigitalOwnedItemWithoutFormatAsync(releaseId);
        DigitalFileSeed linkedFile = await host.SeedDigitalTrackFileLinkAsync(
            releaseId,
            ownedItemId,
            releaseTrackPosition: 2,
            "/music/orb/02-brain.flac",
            "flac",
            "ABCDEF0123");

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/releases/{releaseId}",
            ReleasePayload(
                "The Orb's Adventures Beyond The Ultraworld",
                artistId,
                [
                    new
                    {
                        title = "Back Side Of The Moon",
                        position = 1,
                        durationSeconds = 855,
                        artistCredits = Array.Empty<object>()
                    },
                    new
                    {
                        title = "A Huge Ever Growing Pulsating Brain That Rules From The Centre Of The Ultraworld: Live Mix MK 10",
                        position = 2,
                        durationSeconds = 1123,
                        artistCredits = Array.Empty<object>()
                    }
                ],
                type: "album",
                year: 1991));
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);
        using HttpResponseMessage tracksResponse = await client.GetAsync("/api/tracks?search=Ultraworld&limit=20&offset=0");
        using JsonDocument tracksDocument = await ReadJsonAsync(tracksResponse);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        JsonElement updatedTracklist = updateDocument.RootElement.GetProperty("tracklist");
        Assert.Equal(2, updatedTracklist.GetArrayLength());
        Assert.Equal(backSideTrackId, updatedTracklist[0].GetProperty("trackId").GetGuid());
        Assert.Equal(brainTrackId, updatedTracklist[1].GetProperty("trackId").GetGuid());
        Guid updatedBrainReleaseTrackId = updatedTracklist[1].GetProperty("releaseTrackId").GetGuid();
        Assert.Equal("A Huge Ever Growing Pulsating Brain That Rules From The Centre Of The Ultraworld: Live Mix MK 10", updatedTracklist[1].GetProperty("title").GetString());
        Assert.Equal(1123, updatedTracklist[1].GetProperty("durationSeconds").GetInt32());
        Assert.Equal(HttpStatusCode.OK, tracksResponse.StatusCode);
        Assert.Equal(1, tracksDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(brainTrackId, tracksDocument.RootElement.GetProperty("items")[0].GetProperty("id").GetGuid());
        Assert.Equal(
            releaseId,
            tracksDocument.RootElement.GetProperty("items")[0].GetProperty("releaseAppearances")[0].GetProperty("releaseId").GetGuid());
        DigitalTrackFileLinkSnapshot preservedLink = Assert.Single(await host.DigitalTrackFileLinksAsync());
        Assert.Equal(ownedItemId, preservedLink.DigitalOwnedItemId);
        Assert.Equal(linkedFile.LocalAudioFileId, preservedLink.LocalAudioFileId);
        Assert.Equal(updatedBrainReleaseTrackId, preservedLink.ReleaseTrackId);
    }
}
