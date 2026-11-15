using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReleaseExternalCoverArtworkEndpointTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Deletion_waits_for_external_apply_and_removes_the_newly_committed_cover(bool wholeRelease)
    {
        using var root = new CoverTestDirectory();
        var resumeDownload = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var provider = new FakeProvider { Pause = resumeDownload };
        var storage = new FaultStorage(root.Storage);
        await using ApiTestHost host = await CreateReleaseHostAsync(root, provider, storage);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client);
        _ = await UploadOriginalAsync(client, releaseId);
        Task<HttpResponseMessage> external = client.PostAsJsonAsync(Route(releaseId) + "/external-selection", Selection());
        await provider.DownloadEntered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", CoverBytes());
        string target = wholeRelease ? $"/api/releases/{releaseId}" : $"/api/releases/{releaseId}/cover-image";
        string confirmation = wholeRelease ? $"release:{releaseId}" : $"release-cover:{releaseId}";
        using var request = new HttpRequestMessage(HttpMethod.Delete, target);
        request.Headers.Add("X-DiscWeave-Confirm-Delete", confirmation);
        Task<HttpResponseMessage> deletion = client.SendAsync(request);
        try
        {
            await Task.Delay(150);
            Assert.False(deletion.IsCompleted);
            Assert.Empty(storage.DeleteAttempts);
        }
        finally
        {
            resumeDownload.SetResult();
        }

        using HttpResponseMessage applied = await external.WaitAsync(TimeSpan.FromSeconds(10));
        using HttpResponseMessage deleted = await deletion.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(HttpStatusCode.OK, applied.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(2, storage.SavedKeys.Count);
        Assert.All(storage.SavedKeys, key =>
        {
            Assert.Contains(key, storage.DeleteAttempts);
            Assert.False(File.Exists(Path.Combine(root.Storage, key)));
            Assert.False(File.Exists(Path.Combine(root.Storage, key + ".provenance.json")));
        });
        using HttpResponseMessage image = await client.GetAsync($"/api/releases/{releaseId}/cover-image");
        Assert.Equal(HttpStatusCode.NotFound, image.StatusCode);
        using HttpResponseMessage release = await client.GetAsync($"/api/releases/{releaseId}");
        Assert.Equal(wholeRelease ? HttpStatusCode.NotFound : HttpStatusCode.OK, release.StatusCode);
    }

    [Fact]
    public async Task Metadata_saved_during_an_external_download_survives_with_the_new_cover()
    {
        using var root = new CoverTestDirectory();
        var resumeDownload = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var provider = new FakeProvider { Pause = resumeDownload };
        var storage = new FaultStorage(root.Storage);
        await using ApiTestHost host = await CreateReleaseHostAsync(root, provider, storage);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client);
        _ = await UploadOriginalAsync(client, releaseId);
        Task<HttpResponseMessage> external = client.PostAsJsonAsync(Route(releaseId) + "/external-selection", Selection());
        await provider.DownloadEntered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", CoverBytes());
        try
        {
            using HttpResponseMessage updated = await client.PutAsJsonAsync($"/api/releases/{releaseId}", new
            {
                title = "Updated during download",
                type = "album",
                isVariousArtists = true,
                notOnLabel = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>()
            }).WaitAsync(TimeSpan.FromSeconds(10));
            Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        }
        finally
        {
            resumeDownload.SetResult();
        }

        using HttpResponseMessage selected = await external.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(HttpStatusCode.OK, selected.StatusCode);
        JsonElement detail = await ReleaseDetailAsync(client, releaseId);
        Assert.Equal("Updated during download", detail.GetProperty("title").GetString());
        Assert.Equal("coverArtArchive", detail.GetProperty("coverImage").GetProperty("sourceType").GetString());
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", FrontBytes());
    }

    [Theory]
    [InlineData("provider")]
    [InlineData("storage")]
    [InlineData("provenance")]
    [InlineData("database")]
    [InlineData("cancellation")]
    public async Task A_failed_external_replacement_retains_the_existing_release_cover(string failure)
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeProvider();
        var storage = new FaultStorage(root.Storage);
        var interceptor = new CancelSaveInterceptor();
        await using ApiTestHost host = await CreateReleaseHostAsync(root, provider, storage, interceptor);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client);
        JsonElement original = await UploadOriginalAsync(client, releaseId);
        string originalKey = Assert.Single(storage.SavedKeys);
        provider.Fail = failure == "provider";
        storage.FailSave = failure == "storage";
        storage.FailProvenance = failure == "provenance";
        interceptor.Enabled = failure == "cancellation";
        if (failure == "database")
        {
            await host.ExecuteSqlAsync("CREATE TRIGGER reject_release_cover BEFORE UPDATE ON releases BEGIN SELECT RAISE(ABORT, 'simulated cover failure'); END;");
        }

        using HttpResponseMessage failed = await client.PostAsJsonAsync(Route(releaseId) + "/external-selection", Selection());
        Assert.False(failed.IsSuccessStatusCode);
        if (failure == "cancellation")
        {
            Assert.True(interceptor.Cancelled);
        }
        JsonElement detail = await ReleaseDetailAsync(client, releaseId);
        Assert.Equal(original.GetProperty("url").GetString(), detail.GetProperty("coverImage").GetProperty("url").GetString());
        Assert.Equal("localUpload", detail.GetProperty("coverImage").GetProperty("sourceType").GetString());
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", CoverBytes());
        Assert.DoesNotContain(originalKey, storage.DeleteAttempts);
        Assert.True(File.Exists(Path.Combine(root.Storage, originalKey)));
        foreach (string newKey in storage.SavedKeys.Where(key => key != originalKey))
        {
            Assert.False(File.Exists(Path.Combine(root.Storage, newKey)));
            Assert.False(File.Exists(Path.Combine(root.Storage, newKey + ".provenance.json")));
        }
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Cleanup_failure_after_a_committed_cover_change_never_deletes_the_new_cover(bool manual)
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeProvider();
        var storage = new FaultStorage(root.Storage);
        await using ApiTestHost host = await CreateReleaseHostAsync(root, provider, storage);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client);
        _ = await UploadOriginalAsync(client, releaseId);
        string originalKey = Assert.Single(storage.SavedKeys);
        storage.FailDeleteKey = originalKey;
        using MultipartFormDataContent upload = Upload(FrontBytes());
        using HttpResponseMessage changed = manual
            ? await client.PutAsync($"/api/releases/{releaseId}/cover-image", upload)
            : await client.PostAsJsonAsync(Route(releaseId) + "/external-selection", Selection());
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        Assert.Equal(2, storage.SavedKeys.Count);
        string newKey = storage.SavedKeys[1];
        Assert.Contains(originalKey, storage.DeleteAttempts);
        Assert.DoesNotContain(newKey, storage.DeleteAttempts);
        Assert.True(File.Exists(Path.Combine(root.Storage, newKey)));
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", FrontBytes());
    }

    [Fact]
    public async Task A_manual_cover_upload_waits_for_an_in_flight_external_selection()
    {
        using var root = new CoverTestDirectory();
        var resumeDownload = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var provider = new FakeProvider { Pause = resumeDownload };
        var storage = new FaultStorage(root.Storage);
        await using ApiTestHost host = await CreateReleaseHostAsync(root, provider, storage);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client);
        _ = await UploadOriginalAsync(client, releaseId);
        Task<HttpResponseMessage> external = client.PostAsJsonAsync(Route(releaseId) + "/external-selection", Selection());
        await provider.DownloadEntered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", CoverBytes());
        using MultipartFormDataContent upload = Upload(CoverBytes(), "manual-after-external.png");
        Task<HttpResponseMessage> manual = client.PutAsync($"/api/releases/{releaseId}/cover-image", upload);
        try
        {
            await Task.Delay(150);
            Assert.False(manual.IsCompleted);
            _ = Assert.Single(storage.SavedKeys);
        }
        finally
        {
            resumeDownload.SetResult();
        }

        using HttpResponseMessage externalResponse = await external.WaitAsync(TimeSpan.FromSeconds(10));
        using HttpResponseMessage manualResponse = await manual.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(HttpStatusCode.OK, externalResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, manualResponse.StatusCode);
        JsonElement detail = await ReleaseDetailAsync(client, releaseId);
        Assert.Equal("localUpload", detail.GetProperty("coverImage").GetProperty("sourceType").GetString());
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", CoverBytes());
        Assert.Equal(3, storage.SavedKeys.Count);
        Assert.Contains(storage.SavedKeys[0], storage.DeleteAttempts);
        Assert.Contains(storage.SavedKeys[1], storage.DeleteAttempts);
        Assert.DoesNotContain(storage.SavedKeys[2], storage.DeleteAttempts);
    }
}
