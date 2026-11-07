using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Theory(DisplayName = "Review Workbench rejects invalid focus with a structured error")]
    [InlineData("invalid")]
    [InlineData("1")]
    [InlineData("")]
    [InlineData("Actionable")]
    public async Task Review_workbench_rejects_invalid_focus_with_a_structured_error(string focus)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument response = await GetJsonAsync(client, $"/api/review-workbench/items?focus={focus}", HttpStatusCode.BadRequest);
        Assert.Equal("review_workbench.focus_invalid", response.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Review Workbench classifies every subtype without changing stored issue identity")]
    public async Task Review_workbench_classifies_every_subtype_without_changing_stored_issue_identity()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string[] optional = ["releasesMissingYearOrDate", "releasesMissingLabel", "tracksMissingDuration",
            "ownedItemsMissingCondition", "ownedItemsMissingStorageLocation", "localAudioFilesMissingCodec",
            "physicalWithoutDigital", "lossyWithoutLossless", "wantedNotOwned"];
        string[] actionable = ["duplicateReleases", "duplicateTracks", "duplicateDigitalFileIdentities",
            "ownedItemsMissingDigitalFormat", "digitalCopiesMissingLinkedFiles", "localAudioFilesMissingFormat",
            "localAudioFilesUnmapped", "needsDigitization", "variantTitleWithoutRelation", "confirmedImportWarnings",
            "duplicateImportOutcomes", "skippedRelationSuggestions"];
        await host.SeedReviewFocusIssuesAsync([.. optional.Concat(actionable).Select(subtype => ("missingMetadata", subtype, 1))]);
        using JsonDocument all = await GetJsonAsync(client, "/api/review-workbench/items?limit=100", HttpStatusCode.OK);
        using JsonDocument explicitAll = await GetJsonAsync(client, "/api/review-workbench/items?focus=all&limit=100", HttpStatusCode.OK);
        Assert.Equal(all.RootElement.GetRawText(), explicitAll.RootElement.GetRawText());
        Assert.Equal(optional.Length + actionable.Length, all.RootElement.GetProperty("total").GetInt32());
        foreach ((string focus, string[] expected) in new[] { ("optional", optional), ("actionable", actionable) })
        {
            using JsonDocument filtered = await GetJsonAsync(client, $"/api/review-workbench/items?focus={focus}&limit=100", HttpStatusCode.OK);
            Assert.Equal(expected.Order(), filtered.RootElement.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("subtype").GetString()).Order());
            Assert.All(filtered.RootElement.GetProperty("items").EnumerateArray(), item =>
            {
                Assert.Equal(focus, item.GetProperty("focus").GetString());
                Assert.Contains(all.RootElement.GetProperty("items").EnumerateArray(), original => original.GetProperty("stableKey").GetString() == item.GetProperty("stableKey").GetString());
            });
        }
    }

    [Fact(DisplayName = "Review Workbench category counts include the entire focused state queue before category and pagination")]
    public async Task Review_workbench_category_counts_include_the_entire_focused_state_queue_before_category_and_pagination()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        await host.SeedReviewFocusIssuesAsync(
            ("missingMetadata", "releasesMissingLabel", 130),
            ("missingMetadata", "localAudioFilesMissingFormat", 120),
            ("formatGaps", "needsDigitization", 4),
            ("relationGaps", "variantTitleWithoutRelation", 3),
            ("duplicateCandidates", "duplicateTracks", 2),
            ("importCleanup", "confirmedImportWarnings", 1));
        using JsonDocument first = await GetJsonAsync(client, "/api/review-workbench/items?focus=actionable&category=missingMetadata&limit=100", HttpStatusCode.OK);
        using JsonDocument next = await GetJsonAsync(client, "/api/review-workbench/items?focus=actionable&category=missingMetadata&limit=100&offset=100", HttpStatusCode.OK);
        Assert.Equal(120, first.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(100, first.RootElement.GetProperty("items").GetArrayLength());
        Assert.Equal(20, next.RootElement.GetProperty("items").GetArrayLength());
        Assert.Equal(first.RootElement.GetProperty("categoryCounts").GetRawText(), next.RootElement.GetProperty("categoryCounts").GetRawText());
        Assert.Equal(130, first.RootElement.GetProperty("summary").GetProperty("active").GetInt32());
        Assert.Empty(first.RootElement.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("stableKey").GetString())
            .Intersect(next.RootElement.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("stableKey").GetString())));
        JsonElement counts = first.RootElement.GetProperty("categoryCounts");
        Assert.Equal(5, counts.EnumerateObject().Count());
        Assert.Equal(120, counts.GetProperty("missingMetadata").GetInt32());
        Assert.Equal(4, counts.GetProperty("formatGaps").GetInt32());
        Assert.Equal(3, counts.GetProperty("relationGaps").GetInt32());
        Assert.Equal(2, counts.GetProperty("duplicateCandidates").GetInt32());
        Assert.Equal(1, counts.GetProperty("importCleanup").GetInt32());
        string key = first.RootElement.GetProperty("items")[0].GetProperty("stableKey").GetString()!;
        using JsonDocument dismissed = await SendJsonAsync(client.PatchAsJsonAsync($"/api/review-workbench/items/{key}/state", new { state = "dismissed" }), HttpStatusCode.OK);
        using JsonDocument state = await GetJsonAsync(client, "/api/review-workbench/items?focus=actionable&state=dismissed&category=formatGaps&offset=100", HttpStatusCode.OK);
        Assert.Equal(0, state.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(1, state.RootElement.GetProperty("categoryCounts").GetProperty("missingMetadata").GetInt32());
        Assert.Equal(0, state.RootElement.GetProperty("categoryCounts").GetProperty("formatGaps").GetInt32());
        Assert.Equal(129, state.RootElement.GetProperty("summary").GetProperty("active").GetInt32());
        Assert.Equal(1, state.RootElement.GetProperty("summary").GetProperty("dismissed").GetInt32());
        using JsonDocument optional = await GetJsonAsync(client, "/api/review-workbench/items?focus=optional&limit=100&offset=100", HttpStatusCode.OK);
        Assert.Equal(130, optional.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(30, optional.RootElement.GetProperty("items").GetArrayLength());
        Assert.Equal(130, optional.RootElement.GetProperty("categoryCounts").GetProperty("missingMetadata").GetInt32());
        Assert.Equal(0, optional.RootElement.GetProperty("summary").GetProperty("dismissed").GetInt32());
    }

    [Fact(DisplayName = "Review Workbench focus preserves live signal triage across refresh and isolates collection counts")]
    public async Task Review_workbench_focus_preserves_live_signal_triage_across_refresh_and_isolates_collection_counts()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient owner, HttpClient other) = await CreateAuthenticatedClientsAsync(host);
        _ = await CreateReleaseAsync(owner, "Optional metadata");
        using JsonDocument original = await GetJsonAsync(owner, "/api/review-workbench/items?focus=optional", HttpStatusCode.OK);
        string key = original.RootElement.GetProperty("items")[0].GetProperty("stableKey").GetString()!;
        foreach (string status in new[] { "dismissed", "resolved", "reopened" })
        {
            using JsonDocument updated = await SendJsonAsync(owner.PatchAsJsonAsync($"/api/review-workbench/items/{key}/state", new { state = status, note = "Keep my triage" }), HttpStatusCode.OK);
            using JsonDocument refresh = await SendJsonAsync(owner.PostAsync("/api/review-workbench/refresh", content: null), HttpStatusCode.OK);
            using JsonDocument visible = await GetJsonAsync(owner, $"/api/review-workbench/items?focus=optional&state={status}", HttpStatusCode.OK);
            Assert.Equal("optional", updated.RootElement.GetProperty("focus").GetString());
            Assert.Contains(visible.RootElement.GetProperty("items").EnumerateArray(), item => item.GetProperty("stableKey").GetString() == key && item.GetProperty("state").GetString() == status);
            Assert.Equal(1, visible.RootElement.GetProperty("summary").GetProperty(status).GetInt32());
        }
        foreach (string focus in new[] { "all", "optional", "actionable" })
        {
            using JsonDocument isolated = await GetJsonAsync(other, $"/api/review-workbench/items?focus={focus}", HttpStatusCode.OK);
            Assert.Equal(0, isolated.RootElement.GetProperty("total").GetInt32());
            Assert.All(isolated.RootElement.GetProperty("categoryCounts").EnumerateObject(), property => Assert.Equal(0, property.Value.GetInt32()));
            Assert.All(isolated.RootElement.GetProperty("summary").EnumerateObject(), property => Assert.Equal(0, property.Value.GetInt32()));
        }
    }
}
