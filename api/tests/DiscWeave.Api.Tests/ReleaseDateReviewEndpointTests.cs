using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Api.Features.Releases;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Tests;

public sealed class ReleaseDateReviewEndpointTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact]
    public async Task Preview_does_not_write_and_confirmation_changes_only_the_release_date_and_year()
    {
        FakeExternalMetadataProvider provider = Provider();
        await using ApiTestHost host = await HostAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid id = await CreateReleaseAsync(client);
        JsonElement before = await ReadReleaseAsync(client, id);

        JsonElement preview = await PreviewAsync(client, id);

        Assert.Equal(before.GetRawText(), (await ReadReleaseAsync(client, id)).GetRawText());
        Assert.Equal(1982, preview.GetProperty("currentYear").GetInt32());
        Assert.Equal(JsonValueKind.Null, preview.GetProperty("currentDate").ValueKind);
        Assert.Equal("fullDate", preview.GetProperty("date").GetProperty("kind").GetString());
        Assert.Equal("249504", preview.GetProperty("source").GetProperty("externalId").GetString());
        Assert.Equal("https://www.discogs.com/release/249504", preview.GetProperty("source").GetProperty("sourceUrl").GetString());
        Assert.Equal("249504", provider.LastReleaseLookupQuery?.ExternalId);

        using HttpResponseMessage applied = await ApplyAsync(client, id, Token(preview));
        Assert.Equal(HttpStatusCode.OK, applied.StatusCode);
        JsonElement after = await ReadReleaseAsync(client, id);
        Assert.Equal("1983-03-07", after.GetProperty("releaseDate").GetString());
        Assert.Equal(1983, after.GetProperty("year").GetInt32());
        foreach (JsonProperty property in before.EnumerateObject().Where(property => property.Name is not "year" and not "releaseDate"))
        {
            Assert.Equal(property.Value.GetRawText(), after.GetProperty(property.Name).GetRawText());
        }

        using HttpResponseMessage replay = await ApplyAsync(client, id, Token(preview));
        Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);
        Assert.Equal(after.GetRawText(), (await ReadReleaseAsync(client, id)).GetRawText());
    }

    [Theory]
    [InlineData("year", 1983, null)]
    [InlineData("yearMonth", 1983, 3)]
    [InlineData(null, null, null)]
    public async Task Incomplete_provider_dates_keep_their_precision_without_an_apply_token(string? kind, int? year, int? month)
    {
        IOptionalValue<ExternalMetadataPartialDate> evidence = kind switch
        {
            "year" => Optional.From<ExternalMetadataPartialDate>(ExternalMetadataPartialDate.ForYear(1983)),
            "yearMonth" => Optional.From<ExternalMetadataPartialDate>(ExternalMetadataPartialDate.ForYearMonth(1983, 3)),
            _ => Optional.Missing<ExternalMetadataPartialDate>()
        };
        await using ApiTestHost host = await HostAsync(Provider(evidence));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid id = await CreateReleaseAsync(client);
        JsonElement before = await ReadReleaseAsync(client, id);
        JsonElement preview = await PreviewAsync(client, id);

        Assert.Equal(JsonValueKind.Null, preview.GetProperty("token").ValueKind);
        JsonElement date = preview.GetProperty("date");
        if (kind is null)
        {
            Assert.Equal(JsonValueKind.Null, date.ValueKind);
        }
        else
        {
            Assert.Equal(kind, date.GetProperty("kind").GetString());
            Assert.Equal(year, date.GetProperty("year").GetInt32());
            Assert.Equal(month, date.TryGetProperty("month", out JsonElement value) ? value.GetInt32() : null);
            Assert.False(date.TryGetProperty("day", out _));
        }

        Assert.Equal(before.GetRawText(), (await ReadReleaseAsync(client, id)).GetRawText());
    }

    [Theory]
    [InlineData("title")]
    [InlineData("year")]
    public async Task A_changed_release_requires_a_new_preview(string changedField)
    {
        await using ApiTestHost host = await HostAsync(Provider());
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid id = await CreateReleaseAsync(client);
        JsonElement preview = await PreviewAsync(client, id);
        ReleaseRequest changed = Request() with
        {
            Title = changedField == "title" ? "Changed title" : "Local edition",
            Year = changedField == "year" ? 1981 : 1982
        };
        using HttpResponseMessage update = await client.PutAsJsonAsync($"/api/releases/{id}", changed);
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        JsonElement before = await ReadReleaseAsync(client, id);

        using HttpResponseMessage response = await ApplyAsync(client, id, Token(preview));

        await AssertErrorAsync(response, HttpStatusCode.Conflict, "release_date.preview_stale");
        Assert.Equal(before.GetRawText(), (await ReadReleaseAsync(client, id)).GetRawText());
    }

    [Fact]
    public async Task Confirmation_is_required_and_tampered_or_wrong_target_tokens_cannot_write()
    {
        await using ApiTestHost host = await HostAsync(Provider());
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid id = await CreateReleaseAsync(client);
        Guid otherId = await CreateReleaseAsync(client);
        JsonElement preview = await PreviewAsync(client, id);
        using HttpResponseMessage unconfirmed = await client.PostAsJsonAsync($"/api/releases/{id}/date-apply", new { token = Token(preview), confirmed = false });
        await AssertErrorAsync(unconfirmed, HttpStatusCode.BadRequest, "release_date.confirmation_required");
        using HttpResponseMessage tampered = await ApplyAsync(client, id, Token(preview) + "tampered");
        await AssertErrorAsync(tampered, HttpStatusCode.Conflict, "release_date.preview_stale");
        using HttpResponseMessage wrongTarget = await ApplyAsync(client, otherId, Token(preview));
        await AssertErrorAsync(wrongTarget, HttpStatusCode.Conflict, "release_date.preview_stale");
        Assert.Equal(JsonValueKind.Null, (await ReadReleaseAsync(client, id)).GetProperty("releaseDate").ValueKind);
        Assert.Equal(JsonValueKind.Null, (await ReadReleaseAsync(client, otherId)).GetProperty("releaseDate").ValueKind);
    }

    [Theory]
    [InlineData("master", "249504", "discogs")]
    [InlineData("release", "999", "discogs")]
    [InlineData("release", "249504", "musicbrainz")]
    public async Task Only_the_requested_Discogs_release_edition_can_supply_a_date(string resourceType, string externalId, string providerName)
    {
        await using ApiTestHost host = await HostAsync(Provider(source: new ExternalMetadataSource(providerName, resourceType, externalId, "https://www.discogs.com/release/249504", "Data provided by Discogs.")));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid id = await CreateReleaseAsync(client);

        using HttpResponseMessage response = await client.PostAsJsonAsync($"/api/releases/{id}/date-preview", new { discogsReleaseId = "249504" });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await ReadReleaseAsync(client, id)).GetProperty("releaseDate").ValueKind);
    }

    [Fact]
    public async Task Preview_and_apply_do_not_expose_or_change_another_collections_release()
    {
        FakeExternalMetadataProvider provider = Provider();
        await using ApiTestHost host = await HostAsync(provider);
        HttpClient owner = await host.CreateAuthenticatedClientAsync();
        Guid id = await CreateReleaseAsync(owner);
        JsonElement preview = await PreviewAsync(owner, id);
        using HttpResponseMessage createUser = await owner.PostAsJsonAsync("/api/admin/users", new { email = "other@example.com", password = "Password1!", isAdmin = false });
        Assert.Equal(HttpStatusCode.Created, createUser.StatusCode);
        HttpClient other = host.CreateClient();
        using HttpResponseMessage login = await other.PostAsJsonAsync("/api/auth/login", new { email = "other@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        int lookupCalls = provider.ReleaseLookupCallCount;
        using HttpResponseMessage foreignPreview = await other.PostAsJsonAsync($"/api/releases/{id}/date-preview", new { discogsReleaseId = "249504" });
        using HttpResponseMessage foreignApply = await ApplyAsync(other, id, Token(preview));

        Assert.Equal(HttpStatusCode.NotFound, foreignPreview.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, foreignApply.StatusCode);
        Assert.Equal(lookupCalls, provider.ReleaseLookupCallCount);
        Assert.Equal(JsonValueKind.Null, (await ReadReleaseAsync(owner, id)).GetProperty("releaseDate").ValueKind);
    }

    [Theory]
    [InlineData("")]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("master/249504")]
    [InlineData("https://www.discogs.com/release/249504")]
    public async Task Invalid_edition_identifiers_are_rejected_before_provider_access(string externalId)
    {
        FakeExternalMetadataProvider provider = Provider();
        await using ApiTestHost host = await HostAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid id = await CreateReleaseAsync(client);

        using HttpResponseMessage response = await client.PostAsJsonAsync($"/api/releases/{id}/date-preview", new { discogsReleaseId = externalId });

        await AssertErrorAsync(response, HttpStatusCode.BadRequest, "release_date.source_invalid");
        Assert.Equal(0, provider.ReleaseLookupCallCount);
    }

    [Fact]
    public async Task Provider_failure_does_not_change_the_collection()
    {
        var provider = new FakeExternalMetadataProvider();
        await using ApiTestHost host = await HostAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid id = await CreateReleaseAsync(client);
        JsonElement before = await ReadReleaseAsync(client, id);

        using HttpResponseMessage response = await client.PostAsJsonAsync($"/api/releases/{id}/date-preview", new { discogsReleaseId = "249504" });

        Assert.False(response.IsSuccessStatusCode);
        Assert.Equal(before.GetRawText(), (await ReadReleaseAsync(client, id)).GetRawText());
    }

    private Task<ApiTestHost> HostAsync(FakeExternalMetadataProvider provider)
    {
        return ApiTestHost.CreateAsync(sqlite, services => FakeExternalMetadataProvider.Register(services, provider));
    }

    private static FakeExternalMetadataProvider Provider(IOptionalValue<ExternalMetadataPartialDate>? evidence = null, ExternalMetadataSource? source = null)
    {
        return new FakeExternalMetadataProvider
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(new ExternalMetadataReleaseDetail(
                source ?? new ExternalMetadataSource("discogs", "release", "249504", "https://www.discogs.com/release/249504", "Data provided by Discogs."),
                "Provider edition", ["Provider Artist"], null, null, ["Factory"], ["Vinyl"], "single", [], [], [], "FAC 73", [], [],
                releaseDateEvidence: evidence ?? Optional.From<ExternalMetadataPartialDate>(ExternalMetadataPartialDate.ForDate(new DateOnly(1983, 3, 7)))))
        };
    }

    private static ReleaseRequest Request()
    {
        return new ReleaseRequest
        {
            Title = "Local edition",
            Type = "album",
            Year = 1982,
            ArtistCredits = [new ReleaseArtistCreditRequest { Name = "Local Artist", Roles = ["mainArtist"] }],
            Labels = [new ReleaseLabelRequest { Name = "Local Label", CatalogNumber = "LOCAL 01" }],
            Genres = [],
            Tags = []
        };
    }

    private static async Task<Guid> CreateReleaseAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/releases", Request());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement value = await ReadAsync(response);
        return value.GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> PreviewAsync(HttpClient client, Guid id)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync($"/api/releases/{id}/date-preview", new { discogsReleaseId = "249504" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response);
    }

    private static string Token(JsonElement preview)
    {
        return Assert.IsType<string>(preview.GetProperty("token").GetString());
    }

    private static Task<HttpResponseMessage> ApplyAsync(HttpClient client, Guid id, string token)
    {
        return client.PostAsJsonAsync($"/api/releases/{id}/date-apply", new { token, confirmed = true });
    }

    private static async Task<JsonElement> ReadReleaseAsync(HttpClient client, Guid id)
    {
        using HttpResponseMessage response = await client.GetAsync($"/api/releases/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    private static async Task AssertErrorAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal(code, (await ReadAsync(response)).GetProperty("code").GetString());
    }
}
