using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    private static readonly string[] _musicBrainzProviderCodes =
        ["musicbrainz"];

    [Fact(DisplayName = "External original discovery returns the exact response contract")]
    public async Task External_original_discovery_returns_the_exact_response_contract()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        RecordingReleaseRoute route = Route(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            1983,
            3,
            7) with
        {
            Artists = ["New Order"],
            Labels = ["Factory"],
            Formats = ["12\" Vinyl"],
            CatalogNumber = "FAC 73",
            TrackTitle = "Blue Monday",
            TrackPosition = "A",
            TrackDuration = TimeSpan.FromSeconds(418),
            RelatedReleaseSources =
            [
                new ExternalMetadataSource(
                    "discogs",
                    "release",
                    "42",
                    "https://discogs.com/release/42",
                    "Discogs")
            ]
        };
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [
                        LineageCandidate(
                            candidateId,
                            [Relation(selectedId, candidateId)],
                            [route])
                    ],
                    RecordingSource(selectedId),
                    ["musicbrainz.partial"]))
        };
        var localTrackId = Guid.Parse(
            "00000000-0000-0000-0000-000000000001");
        LocalOriginalCandidate localCandidate = Candidate(
            localTrackId,
            OriginalCandidateConfidence.Medium) with
        {
            RecordingSource = RecordingSource(candidateId)
        };
        LocalOriginalCandidateResult local = EmptyLocalResult() with
        {
            Candidates = [localCandidate]
        };
        await using ApiTestHost host =
            await CreateHostWithResultAsync(local, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external",
            new
            {
                providerCodes = _musicBrainzProviderCodes,
                searchMode = "releaseFirst"
            });
        string payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(payload);
        JsonElement root = document.RootElement;
        Assert.Equal(
            ["local", "items", "providerStatuses", "warnings", "searchDiagnostics"],
            PropertyNames(root));
        Assert.Equal(
            ["sourceTrackId", "hasReliableLocalCandidate", "items"],
            PropertyNames(root.GetProperty("local")));
        JsonElement item =
            Assert.Single(root.GetProperty("items").EnumerateArray());
        Assert.Equal(
            [
                "candidateKey",
                "localTrackId",
                "recordingSource",
                "title",
                "artists",
                "origins",
                "confidence",
                "selectable",
                "inferenceComplete",
                "candidateRole",
                "discoveryPaths",
                "suggestedRelationTypeCode",
                "earliestKnownDate",
                "supportingEvidence",
                "contradictions",
                "missingEvidence",
                "releaseRoutes",
                "discogsStatus",
                "discogsWarnings",
                "discogsRetryContext"
            ],
            PropertyNames(item));
        Assert.Equal(
            [
                "providerCode",
                "resourceType",
                "externalId",
                "sourceUrl",
                "attribution"
            ],
            PropertyNames(item.GetProperty("recordingSource")));
        Assert.Equal(
            ["local", "musicbrainz"],
            item.GetProperty("origins")
                .EnumerateArray()
                .Select(origin => origin.GetString()));
        Assert.Equal(
            localTrackId,
            item.GetProperty("localTrackId").GetGuid());
        Assert.Equal("high", item.GetProperty("confidence").GetString());
        Assert.True(item.GetProperty("selectable").GetBoolean());
        Assert.Equal(
            ["1983-03-07", "day", "True"],
            DateValues(item));
        JsonElement release =
            Assert.Single(item.GetProperty("releaseRoutes").EnumerateArray());
        Assert.Equal(
            [
                "releaseSource",
                "releaseGroupSource",
                "title",
                "date",
                "mediumPosition",
                "musicBrainzTrackMbid",
                "releaseGroupRerecordingContext",
                "relatedReleaseSources",
                "artists",
                "labels",
                "formats",
                "catalogNumber",
                "trackTitle",
                "trackPosition",
                "trackDurationSeconds",
                "discogsBinding",
                "isPreferred",
                "evidenceCodes"
            ],
            PropertyNames(release));
        Assert.Equal(
            ["New Order"],
            release.GetProperty("artists").EnumerateArray().Select(value => value.GetString()));
        Assert.Equal("Factory", release.GetProperty("labels")[0].GetString());
        Assert.Equal("12\" Vinyl", release.GetProperty("formats")[0].GetString());
        Assert.Equal("FAC 73", release.GetProperty("catalogNumber").GetString());
        Assert.Equal("Blue Monday", release.GetProperty("trackTitle").GetString());
        Assert.Equal("A", release.GetProperty("trackPosition").GetString());
        Assert.Equal(418, release.GetProperty("trackDurationSeconds").GetDouble());
        Assert.Equal(
            ["year", "month", "day"],
            PropertyNames(release.GetProperty("date")));
        JsonElement status = root.GetProperty("providerStatuses")
            .EnumerateArray()
            .Single(value =>
                value.GetProperty("providerCode").GetString()
                    == "musicbrainz");
        Assert.Equal(
            ["providerCode", "outcome", "errorCode", "retryAfter"],
            PropertyNames(status));
        Assert.Equal("succeeded", status.GetProperty("outcome").GetString());
        Assert.Equal(
            ["musicbrainz.partial"],
            root.GetProperty("warnings")
                .EnumerateArray()
                .Select(warning => warning.GetString()));
        Assert.Empty(root.GetProperty("searchDiagnostics").EnumerateArray());
        Assert.DoesNotContain("collectionId", payload, StringComparison.Ordinal);
        Assert.DoesNotContain("confirmationToken", payload, StringComparison.Ordinal);
        Assert.Equal(
            OriginalDiscoverySearchMode.ReleaseFirst,
            provider.LastQuery!.SearchMode);
    }

    [Fact(DisplayName = "Unknown external discovery search mode is rejected")]
    public async Task Unknown_external_discovery_search_mode_is_rejected()
    {
        var provider = new FakeRecordingLineageProvider();
        LocalOriginalCandidateResult local = EmptyLocalResult();
        await using ApiTestHost host =
            await CreateHostWithResultAsync(local, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external",
            new { searchMode = "exhaustiveMagic" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, provider.CallCount);
    }

    [Theory(DisplayName = "Null and empty request bodies default to MusicBrainz")]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public async Task Null_and_empty_request_bodies_default_to_MusicBrainz(
        int requestBodyCase)
    {
        var provider = new FakeRecordingLineageProvider();
        LocalOriginalCandidateResult local = EmptyLocalResult();
        await using ApiTestHost host =
            await CreateHostWithResultAsync(local, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string body = requestBodyCase switch
        {
            0 => "null",
            1 => "{}",
            2 => JsonSerializer.Serialize(
                new { providerCodes = (string[]?)null }),
            _ => JsonSerializer.Serialize(
                new { providerCodes = Array.Empty<string>() })
        };
        using var content = new StringContent(
            body,
            Encoding.UTF8,
            "application/json");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external",
            content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, provider.CallCount);
    }

    [Fact(DisplayName = "Malformed JSON remains at the ASP.NET Core bad request boundary")]
    public async Task Malformed_JSON_remains_at_the_ASPNET_Core_bad_request_boundary()
    {
        var provider = new FakeRecordingLineageProvider();
        LocalOriginalCandidateResult local = EmptyLocalResult();
        await using ApiTestHost host =
            await CreateHostWithResultAsync(local, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using var content = new StringContent(
            "{",
            Encoding.UTF8,
            "application/json");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external",
            content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, provider.CallCount);
    }

    private static string[] PropertyNames(JsonElement element)
    {
        return
        [
            .. element.EnumerateObject().Select(property => property.Name)
        ];
    }

    private static string[] DateValues(JsonElement item)
    {
        JsonElement date = item.GetProperty("earliestKnownDate");
        return
        [
            date.GetProperty("value").GetString() ?? string.Empty,
            date.GetProperty("precision").GetString() ?? string.Empty,
            date.GetProperty("complete").GetBoolean().ToString()
        ];
    }
}
