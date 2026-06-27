using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportConfirmationDetailsTests
{
    [Fact(DisplayName = "Desktop import confirmation keeps one label record for multiple catalog numbers")]
    public async Task Desktop_import_confirmation_keeps_one_label_record_for_multiple_catalog_numbers()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[AA 01, 2016-07-15] Steven Julien - Fallen");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Begins.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid existingArtistId = await CreateArtistAsync(client, "Existing Import Artist");

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid trackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        object[] labels =
        [
            new { labelId = (Guid?)null, name = "Big Life", catalogNumber = "BLRDCD 5", hasNoCatalogNumber = false },
            new { labelId = (Guid?)null, name = "Big Life", catalogNumber = "847963. 2", hasNoCatalogNumber = false }
        ];
        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayload(existingArtistId, Guid.Empty, trackId, labels: labels));
        using JsonDocument update = await ReadJsonAsync(updateResponse);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(2, update.RootElement.GetProperty("drafts")[0].GetProperty("labels").GetArrayLength());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirm = await ReadJsonAsync(confirmResponse);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirm.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());

        using HttpResponseMessage labelsResponse = await client.GetAsync("/api/labels?search=Big%20Life&limit=10&offset=0");
        using JsonDocument labelsDocument = await ReadJsonAsync(labelsResponse);
        using HttpResponseMessage releaseResponse = await client.GetAsync("/api/releases?search=Edited%20Fallen&limit=10&offset=0");
        using JsonDocument releasesDocument = await ReadJsonAsync(releaseResponse);
        JsonElement[] releaseLabels = [.. releasesDocument.RootElement.GetProperty("items")[0].GetProperty("labels").EnumerateArray()];
        Guid[] labelIds = [.. releaseLabels.Select(label => label.GetProperty("labelId").GetGuid()).Distinct()];

        Assert.Equal(HttpStatusCode.OK, labelsResponse.StatusCode);
        Assert.Equal(1, labelsDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.OK, releaseResponse.StatusCode);
        Assert.Equal(2, releaseLabels.Length);
        _ = Assert.Single(labelIds);
        Assert.Contains(releaseLabels, label => label.GetProperty("catalogNumber").GetString() == "BLRDCD 5");
        Assert.Contains(releaseLabels, label => label.GetProperty("catalogNumber").GetString() == "847963. 2");
    }
}
