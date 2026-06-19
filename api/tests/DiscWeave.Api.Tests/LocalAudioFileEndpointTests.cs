using DiscWeave.Domain.SharedKernel.Ids;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class LocalAudioFileEndpointTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public LocalAudioFileEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Local audio file patch updates file identity and inspection metadata")]
    public async Task Local_audio_file_patch_updates_file_identity_and_inspection_metadata()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        LocalAudioFileSeed seed = await host.SeedLocalAudioFileAsync("/music/old.flac", "flac", "oldhash");

        using JsonDocument document = await PatchJsonAsync(
            client,
            $"/api/local-audio-files/{seed.LocalAudioFileId}",
            new
            {
                path = "/music/new.m4a",
                format = "m4a",
                codec = "alac",
                quality = "lossless",
                sizeBytes = 98765,
                lastModifiedAt = "2026-06-19T10:30:00Z",
                contentHash = "ABCDEF",
                durationSeconds = 245,
                bitrateKbps = 900,
                sampleRateHz = 48000,
                channels = 2
            },
            HttpStatusCode.OK);

        JsonElement root = document.RootElement;
        Assert.Equal(seed.LocalAudioFileId, root.GetProperty("id").GetGuid());
        Assert.Equal("/music/new.m4a", root.GetProperty("path").GetString());
        Assert.Equal("m4a", root.GetProperty("format").GetString());
        Assert.Equal("alac", root.GetProperty("codec").GetString());
        Assert.Equal("lossless", root.GetProperty("quality").GetString());
        Assert.Equal(98765, root.GetProperty("sizeBytes").GetInt64());
        Assert.Equal(new DateTimeOffset(2026, 6, 19, 10, 30, 0, TimeSpan.Zero), root.GetProperty("modifiedAt").GetDateTimeOffset());
        Assert.Equal("abcdef", root.GetProperty("contentHash").GetString());
        Assert.Equal(245, root.GetProperty("durationSeconds").GetInt32());
        Assert.Equal(900, root.GetProperty("bitrateKbps").GetInt32());
        Assert.Equal(48000, root.GetProperty("sampleRateHz").GetInt32());
        Assert.Equal(2, root.GetProperty("channels").GetInt32());
    }

    [Fact(DisplayName = "Local audio file patch stays scoped to authenticated collection")]
    public async Task Local_audio_file_patch_stays_scoped_to_authenticated_collection()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (_, HttpClient userClient, Guid adminCollectionId) = await CreateAuthenticatedClientsAsync(host);
        LocalAudioFileSeed seed = await host.SeedLocalAudioFileAsync(
            new CollectionId(adminCollectionId),
            "/music/admin.flac",
            "flac",
            "adminhash");

        using JsonDocument document = await PatchJsonAsync(
            userClient,
            $"/api/local-audio-files/{seed.LocalAudioFileId}",
            new { path = "/music/user.flac" },
            HttpStatusCode.NotFound);

        Assert.Equal("local_audio_file.not_found", document.RootElement.GetProperty("code").GetString());
    }

    private static async Task<(HttpClient AdminClient, HttpClient UserClient, Guid AdminCollectionId)> CreateAuthenticatedClientsAsync(ApiTestHost host)
    {
        HttpClient adminClient = host.CreateClient();
        const string adminEmail = "owner@example.com";
        using HttpResponseMessage registerResponse = await adminClient.PostAsJsonAsync(
            "/api/auth/register",
            new { email = adminEmail, password = "Password1!" });
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        Guid adminCollectionId = (await host.FindDefaultCollectionIdForUserAsync(adminEmail))?.Value
            ?? throw new InvalidOperationException("Admin default collection was not created");

        using HttpResponseMessage createUserResponse = await adminClient.PostAsJsonAsync(
            "/api/admin/users",
            new { email = "collector@example.com", password = "Password1!", isAdmin = false });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);

        HttpClient userClient = host.CreateClient();
        using HttpResponseMessage loginResponse = await userClient.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "collector@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return (adminClient, userClient, adminCollectionId);
    }

    private static async Task<JsonDocument> PatchJsonAsync(
        HttpClient client,
        string path,
        object request,
        HttpStatusCode expectedStatus)
    {
        using var message = new HttpRequestMessage(HttpMethod.Patch, path)
        {
            Content = JsonContent.Create(request)
        };
        using HttpResponseMessage response = await client.SendAsync(message);
        string content = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expectedStatus, $"Expected {expectedStatus}, got {response.StatusCode}. Body: {content}");

        return JsonDocument.Parse(content);
    }
}
