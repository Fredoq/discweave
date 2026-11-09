using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Theory(DisplayName = "Missing or ambiguous import file mappings do not suppress relation gaps")]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Missing_or_ambiguous_import_file_mappings_do_not_suppress_relation_gaps(bool ambiguous)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        const string root = "/music/rejected-mapping";
        const string folder = root + "/[DW 04, 2026] Import Artist - Mapping Control";
        const string variantPath = folder + "/02 Mapping Radio.flac";
        using JsonDocument scan = await PostDesktopScanAsync(client, root,
            DesktopAudioFile(root, folder + "/01 Mapping.flac", "Mapping", 1, new string('3', 64)),
            DesktopAudioFile(root, variantPath, "Mapping (Radio Edit)", 2, new string('4', 64)));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scan.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();
        using JsonDocument decision = await SendJsonAsync(client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new { decision = "rejected", reviewed = (object?)null }), HttpStatusCode.OK);
        await ConfirmOnlyDraftAsync(client, scan);
        using JsonDocument before = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps&limit=100", HttpStatusCode.OK);
        Assert.Empty(before.RootElement.GetProperty("items").EnumerateArray());

        await host.ChangeReviewImportFileMappingAsync(variantPath, ambiguous);

        using JsonDocument after = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps&limit=100", HttpStatusCode.OK);
        JsonElement item = Assert.Single(after.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal("variantTitleWithoutRelation", item.GetProperty("subtype").GetString());
        Assert.Contains(item.GetProperty("targets").EnumerateArray(), target => target.GetProperty("title").GetString() == "Mapping (Radio Edit)");
        Assert.Contains(item.GetProperty("targets").EnumerateArray(), target => target.GetProperty("title").GetString() == "Mapping");
    }

    [Fact(DisplayName = "Rejected existing track endpoints suppress only the reviewed relation")]
    public async Task Rejected_existing_track_endpoints_suppress_only_the_reviewed_relation()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid original = await CreateAttributedTrackAsync(client, "Existing Control", "Import Artist");
        Guid variant = await CreateAttributedTrackAsync(client, "Existing Control (Radio Edit)", "Import Artist");
        using JsonDocument before = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps&limit=100", HttpStatusCode.OK);
        JsonElement existingGap = Assert.Single(before.RootElement.GetProperty("items").EnumerateArray());
        Assert.Contains(variant, TargetIds(existingGap));
        Assert.Contains(original, TargetIds(existingGap));

        const string root = "/music/rejected-existing";
        const string folder = root + "/[DW 05, 2026] Import Artist - Existing Endpoint Control";
        using JsonDocument scan = await PostDesktopScanAsync(client, root,
            DesktopAudioFile(root, folder + "/01 Imported.flac", "Imported Control", 1, new string('5', 64)),
            DesktopAudioFile(root, folder + "/02 Imported Radio.flac", "Imported Control (Radio Edit)", 2, new string('6', 64)));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scan.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();
        using JsonDocument reviewed = await SendJsonAsync(client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "pending",
                reviewed = new
                {
                    source = new { kind = "existingTrack", id = variant },
                    target = new { kind = "existingTrack", id = original },
                    relationTypeCode = "versionOf"
                }
            }), HttpStatusCode.OK);
        using JsonDocument rejected = await SendJsonAsync(client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new { decision = "rejected", reviewed = (object?)null }), HttpStatusCode.OK);
        await ConfirmOnlyDraftAsync(client, scan);

        using JsonDocument after = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps&limit=100", HttpStatusCode.OK);
        JsonElement item = Assert.Single(after.RootElement.GetProperty("items").EnumerateArray());
        Assert.DoesNotContain(variant, TargetIds(item));
        Assert.DoesNotContain(original, TargetIds(item));
        Assert.Contains(item.GetProperty("targets").EnumerateArray(), target => target.GetProperty("title").GetString() == "Imported Control (Radio Edit)");
        Assert.Contains(item.GetProperty("targets").EnumerateArray(), target => target.GetProperty("title").GetString() == "Imported Control");
    }
}
