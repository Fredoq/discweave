using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    private static readonly string[] RemixOnlyStackRelationTypes = [" remixOf ", "remixOf"];
    private static readonly string[] VersionOnlyStackRelationTypes = ["versionOf"];
    private static readonly string[] InvalidStackRelationTypes = ["unknown"];

    [Fact(DisplayName = "Stack assignment service promotes a standalone target without saving or starting a transaction")]
    public async Task Stack_assignment_service_promotes_a_standalone_target_without_saving_or_starting_a_transaction()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Standalone Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Standalone Target");
            _ = await context.SaveChangesAsync();
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.AssignAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: true,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.True(result.WasCreated);
            Assert.NotNull(result.Relation);
            Assert.True(target.Metadata.IsOriginal);
            Assert.Equal(source.Id, result.Relation.SourceTrackId);
            Assert.Equal(target.Id, result.Relation.TargetTrackId);
            Assert.Equal("versionOf", result.Relation.RelationType);
            Assert.Equal(EntityState.Added, context.Entry(result.Relation).State);
            Assert.Null(context.Database.CurrentTransaction);

            string connectionString = context.Database.GetConnectionString() ??
                throw new InvalidOperationException("Test database connection string is unavailable");
            DbContextOptions<DiscWeaveDbContext> verificationOptions =
                new DbContextOptionsBuilder<DiscWeaveDbContext>()
                    .UseSqlite(connectionString)
                    .Options;
            await using var verificationContext =
                new DiscWeaveDbContext(verificationOptions);
            Track persistedTarget = await verificationContext.Tracks
                .SingleAsync(
                    track => track.CollectionId == collectionId &&
                        track.Id == target.Id,
                    CancellationToken.None);

            Assert.False(persistedTarget.Metadata.IsOriginal);
            Assert.Empty(await verificationContext.TrackRelations
                .Where(relation => relation.CollectionId == collectionId)
                .ToArrayAsync(CancellationToken.None));
        }
    }

    [Fact(DisplayName = "Stack assignment validation does not mutate a standalone promotion")]
    public async Task Stack_assignment_validation_does_not_mutate_a_standalone_promotion()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Validation Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Validation Target");
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: true,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.True(result.WasCreated);
            Assert.Null(result.Relation);
            Assert.False(target.Metadata.IsOriginal);
            Assert.Empty(context.TrackRelations.Local);
            Assert.Null(context.Database.CurrentTransaction);
        }
    }

    [Fact(DisplayName = "Stack assignment service accepts an existing original root without promotion")]
    public async Task Stack_assignment_service_accepts_an_existing_original_root_without_promotion()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Existing Root Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Existing Root",
                isOriginal: true);
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.AssignAsync(
                context,
                collectionId,
                source,
                target,
                "remixOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.True(result.WasCreated);
            Assert.NotNull(result.Relation);
            Assert.True(target.Metadata.IsOriginal);
        }
    }

    [Fact(DisplayName = "Stack assignment service preserves invalid relation type errors")]
    public async Task Stack_assignment_service_preserves_invalid_relation_type_errors()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Invalid Type Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Invalid Type Target");
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            DomainException exception = await Assert.ThrowsAsync<DomainException>(
                () => service.ValidateAsync(
                    context,
                    collectionId,
                    source,
                    target,
                    "notAStackRelation",
                    markTargetAsOriginal: true,
                    CancellationToken.None));

            Assert.Equal("track_relation.type_invalid", exception.Code);
            Assert.False(target.Metadata.IsOriginal);
            Assert.Empty(context.TrackRelations.Local);
        }
    }

    [Fact(DisplayName = "Stack assignment service rejects active relation types not configured for stacks")]
    public async Task Stack_assignment_service_rejects_active_relation_types_not_configured_for_stacks()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync(["versionOf"]);
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Unconfigured Type Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Unconfigured Type Target");
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                source,
                target,
                "remixOf",
                markTargetAsOriginal: true,
                CancellationToken.None);

            Assert.False(result.IsSuccess);
            Assert.Equal(
                TrackStackAssignmentFailure.RelationTypeNotConfigured,
                result.Failure);
            Assert.False(result.WasCreated);
            Assert.Null(result.Relation);
        }
    }

    [Fact(DisplayName = "Track stack settings expose defaults and filter stack traversal")]
    public async Task Track_stack_settings_expose_defaults_and_filter_stack_traversal()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid originalId = await CreateTrackAsync(client, "Blue Monday");
        Guid remixId = await CreateTrackAsync(client, "Blue Monday (Hardfloor Mix)");
        Guid versionId = await CreateTrackAsync(client, "Blue Monday (Edit)");
        await MarkOriginalAsync(client, originalId, "Blue Monday", 1983);
        _ = await CreateTrackRelationAsync(client, remixId, originalId, "remixOf");
        _ = await CreateTrackRelationAsync(client, versionId, originalId, "versionOf");

        using HttpResponseMessage defaultsResponse = await client.GetAsync("/api/settings/track-stack");
        using JsonDocument defaultsDocument = await ReadJsonAsync(defaultsResponse);

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            "/api/settings/track-stack",
            new { defaultRelationTypeCodes = RemixOnlyStackRelationTypes });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        using HttpResponseMessage invalidResponse = await client.PutAsJsonAsync(
            "/api/settings/track-stack",
            new { defaultRelationTypeCodes = InvalidStackRelationTypes });
        using JsonDocument invalidDocument = await ReadJsonAsync(invalidResponse);

        using HttpResponseMessage stacksResponse = await client.GetAsync("/api/tracks/stacks");
        using JsonDocument stacksDocument = await ReadJsonAsync(stacksResponse);

        Assert.Equal(HttpStatusCode.OK, defaultsResponse.StatusCode);
        string[] defaultCodes =
        [
            .. defaultsDocument.RootElement.GetProperty("defaultRelationTypeCodes")
                .EnumerateArray()
                .Select(item => item.GetString() ?? string.Empty)
        ];
        Assert.Equal(["remixOf", "versionOf"], defaultCodes);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal("remixOf", updateDocument.RootElement.GetProperty("defaultRelationTypeCodes")[0].GetString());
        Assert.Equal(1, updateDocument.RootElement.GetProperty("defaultRelationTypeCodes").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
        Assert.Equal("track_stack_settings.relation_type_invalid", invalidDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, stacksResponse.StatusCode);
        JsonElement stack = stacksDocument.RootElement.GetProperty("items")[0];
        Assert.Equal(originalId, stack.GetProperty("originalTrackId").GetGuid());
        Assert.Equal(1, stack.GetProperty("memberCount").GetInt32());
        Assert.Equal(remixId, stack.GetProperty("members")[0].GetProperty("trackId").GetGuid());
    }

    [Fact(DisplayName = "Track stacks are transitive, deduplicated, and cycle safe")]
    public async Task Track_stacks_are_transitive_deduplicated_and_cycle_safe()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid originalId = await CreateTrackAsync(client, "Confusion");
        Guid versionId = await CreateTrackAsync(client, "Confusion (Edit)");
        Guid remixId = await CreateTrackAsync(client, "Confusion (Warehouse Mix)");
        Guid bootlegId = await CreateTrackAsync(client, "Confusion (Bootleg Dub)");
        await MarkOriginalAsync(client, originalId, "Confusion", 1983);
        _ = await CreateTrackRelationAsync(client, versionId, originalId, "versionOf");
        _ = await CreateTrackRelationAsync(client, remixId, versionId, "remixOf");
        _ = await CreateTrackRelationAsync(client, remixId, originalId, "versionOf");
        _ = await CreateTrackRelationAsync(client, bootlegId, remixId, "remixOf");
        _ = await CreateTrackRelationAsync(client, originalId, bootlegId, "versionOf");

        using HttpResponseMessage response = await client.GetAsync("/api/tracks/stacks");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement stack = document.RootElement.GetProperty("items")[0];
        JsonElement members = stack.GetProperty("members");
        Guid[] memberIds = [.. members.EnumerateArray().Select(member => member.GetProperty("trackId").GetGuid())];
        Assert.Equal(3, stack.GetProperty("memberCount").GetInt32());
        Assert.Equal(memberIds.Distinct().Count(), memberIds.Length);
        Assert.Contains(versionId, memberIds);
        Assert.Contains(remixId, memberIds);
        Assert.Contains(bootlegId, memberIds);
        JsonElement remixMember = members.EnumerateArray().Single(member => member.GetProperty("trackId").GetGuid() == remixId);
        Assert.True(remixMember.GetProperty("isDirect").GetBoolean());
        Assert.Equal(1, remixMember.GetProperty("depth").GetInt32());
        JsonElement bootlegMember = members.EnumerateArray().Single(member => member.GetProperty("trackId").GetGuid() == bootlegId);
        Assert.False(bootlegMember.GetProperty("isDirect").GetBoolean());
        Assert.Equal(2, bootlegMember.GetProperty("depth").GetInt32());
        Assert.True(stack.GetProperty("hasCycleIssue").GetBoolean());
        Assert.Contains(
            stack.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "track_stack.cycle");
    }

    [Fact(DisplayName = "Stack relation endpoint creates relation and marks target original atomically")]
    public async Task Stack_relation_endpoint_creates_relation_and_marks_target_original_atomically()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid originalId = await CreateTrackAsync(client, "Show Me Love (New York Mix)");
        Guid dubId = await CreateTrackAsync(client, "Show Me Love (Dub Mix)");
        Guid invalidTargetId = await CreateTrackAsync(client, "Show Me Love (Radio Edit)");

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/track-relations/stack",
            new
            {
                sourceTrackId = dubId,
                targetTrackId = originalId,
                type = "versionOf",
                markTargetAsOriginal = true
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);

        using HttpResponseMessage targetResponse = await client.GetAsync($"/api/tracks/{originalId}");
        using JsonDocument targetDocument = await ReadJsonAsync(targetResponse);

        using HttpResponseMessage invalidResponse = await client.PostAsJsonAsync(
            "/api/track-relations/stack",
            new
            {
                sourceTrackId = dubId,
                targetTrackId = invalidTargetId,
                type = "notAStackRelation",
                markTargetAsOriginal = true
            });
        using JsonDocument invalidDocument = await ReadJsonAsync(invalidResponse);

        using HttpResponseMessage invalidTargetResponse = await client.GetAsync($"/api/tracks/{invalidTargetId}");
        using JsonDocument invalidTargetDocument = await ReadJsonAsync(invalidTargetResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(dubId, createDocument.RootElement.GetProperty("sourceTrackId").GetGuid());
        Assert.Equal(originalId, createDocument.RootElement.GetProperty("targetTrackId").GetGuid());
        Assert.Equal("versionOf", createDocument.RootElement.GetProperty("type").GetString());
        Assert.Equal(HttpStatusCode.OK, targetResponse.StatusCode);
        Assert.True(targetDocument.RootElement.GetProperty("isOriginal").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
        Assert.Equal("track_relation.type_invalid", invalidDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, invalidTargetResponse.StatusCode);
        Assert.False(invalidTargetDocument.RootElement.GetProperty("isOriginal").GetBoolean());
    }

    [Fact(DisplayName = "Stack relation endpoint reuses existing relation and marks target original")]
    public async Task Stack_relation_endpoint_reuses_existing_relation_and_marks_target_original()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid originalId = await CreateTrackAsync(client, "It's Like That (Drop The Break)");
        Guid radioEditId = await CreateTrackAsync(client, "It's Like That (Drop The Break) (Radio Edit)");
        Guid existingRelationId = await CreateTrackRelationAsync(client, radioEditId, originalId, "versionOf");

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations/stack",
            new
            {
                sourceTrackId = radioEditId,
                targetTrackId = originalId,
                type = "versionOf",
                markTargetAsOriginal = true
            });
        using JsonDocument document = await ReadJsonAsync(response);

        using HttpResponseMessage targetResponse = await client.GetAsync($"/api/tracks/{originalId}");
        using JsonDocument targetDocument = await ReadJsonAsync(targetResponse);

        using HttpResponseMessage relationsResponse = await client.GetAsync("/api/track-relations");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(existingRelationId, document.RootElement.GetProperty("id").GetGuid());
        Assert.Equal(radioEditId, document.RootElement.GetProperty("sourceTrackId").GetGuid());
        Assert.Equal(originalId, document.RootElement.GetProperty("targetTrackId").GetGuid());
        Assert.Equal(HttpStatusCode.OK, targetResponse.StatusCode);
        Assert.True(targetDocument.RootElement.GetProperty("isOriginal").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.Equal(1, relationsDocument.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Stack relation endpoint rejects active relation types not configured for stacks")]
    public async Task Stack_relation_endpoint_rejects_active_relation_types_not_configured_for_stacks()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid originalId = await CreateTrackAsync(client, "Good Life");
        Guid remixId = await CreateTrackAsync(client, "Good Life (Mayday Mix)");

        using HttpResponseMessage settingsResponse = await client.PutAsJsonAsync(
            "/api/settings/track-stack",
            new { defaultRelationTypeCodes = VersionOnlyStackRelationTypes });
        using JsonDocument settingsDocument = await ReadJsonAsync(settingsResponse);

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations/stack",
            new
            {
                sourceTrackId = remixId,
                targetTrackId = originalId,
                type = "remixOf",
                markTargetAsOriginal = true
            });
        using JsonDocument document = await ReadJsonAsync(response);

        using HttpResponseMessage targetResponse = await client.GetAsync($"/api/tracks/{originalId}");
        using JsonDocument targetDocument = await ReadJsonAsync(targetResponse);

        Assert.Equal(HttpStatusCode.OK, settingsResponse.StatusCode);
        Assert.Equal("versionOf", settingsDocument.RootElement.GetProperty("defaultRelationTypeCodes")[0].GetString());
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("track_relation.stack_type_invalid", document.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, targetResponse.StatusCode);
        Assert.False(targetDocument.RootElement.GetProperty("isOriginal").GetBoolean());
    }

    private static async Task MarkOriginalAsync(HttpClient client, Guid trackId, string title, int versionYear)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/tracks/{trackId}",
            new
            {
                title,
                versionYear,
                isOriginal = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                credits = Array.Empty<object>(),
                releaseAppearances = Array.Empty<object>()
            });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(document.RootElement.GetProperty("isOriginal").GetBoolean());
    }

    private static async Task<Guid> CreateTrackRelationAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid targetTrackId,
        string type)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId, targetTrackId, type });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private async Task<(DiscWeaveDbContext Context, CollectionId CollectionId)>
        CreateStackAssignmentContextAsync(
            IReadOnlyList<string>? configuredRelationTypeCodes = null)
    {
        string connectionString = await _sqlite.CreateDatabaseAsync(
            CancellationToken.None);
        DbContextOptions<DiscWeaveDbContext> options =
            new DbContextOptionsBuilder<DiscWeaveDbContext>()
                .UseSqlite(connectionString)
                .Options;
        var context = new DiscWeaveDbContext(options);
        _ = await context.Database.EnsureCreatedAsync(
            CancellationToken.None);

        var collectionId = CollectionId.New();
        _ = context.MusicCollections.Add(
            MusicCollection.Create(
                collectionId,
                UserId.New(),
                "Stack assignment tests"));
        context.CollectionDictionaryEntries.AddRange(
            CollectionDictionaryDefaults.CreateEntries(collectionId));
        _ = context.TrackStackSettings.Add(
            TrackStackSettings.Create(
                collectionId,
                configuredRelationTypeCodes ??
                    CollectionDictionaryDefaults
                        .DefaultTrackStackRelationTypeCodes));
        _ = await context.SaveChangesAsync(
            CancellationToken.None);

        return (context, collectionId);
    }

    private static TrackStackAssignmentService
        CreateStackAssignmentService()
    {
        return new TrackStackAssignmentService(
            new TrackStackRelationValidator());
    }

    private static Track AddStackAssignmentTrack(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string title,
        bool isOriginal = false)
    {
        var track = Track.Create(
            collectionId,
            TrackId.New(),
            title);
        if (isOriginal)
        {
            track.UpdateMetadata(
                track.Metadata.WithOriginalMarker(true));
        }

        _ = context.Tracks.Add(track);

        return track;
    }
}
