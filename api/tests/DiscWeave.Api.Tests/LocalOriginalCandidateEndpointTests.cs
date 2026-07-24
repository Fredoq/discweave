using System.Net;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateEndpointTests
{
    [Fact(DisplayName = "Local original candidate discovery returns the exact empty response contract")]
    public async Task Local_original_candidate_discovery_returns_the_exact_empty_response_contract()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateTrackAsync(client, "Blue Monday (Remix)");

        using HttpResponseMessage response = await client.GetAsync(
            $"/api/tracks/{sourceTrackId:D}/original-candidates/local");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());
        JsonElement root = document.RootElement;
        Assert.Equal(
            ["sourceTrackId", "hasReliableLocalCandidate", "items"],
            root.EnumerateObject().Select(property => property.Name));
        Assert.Equal(sourceTrackId, root.GetProperty("sourceTrackId").GetGuid());
        Assert.False(root.GetProperty("hasReliableLocalCandidate").GetBoolean());
        Assert.Empty(root.GetProperty("items").EnumerateArray());
    }

    [Fact(DisplayName = "Local original candidate discovery maps the exact ranked item contract")]
    public async Task Local_original_candidate_discovery_maps_the_exact_ranked_item_contract()
    {
        var sourceTrackId =
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        LocalOriginalCandidate high = Candidate(
            Guid.Parse("10000000-0000-0000-0000-000000000001"),
            "ranked-high",
            OriginalCandidateConfidence.High,
            selectable: true,
            OriginalCandidateChronology.FromYear(1981, complete: true));
        LocalOriginalCandidate medium = Candidate(
            Guid.Parse("20000000-0000-0000-0000-000000000002"),
            "ranked-medium",
            OriginalCandidateConfidence.Medium,
            selectable: true,
            OriginalCandidateChronology.FromMonth(
                1982,
                3,
                complete: false),
            supporting:
            [
                Evidence(
                    OriginalCandidateEvidenceCode.DirectedLineage,
                    OriginalCandidateEvidenceKind.Support,
                    OriginalCandidateEvidenceChannel.MusicBrainz)
            ],
            contradictions:
            [
                Evidence(
                    OriginalCandidateEvidenceCode.LaterChronology,
                    OriginalCandidateEvidenceKind.Contradiction,
                    OriginalCandidateEvidenceChannel.Discogs)
            ],
            missing:
            [
                Evidence(
                    OriginalCandidateEvidenceCode.MissingArtist,
                    OriginalCandidateEvidenceKind.Missing,
                    OriginalCandidateEvidenceChannel.LocalCatalog)
            ]) with
        {
            RecordingSource = new ExternalMetadataSource(
                "musicbrainz",
                "recording",
                "9a2fd611-cf3f-4ec5-86de-d3bc51ce4795",
                "https://musicbrainz.org/recording/9a2fd611-cf3f-4ec5-86de-d3bc51ce4795",
                "MusicBrainz")
        };
        LocalOriginalCandidate low = Candidate(
            Guid.Parse("30000000-0000-0000-0000-000000000003"),
            "ranked-low",
            OriginalCandidateConfidence.Low,
            selectable: false,
            OriginalCandidateChronology.FromDay(
                new DateOnly(1983, 4, 5),
                complete: true)) with
        {
            SuggestedRelationTypeCode = null
        };
        var result = new LocalOriginalCandidateResult
        {
            Status = LocalOriginalCandidateStatus.Success,
            SourceTrackId = new TrackId(sourceTrackId),
            Candidates = [high, medium, low]
        };
        await using ApiTestHost host = await CreateHostWithResultAsync(result);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync(
            $"/api/tracks/{sourceTrackId:D}/original-candidates/local");
        string payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(payload);
        JsonElement root = document.RootElement;
        Assert.Equal(
            ["sourceTrackId", "hasReliableLocalCandidate", "items"],
            PropertyNames(root));
        Assert.True(root.GetProperty("hasReliableLocalCandidate").GetBoolean());
        JsonElement[] items =
            [.. root.GetProperty("items").EnumerateArray()];
        Assert.Equal(
            ["ranked-high", "ranked-medium", "ranked-low"],
            items.Select(item =>
                item.GetProperty("candidateKey").GetString()));
        foreach (JsonElement item in items)
        {
            Assert.Equal(CandidatePropertyNames, PropertyNames(item));
            Assert.Equal(
                ["local"],
                item.GetProperty("origins")
                    .EnumerateArray()
                    .Select(origin => origin.GetString()));
        }

        Assert.Equal("high", items[0].GetProperty("confidence").GetString());
        Assert.True(items[0].GetProperty("selectable").GetBoolean());
        Assert.Equal(
            ["1981", "year", "True"],
            DateValues(items[0]));
        Assert.Equal("medium", items[1].GetProperty("confidence").GetString());
        Assert.Equal(
            ["1982-03", "month", "False"],
            DateValues(items[1]));
        AssertEvidence(
            items[1].GetProperty("supportingEvidence")[0],
            "directedLineage",
            "musicBrainz");
        AssertEvidence(
            items[1].GetProperty("contradictions")[0],
            "laterChronology",
            "discogs");
        AssertEvidence(
            items[1].GetProperty("missingEvidence")[0],
            "missingArtist",
            "localCatalog");
        Assert.Equal("low", items[2].GetProperty("confidence").GetString());
        Assert.False(items[2].GetProperty("selectable").GetBoolean());
        Assert.Equal(
            ["1983-04-05", "day", "True"],
            DateValues(items[2]));
        Assert.Equal(
            JsonValueKind.Null,
            items[2].GetProperty("suggestedRelationTypeCode").ValueKind);
        Assert.DoesNotContain("score", payload, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("selected", payload, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("confirmationToken", payload, StringComparison.Ordinal);
        Assert.DoesNotContain("recordingSource", payload, StringComparison.Ordinal);
        Assert.DoesNotContain(
            "9a2fd611-cf3f-4ec5-86de-d3bc51ce4795",
            payload,
            StringComparison.Ordinal);
    }

    private static readonly string[] CandidatePropertyNames =
    [
        "candidateKey",
        "localTrackId",
        "title",
        "artistDisplay",
        "durationSeconds",
        "versionYear",
        "origins",
        "confidence",
        "selectable",
        "isExistingRoot",
        "memberCount",
        "requiresPromotion",
        "suggestedRelationTypeCode",
        "earliestKnownDate",
        "supportingEvidence",
        "contradictions",
        "missingEvidence"
    ];

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
        Assert.Equal(
            ["value", "precision", "complete"],
            PropertyNames(date));
        return
        [
            date.GetProperty("value").GetString() ?? string.Empty,
            date.GetProperty("precision").GetString() ?? string.Empty,
            date.GetProperty("complete").GetBoolean().ToString()
        ];
    }

    private static void AssertEvidence(
        JsonElement evidence,
        string code,
        string channel)
    {
        Assert.Equal(["code", "channel"], PropertyNames(evidence));
        Assert.Equal(code, evidence.GetProperty("code").GetString());
        Assert.Equal(channel, evidence.GetProperty("channel").GetString());
    }
}
