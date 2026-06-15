using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class TrackRelationParserRuleEndpointTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public TrackRelationParserRuleEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Track relation parser rules list builtin defaults")]
    public async Task Track_relation_parser_rules_list_builtin_defaults()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync("/api/settings/track-relation-parser-rules");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement items = document.RootElement.GetProperty("items");
        Assert.Equal(8, items.GetArrayLength());
        AssertBuiltinRule(items, "editOf", "Radio Edit", 95, "variantToBase");
        AssertBuiltinRule(items, "editOf", "Edit", 90, "variantToBase");
        AssertBuiltinRule(items, "editOf", "Single Edit", 90, "variantToBase");
        AssertBuiltinRule(items, "remixOf", "Remix", 90, "variantToBase");
        AssertBuiltinRule(items, "remixOf", "Mix", 75, "variantToBase");
        AssertBuiltinRule(items, "remixOf", "Club Mix", 85, "variantToBase");
        AssertBuiltinRule(items, "versionOf", "Instrumental", 80, "variantToBase");
        AssertBuiltinRule(items, "versionOf", "Extended Mix", 80, "variantToBase");
    }

    private static void AssertBuiltinRule(
        JsonElement items,
        string relationTypeCode,
        string alias,
        int confidence,
        string direction)
    {
        Assert.Contains(items.EnumerateArray(), rule =>
            rule.GetProperty("relationTypeCode").GetString() == relationTypeCode &&
            rule.GetProperty("alias").GetString() == alias &&
            rule.GetProperty("matchMode").GetString() == "exactLastParentheticalToken" &&
            rule.GetProperty("confidence").GetInt32() == confidence &&
            rule.GetProperty("direction").GetString() == direction &&
            rule.GetProperty("isBuiltin").GetBoolean());
    }

    [Fact(DisplayName = "Track relation parser rules can create update and delete custom rules")]
    public async Task Track_relation_parser_rules_can_create_update_and_delete_custom_rules()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/settings/track-relation-parser-rules",
            new
            {
                relationTypeCode = "remixOf",
                alias = "Warehouse Mix",
                matchMode = "exactLastParentheticalToken",
                confidence = 80,
                direction = "variantToBase",
                sortOrder = 50,
                isActive = true
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        Guid ruleId = createDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/settings/track-relation-parser-rules/{ruleId}",
            new
            {
                relationTypeCode = "versionOf",
                alias = "Alternate Version",
                matchMode = "exactLastParentheticalToken",
                confidence = 70,
                direction = "baseToVariant",
                sortOrder = 55,
                isActive = false
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        using HttpRequestMessage deleteRequest = new(HttpMethod.Delete, $"/api/settings/track-relation-parser-rules/{ruleId}");
        deleteRequest.Headers.Add("X-DiscWeave-Confirm-Delete", $"track-relation-parser-rule:{ruleId}");
        using HttpResponseMessage deleteResponse = await client.SendAsync(deleteRequest);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal("remixOf", createDocument.RootElement.GetProperty("relationTypeCode").GetString());
        Assert.Equal("Warehouse Mix", createDocument.RootElement.GetProperty("alias").GetString());
        Assert.Equal(80, createDocument.RootElement.GetProperty("confidence").GetInt32());
        Assert.False(createDocument.RootElement.GetProperty("isBuiltin").GetBoolean());

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal("versionOf", updateDocument.RootElement.GetProperty("relationTypeCode").GetString());
        Assert.Equal("Alternate Version", updateDocument.RootElement.GetProperty("alias").GetString());
        Assert.Equal("baseToVariant", updateDocument.RootElement.GetProperty("direction").GetString());
        Assert.Equal(70, updateDocument.RootElement.GetProperty("confidence").GetInt32());
        Assert.False(updateDocument.RootElement.GetProperty("isActive").GetBoolean());

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    [Fact(DisplayName = "Track relation parser rules reject duplicate rule keys")]
    public async Task Track_relation_parser_rules_reject_duplicate_rule_keys()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        var request = new
        {
            relationTypeCode = "remixOf",
            alias = "Warehouse Mix",
            matchMode = "exactLastParentheticalToken",
            confidence = 80,
            direction = "variantToBase",
            sortOrder = 50,
            isActive = true
        };

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/settings/track-relation-parser-rules",
            request);
        using HttpResponseMessage duplicateResponse = await client.PostAsJsonAsync(
            "/api/settings/track-relation-parser-rules",
            request);
        using JsonDocument duplicateDocument = await ReadJsonAsync(duplicateResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicateResponse.StatusCode);
        Assert.Equal("track_relation_parser_rule.conflict", duplicateDocument.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Track relation parser rules validate missing and inactive relation type codes")]
    public async Task Track_relation_parser_rules_validate_missing_and_inactive_relation_type_codes()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage missingResponse = await client.PostAsJsonAsync(
            "/api/settings/track-relation-parser-rules",
            new
            {
                relationTypeCode = "dubOf",
                alias = "Dub",
                matchMode = "exactLastParentheticalToken",
                confidence = 70,
                direction = "variantToBase",
                sortOrder = 100,
                isActive = true
            });
        using JsonDocument missingDocument = await ReadJsonAsync(missingResponse);

        using HttpResponseMessage createDictionaryResponse = await client.PostAsJsonAsync(
            "/api/settings/dictionaries",
            new { kind = "trackRelationType", code = "dubOf", name = "Dub of", sortOrder = 80, isActive = false });
        _ = createDictionaryResponse.EnsureSuccessStatusCode();
        using HttpResponseMessage inactiveResponse = await client.PostAsJsonAsync(
            "/api/settings/track-relation-parser-rules",
            new
            {
                relationTypeCode = "dubOf",
                alias = "Dub",
                matchMode = "exactLastParentheticalToken",
                confidence = 70,
                direction = "variantToBase",
                sortOrder = 100,
                isActive = true
            });
        using JsonDocument inactiveDocument = await ReadJsonAsync(inactiveResponse);

        Assert.Equal(HttpStatusCode.BadRequest, missingResponse.StatusCode);
        Assert.Equal("track_relation_parser_rule.relation_type_invalid", missingDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, inactiveResponse.StatusCode);
        Assert.Equal("track_relation_parser_rule.relation_type_invalid", inactiveDocument.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Track relation parser rules protect builtin deletes")]
    public async Task Track_relation_parser_rules_protect_builtin_deletes()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage listResponse = await client.GetAsync("/api/settings/track-relation-parser-rules");
        using JsonDocument listDocument = await ReadJsonAsync(listResponse);
        Guid builtinId = Assert.Single(
            listDocument.RootElement.GetProperty("items").EnumerateArray(),
            rule => rule.GetProperty("relationTypeCode").GetString() == "remixOf" &&
                rule.GetProperty("alias").GetString() == "Remix")
            .GetProperty("id")
            .GetGuid();

        using HttpRequestMessage deleteRequest = new(HttpMethod.Delete, $"/api/settings/track-relation-parser-rules/{builtinId}");
        deleteRequest.Headers.Add("X-DiscWeave-Confirm-Delete", $"track-relation-parser-rule:{builtinId}");
        using HttpResponseMessage deleteResponse = await client.SendAsync(deleteRequest);
        using JsonDocument deleteDocument = await ReadJsonAsync(deleteResponse);

        Assert.Equal(HttpStatusCode.BadRequest, deleteResponse.StatusCode);
        Assert.Equal("track_relation_parser_rule.builtin_immutable", deleteDocument.RootElement.GetProperty("code").GetString());
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        Stream stream = await response.Content.ReadAsStreamAsync();
        return await JsonDocument.ParseAsync(stream);
    }
}
