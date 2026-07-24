using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateEndpointTests
    : IClassFixture<SqliteFixture>
{
    private static readonly string[] _mainArtistRoles = ["mainArtist"];
    private readonly SqliteFixture _sqlite;

    public LocalOriginalCandidateEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    private async Task<ApiTestHost> CreateHostWithResultAsync(
        LocalOriginalCandidateResult result)
    {
        return await ApiTestHost.CreateAsync(
            _sqlite,
            services =>
            {
                _ = services.RemoveAll<ILocalOriginalCandidateService>();
                _ = services.AddSingleton<ILocalOriginalCandidateService>(
                    new StubLocalOriginalCandidateService(result));
            });
    }

    private static async Task<Guid> CreateTrackAsync(
        HttpClient client,
        string title,
        int? durationSeconds = null)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new
            {
                title,
                durationSeconds,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>()
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using JsonDocument document = await ReadJsonAsync(response);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateArtistAsync(
        HttpClient client,
        string name)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new { type = "person", name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using JsonDocument document = await ReadJsonAsync(response);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task AddMainArtistAsync(
        HttpClient client,
        Guid trackId,
        Guid artistId)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/credits",
            new
            {
                contributorArtistId = artistId,
                targetType = "track",
                targetId = trackId,
                roles = _mainArtistRoles
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static async Task MarkOriginalAsync(
        HttpClient client,
        Guid trackId,
        string title)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/tracks/{trackId:D}",
            new
            {
                title,
                isOriginal = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                credits = Array.Empty<object>(),
                releaseAppearances = Array.Empty<object>()
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task CreateRelationAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid targetTrackId,
        string type)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId, targetTrackId, type });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static async Task<JsonDocument> DiscoverAsync(
        HttpClient client,
        Guid sourceTrackId)
    {
        using HttpResponseMessage response = await client.GetAsync(
            $"/api/tracks/{sourceTrackId:D}/original-candidates/local");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync(response);
    }

    private static JsonElement FindCandidate(
        JsonDocument document,
        Guid localTrackId)
    {
        return document.RootElement.GetProperty("items")
            .EnumerateArray()
            .Single(item =>
                item.GetProperty("localTrackId").GetGuid() == localTrackId);
    }

    private static async Task<HttpResponseMessage> ConfirmAsync(
        HttpClient client,
        Guid sourceTrackId,
        JsonElement candidate)
    {
        return await client.PostAsJsonAsync(
            "/api/track-relations/stack",
            new
            {
                sourceTrackId,
                targetTrackId =
                    candidate.GetProperty("localTrackId").GetGuid(),
                type = candidate.GetProperty("suggestedRelationTypeCode")
                    .GetString(),
                markTargetAsOriginal =
                    candidate.GetProperty("requiresPromotion").GetBoolean()
            });
    }

    private static async Task<JsonDocument> ReadJsonAsync(
        HttpResponseMessage response)
    {
        return JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());
    }

    private static async Task<bool> IsOriginalAsync(
        HttpClient client,
        Guid trackId)
    {
        using HttpResponseMessage response = await client.GetAsync(
            $"/api/tracks/{trackId:D}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument document = await ReadJsonAsync(response);
        return document.RootElement.GetProperty("isOriginal").GetBoolean();
    }

    private static async Task<int> RelationCountAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync(
            "/api/track-relations");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument document = await ReadJsonAsync(response);
        return document.RootElement.GetProperty("total").GetInt32();
    }

    private static LocalOriginalCandidate Candidate(
        Guid id,
        string candidateKey,
        OriginalCandidateConfidence confidence,
        bool selectable,
        OriginalCandidateChronology chronology,
        IReadOnlyList<OriginalCandidateEvidence>? supporting = null,
        IReadOnlyList<OriginalCandidateEvidence>? contradictions = null,
        IReadOnlyList<OriginalCandidateEvidence>? missing = null)
    {
        return new LocalOriginalCandidate
        {
            CandidateKey = candidateKey,
            LocalTrackId = new TrackId(id),
            Title = $"Candidate {candidateKey}",
            ArtistDisplay = "Candidate Artist",
            Duration = TimeSpan.FromSeconds(245),
            VersionYear = chronology.LowerBound.Year,
            IsExistingRoot = confidence == OriginalCandidateConfidence.High,
            MemberCount =
                confidence == OriginalCandidateConfidence.High ? 2 : 0,
            RequiresPromotion =
                confidence != OriginalCandidateConfidence.High,
            SuggestedRelationTypeCode = "remixOf",
            RecordingSource = null,
            Ranked = new RankedOriginalCandidate
            {
                CandidateKey = candidateKey,
                Confidence = confidence,
                Selectable = selectable,
                CandidateChronology = chronology,
                SupportingEvidence = supporting ?? [],
                Contradictions = contradictions ?? [],
                MissingEvidence = missing ?? []
            }
        };
    }

    private static OriginalCandidateEvidence Evidence(
        OriginalCandidateEvidenceCode code,
        OriginalCandidateEvidenceKind kind,
        OriginalCandidateEvidenceChannel channel)
    {
        return new OriginalCandidateEvidence
        {
            Code = code,
            Kind = kind,
            Channel = channel
        };
    }

    private sealed class StubLocalOriginalCandidateService
        : ILocalOriginalCandidateService
    {
        private readonly LocalOriginalCandidateResult _result;

        public StubLocalOriginalCandidateService(
            LocalOriginalCandidateResult result)
        {
            _result = result;
        }

        public Task<LocalOriginalCandidateResult> FindAsync(
            CollectionId collectionId,
            TrackId sourceTrackId,
            CancellationToken cancellationToken)
        {
            _ = collectionId;
            _ = sourceTrackId;
            _ = cancellationToken;
            return Task.FromResult(_result);
        }
    }
}
