using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class CatalogQualityEndpointTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public CatalogQualityEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Catalog quality report returns duplicate missing metadata and format gap sections")]
    public async Task Catalog_quality_report_returns_duplicate_missing_metadata_and_format_gap_sections()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid duplicateReleaseA = await CreateReleaseAsync(client, "Duplicate Candidate", year: 1991);
        Guid duplicateReleaseB = await CreateReleaseAsync(client, "Duplicate Candidate", year: 1992);
        Guid duplicateTrackA = await CreateTrackAsync(client, "Duplicate Track", durationSeconds: 180);
        Guid duplicateTrackB = await CreateTrackAsync(client, "Duplicate Track", durationSeconds: 181);
        Guid missingReleaseId = await CreateReleaseAsync(client, "Metadata Missing Release");
        Guid missingTrackId = await CreateTrackAsync(client, "Metadata Missing Track");
        Guid missingOwnedReleaseId = await CreateReleaseAsync(client, "Owned Metadata Missing", year: 1993);
        Guid missingOwnedItemId = await CreateOwnedItemAsync(client, "release", missingOwnedReleaseId, "owned", new { type = "vinyl", description = "12-inch" });
        Guid physicalOnlyReleaseId = await CreateReleaseAsync(client, "Physical Only Report", year: 1996);
        _ = await CreateOwnedItemAsync(client, "release", physicalOnlyReleaseId, "owned", new { type = "vinyl", description = "LP" });
        Guid lossyOnlyReleaseId = await CreateReleaseAsync(client, "Lossy Only Report", year: 1997);
        _ = await CreateOwnedItemAsync(client, "release", lossyOnlyReleaseId, "owned", new { type = "digital", path = "/music/lossy-only.mp3", format = "mp3" });
        Guid wantedOnlyReleaseId = await CreateReleaseAsync(client, "Wanted Only Report", year: 1998);
        _ = await CreateOwnedItemAsync(client, "release", wantedOnlyReleaseId, "wanted", new { type = "vinyl", description = "LP" });
        Guid needsDigitizationReleaseId = await CreateReleaseAsync(client, "Digitization Report", year: 1999);
        _ = await CreateOwnedItemAsync(client, "release", needsDigitizationReleaseId, "needsDigitization", new { type = "cassette", description = "Tape" });
        Guid missingDigitalFormatReleaseId = await CreateReleaseAsync(client, "Missing Digital Format Report", year: 2000);
        Guid missingDigitalFormatOwnedItemId = await host.SeedDigitalOwnedItemWithoutFormatAsync(missingDigitalFormatReleaseId);

        using JsonDocument report = await GetJsonAsync(client, "/api/catalog-quality?limit=10", HttpStatusCode.OK);
        string reportJson = report.RootElement.GetRawText();

        Assert.Equal(10, report.RootElement.GetProperty("limit").GetInt32());
        Assert.DoesNotContain("collectionId", reportJson, StringComparison.Ordinal);
        AssertGroup(report, "duplicateCandidates", "releases", "Duplicate Candidate", 2, duplicateReleaseA, duplicateReleaseB);
        AssertGroup(report, "duplicateCandidates", "tracks", "Duplicate Track", 2, duplicateTrackA, duplicateTrackB);
        Assert.Empty(SectionItems(report, "duplicateCandidates", "digitalFileIdentities"));
        AssertSample(report, "missingMetadata", "releasesMissingYearOrDate", missingReleaseId);
        AssertSample(report, "missingMetadata", "releasesMissingLabel", missingReleaseId);
        AssertSample(report, "missingMetadata", "tracksMissingDuration", missingTrackId);
        AssertSample(report, "missingMetadata", "ownedItemsMissingCondition", missingOwnedItemId);
        AssertSample(report, "missingMetadata", "ownedItemsMissingStorageLocation", missingOwnedItemId);
        AssertNoSample(report, "missingMetadata", "ownedItemsMissingDigitalFormat", missingDigitalFormatOwnedItemId);
        AssertSample(report, "formatGaps", "physicalWithoutDigital", physicalOnlyReleaseId);
        AssertNoSample(report, "formatGaps", "physicalWithoutDigital", missingDigitalFormatReleaseId);
        AssertNoSample(report, "formatGaps", "lossyWithoutLossless", lossyOnlyReleaseId);
        AssertSample(report, "formatGaps", "wantedNotOwned", wantedOnlyReleaseId);
        AssertSample(report, "formatGaps", "needsDigitization", needsDigitizationReleaseId);
    }

    [Theory(DisplayName = "Catalog quality report rejects invalid limits")]
    [InlineData(0)]
    [InlineData(101)]
    public async Task Catalog_quality_report_rejects_invalid_limits(int limit)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument document = await GetJsonAsync(client, $"/api/catalog-quality?limit={limit}", HttpStatusCode.BadRequest);

        Assert.Equal("catalog_quality.limit_invalid", document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Catalog quality report stays scoped to the authenticated collection")]
    public async Task Catalog_quality_report_stays_scoped_to_the_authenticated_collection()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient adminClient, HttpClient userClient) = await CreateAuthenticatedClientsAsync(host);
        _ = await CreateReleaseAsync(adminClient, "Shared Duplicate", year: 1991);
        _ = await CreateReleaseAsync(adminClient, "Shared Duplicate", year: 1992);
        _ = await CreateReleaseAsync(userClient, "Shared Duplicate", year: 1993);

        using JsonDocument report = await GetJsonAsync(userClient, "/api/catalog-quality", HttpStatusCode.OK);

        Assert.DoesNotContain(
            SectionItems(report, "duplicateCandidates", "releases"),
            item => item.GetProperty("key").GetString() == "Shared Duplicate");
    }

    [Fact(DisplayName = "Catalog quality report requires condition only for physical owned items")]
    public async Task Catalog_quality_report_requires_condition_only_for_physical_owned_items()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid digitalReleaseId = await CreateReleaseAsync(client, "Digital Condition Not Required", year: 2001);
        Guid physicalReleaseId = await CreateReleaseAsync(client, "Physical Condition Required", year: 2002);
        Guid digitalOwnedItemId = await CreateOwnedItemAsync(
            client,
            "release",
            digitalReleaseId,
            "owned",
            new { type = "digital", path = "/music/digital-condition-not-required.flac", format = "flac" });
        Guid physicalOwnedItemId = await CreateOwnedItemAsync(
            client,
            "release",
            physicalReleaseId,
            "owned",
            new { type = "vinyl", description = "LP" });

        using JsonDocument report = await GetJsonAsync(client, "/api/catalog-quality?limit=20", HttpStatusCode.OK);

        AssertNoSample(report, "missingMetadata", "ownedItemsMissingCondition", digitalOwnedItemId);
        AssertSample(report, "missingMetadata", "ownedItemsMissingCondition", physicalOwnedItemId);
    }

    private static async Task<(HttpClient AdminClient, HttpClient UserClient)> CreateAuthenticatedClientsAsync(ApiTestHost host)
    {
        HttpClient adminClient = host.CreateClient();
        using HttpResponseMessage registerResponse = await adminClient.PostAsJsonAsync(
            "/api/auth/register",
            new { email = "owner@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);
        using HttpResponseMessage createUserResponse = await adminClient.PostAsJsonAsync(
            "/api/admin/users",
            new { email = "collector@example.com", password = "Password1!", isAdmin = false });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);
        HttpClient userClient = host.CreateClient();
        using HttpResponseMessage loginResponse = await userClient.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "collector@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return (adminClient, userClient);
    }

    private static async Task<Guid> CreateReleaseAsync(HttpClient client, string title, int? year = null)
    {
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/releases",
                new
                {
                    title,
                    type = "standalone",
                    year,
                    isVariousArtists = true,
                    genres = Array.Empty<string>(),
                    tags = Array.Empty<string>()
                }),
            HttpStatusCode.Created);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateTrackAsync(HttpClient client, string title, int? durationSeconds = null)
    {
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/tracks",
                new
                {
                    title,
                    durationSeconds,
                    genres = Array.Empty<string>(),
                    tags = Array.Empty<string>()
                }),
            HttpStatusCode.Created);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateOwnedItemAsync(HttpClient client, string targetType, Guid targetId, string status, object medium)
    {
        _ = targetType;
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/owned-items",
                new
                {
                    releaseId = targetId,
                    status,
                    medium
                }),
            HttpStatusCode.Created);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static void AssertGroup(JsonDocument document, string area, string section, string key, int count, params Guid[] ids)
    {
        JsonElement item = SectionItems(document, area, section).Single(candidate => candidate.GetProperty("key").GetString() == key);
        Assert.Equal(count, item.GetProperty("count").GetInt32());
        Guid[] actualIds = [.. item.GetProperty("ids").EnumerateArray().Select(value => value.GetGuid())];
        foreach (Guid id in ids)
        {
            Assert.Contains(id, actualIds);
        }
    }

    private static void AssertSample(JsonDocument document, string area, string section, Guid id)
    {
        Assert.Contains(
            SectionItems(document, area, section),
            item => item.GetProperty("id").GetGuid() == id);
    }

    private static void AssertNoSample(JsonDocument document, string area, string section, Guid id)
    {
        Assert.DoesNotContain(
            SectionItems(document, area, section),
            item => item.GetProperty("id").GetGuid() == id);
    }

    private static JsonElement.ArrayEnumerator SectionItems(JsonDocument document, string area, string section)
    {
        return document.RootElement.GetProperty(area).GetProperty(section).GetProperty("items").EnumerateArray();
    }

    private static async Task<JsonDocument> GetJsonAsync(HttpClient client, string path, HttpStatusCode expectedStatus)
    {
        using HttpResponseMessage response = await client.GetAsync(path);
        return await ReadExpectedJsonAsync(response, expectedStatus);
    }

    private static async Task<JsonDocument> SendJsonAsync(Task<HttpResponseMessage> request, HttpStatusCode expectedStatus)
    {
        using HttpResponseMessage response = await request;
        return await ReadExpectedJsonAsync(response, expectedStatus);
    }

    private static async Task<JsonDocument> ReadExpectedJsonAsync(HttpResponseMessage response, HttpStatusCode expectedStatus)
    {
        string content = await response.Content.ReadAsStringAsync();
        Assert.Equal(expectedStatus, response.StatusCode);
        return JsonDocument.Parse(content);
    }
}
