using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "BestEffort relation chains promote only the final root regardless of suggestion order")]
    public async Task Best_effort_relation_chains_promote_only_the_final_root_regardless_of_suggestion_order()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 29, 1998] Run-DMC - Accepted Relation Chain");
        _ = Directory.CreateDirectory(releaseDirectory);
        string firstTrackPath = Path.Combine(releaseDirectory, "01 First.flac");
        string middleTrackPath = Path.Combine(releaseDirectory, "02 Middle.flac");
        string rootTrackPath = Path.Combine(releaseDirectory, "03 Root.flac");
        await File.WriteAllTextAsync(firstTrackPath, "flac");
        await File.WriteAllTextAsync(middleTrackPath, "flac");
        await File.WriteAllTextAsync(rootTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, firstTrackPath, "Song (Radio Edit)", trackNumber: 1),
            AudioFile(root.Path, middleTrackPath, "Song (Instrumental)", trackNumber: 2),
            AudioFile(root.Path, rootTrackPath, "Song", trackNumber: 3));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        Guid firstDraftTrackId = FindTrackByTitle(scan.RootElement, "Song (Radio Edit)").GetProperty("id").GetGuid();
        Guid middleDraftTrackId = FindTrackByTitle(scan.RootElement, "Song (Instrumental)").GetProperty("id").GetGuid();
        Guid rootDraftTrackId = FindTrackByTitle(scan.RootElement, "Song").GetProperty("id").GetGuid();
        JsonElement[] suggestions =
        [
            .. scan.RootElement.GetProperty("relationSuggestions")
                .EnumerateArray()
                .OrderBy(suggestion => suggestion.GetProperty("id").GetGuid())
        ];
        Assert.Equal(2, suggestions.Length);
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[0].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = firstDraftTrackId },
            new { kind = "draftTrack", id = middleDraftTrackId });
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[1].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = middleDraftTrackId },
            new { kind = "draftTrack", id = rootDraftTrackId });

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync(
            "/api/track-relations?type=versionOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);
        using HttpResponseMessage stacksResponse = await client.GetAsync("/api/tracks/stacks");
        using JsonDocument stacksDocument = await ReadJsonAsync(stacksResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmation.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        JsonElement[] relations = [.. relationsDocument.RootElement.GetProperty("items").EnumerateArray()];
        Assert.Equal(2, relations.Length);
        Assert.Contains(relations, relation =>
            relation.GetProperty("sourceTrackTitle").GetString() == "Song (Radio Edit)" &&
            relation.GetProperty("targetTrackTitle").GetString() == "Song (Instrumental)");
        Assert.Contains(relations, relation =>
            relation.GetProperty("sourceTrackTitle").GetString() == "Song (Instrumental)" &&
            relation.GetProperty("targetTrackTitle").GetString() == "Song");
        Guid middleTrackId = relations
            .Single(relation => relation.GetProperty("sourceTrackTitle").GetString() == "Song (Instrumental)")
            .GetProperty("sourceTrackId")
            .GetGuid();
        using HttpResponseMessage middleResponse = await client.GetAsync($"/api/tracks/{middleTrackId}");
        using JsonDocument middleDocument = await ReadJsonAsync(middleResponse);
        Assert.Equal(HttpStatusCode.OK, middleResponse.StatusCode);
        Assert.False(middleDocument.RootElement.GetProperty("isOriginal").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, stacksResponse.StatusCode);
        JsonElement stack = Assert.Single(stacksDocument.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal("Song", stack.GetProperty("originalTitle").GetString());
        Assert.Equal(2, stack.GetProperty("memberCount").GetInt32());
    }

    [Fact(DisplayName = "Multiple accepted BestEffort relations to one target create one visible track stack")]
    public async Task Multiple_accepted_best_effort_relations_to_one_target_create_one_visible_track_stack()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 28, 1998] Run-DMC - Accepted Relation Stack");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        string instrumentalTrackPath = Path.Combine(releaseDirectory, "03 Instrumental.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await File.WriteAllTextAsync(instrumentalTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
            AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2),
            AudioFile(root.Path, instrumentalTrackPath, "It's Like That (Instrumental)", trackNumber: 3));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid baseDraftTrackId = FindTrackByTitle(scan.RootElement, "It's Like That").GetProperty("id").GetGuid();
        Guid radioEditDraftTrackId = FindTrackByTitle(scan.RootElement, "It's Like That (Radio Edit)").GetProperty("id").GetGuid();
        Guid instrumentalDraftTrackId = FindTrackByTitle(scan.RootElement, "It's Like That (Instrumental)").GetProperty("id").GetGuid();
        JsonElement[] suggestions =
        [
            .. scan.RootElement.GetProperty("relationSuggestions")
                .EnumerateArray()
                .OrderBy(suggestion => suggestion.GetProperty("id").GetGuid())
        ];
        Assert.Equal(2, suggestions.Length);
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[0].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = radioEditDraftTrackId },
            new { kind = "draftTrack", id = baseDraftTrackId });
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[1].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = instrumentalDraftTrackId },
            new { kind = "draftTrack", id = baseDraftTrackId });

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync(
            "/api/track-relations?type=versionOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);
        using HttpResponseMessage stacksResponse = await client.GetAsync("/api/tracks/stacks");
        using JsonDocument stacksDocument = await ReadJsonAsync(stacksResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmation.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        JsonElement[] relations = [.. relationsDocument.RootElement.GetProperty("items").EnumerateArray()];
        Assert.Equal(2, relations.Length);
        Assert.Contains(relations, relation =>
            relation.GetProperty("sourceTrackTitle").GetString() == "It's Like That (Radio Edit)" &&
            relation.GetProperty("targetTrackTitle").GetString() == "It's Like That");
        Assert.Contains(relations, relation =>
            relation.GetProperty("sourceTrackTitle").GetString() == "It's Like That (Instrumental)" &&
            relation.GetProperty("targetTrackTitle").GetString() == "It's Like That");
        Assert.Equal(HttpStatusCode.OK, stacksResponse.StatusCode);
        JsonElement stack = Assert.Single(stacksDocument.RootElement.GetProperty("items").EnumerateArray());
        Guid targetTrackId = Assert.Single(relations.Select(relation => relation.GetProperty("targetTrackId").GetGuid()).Distinct());
        Assert.Equal(targetTrackId, stack.GetProperty("originalTrackId").GetGuid());
        Assert.Equal(2, stack.GetProperty("memberCount").GetInt32());
        Guid[] memberIds =
        [
            .. stack.GetProperty("members")
                .EnumerateArray()
                .Select(member => member.GetProperty("trackId").GetGuid())
        ];
        Guid[] expectedMemberIds =
        [
            .. relations.Select(relation => relation.GetProperty("sourceTrackId").GetGuid())
        ];
        Guid[] expectedSortedMemberIds = [.. expectedMemberIds.OrderBy(id => id)];
        Guid[] actualSortedMemberIds = [.. memberIds.OrderBy(id => id)];
        Assert.Equal(expectedSortedMemberIds, actualSortedMemberIds);
    }
}
