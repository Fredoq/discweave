using System.Net;
using System.Reflection;
using System.Text.Json;
using DiscWeave.Api.Features.Imports;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Concurrent desktop import confirmations create one release")]
    public async Task Concurrent_desktop_import_confirmations_create_one_release()
    {
        ClearImportConfirmationLocks();
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[AA 01, 2016-07-15] Steven Julien - Fallen");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Begins.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scanDocument = await PostScanAsync(client, root.Path, audioPath);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scanDocument.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();

        HttpResponseMessage[] confirmResponses = await Task.WhenAll(
            Enumerable.Range(0, 4).Select(_ => client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null)));
        foreach (HttpResponseMessage response in confirmResponses)
        {
            using (response)
            {
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            }
        }

        using HttpResponseMessage releaseResponse = await client.GetAsync("/api/releases?search=Fallen&limit=10&offset=0");
        using JsonDocument releaseDocument = await ReadJsonAsync(releaseResponse);
        using HttpResponseMessage itemResponse = await client.GetAsync("/api/owned-items?limit=10&offset=0");
        using JsonDocument itemDocument = await ReadJsonAsync(itemResponse);

        Assert.Equal(HttpStatusCode.OK, releaseResponse.StatusCode);
        Assert.Equal(1, releaseDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.OK, itemResponse.StatusCode);
        Assert.Equal(2, itemDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(0, ImportConfirmationLockCount());
    }

    private static void ClearImportConfirmationLocks()
    {
        object locks = ImportConfirmationLocks();
        _ = locks.GetType().GetMethod("Clear")!.Invoke(locks, []);
    }

    private static int ImportConfirmationLockCount()
    {
        object locks = ImportConfirmationLocks();
        return (int)locks.GetType().GetProperty("Count")!.GetValue(locks)!;
    }

    private static object ImportConfirmationLocks()
    {
        FieldInfo? field = typeof(ReleaseImportConfirmationService).GetField(
            "ConfirmationLocks",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(field);
        return field.GetValue(null)!;
    }
}
