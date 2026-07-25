using System.Text.Json.Nodes;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Fact]
    public async Task Page_deadline_preserves_completed_page_as_partial_browse()
    {
        var timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);
        using var cache = new SharedRequestCache(timeProvider);
        TaskCompletionSource secondPageStarted = NewSignal();
        var handler = new CapturingHandler(async (request, cancellationToken) =>
        {
            if (request.RequestUri!.PathAndQuery.Contains("offset=0", StringComparison.Ordinal))
            {
                return JsonResponse(ReadFixture("release-page-1.json"));
            }

            _ = secondPageStarted.TrySetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            throw new InvalidOperationException("The cancelled page request must not resume.");
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxReleaseGroupLookups: 0, operationTimeoutSeconds: 10),
            timeProvider,
            new ImmediateRequestGate(),
            cache.Cache);

        Task<ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome>> operation =
            harness.Provider.BrowseReleasesAsync(
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                CancellationToken.None);
        await secondPageStarted.Task.WaitAsync(TimeSpan.FromSeconds(2));
        timeProvider.Advance(TimeSpan.FromSeconds(10));

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result;
        try
        {
            result = await operation.WaitAsync(TimeSpan.FromSeconds(2));
        }
        finally
        {
            await ConfirmAllCacheAdmissionsReleasedAsync(cache.Cache, "page-deadline");
        }

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Releases.Count);
        Assert.False(result.Value.ChronologyComplete);
        Assert.Contains("musicbrainz.operation_budget_exhausted", result.Value.Warnings);
    }

    [Fact]
    public async Task Release_group_deadline_preserves_routes_and_group_warning_without_chronology_loss()
    {
        var timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);
        using var cache = new SharedRequestCache(timeProvider);
        TaskCompletionSource groupRequestStarted = NewSignal();
        string page = SingleValidReleasePage();
        var handler = new CapturingHandler(async (request, cancellationToken) =>
        {
            if (request.RequestUri!.AbsolutePath == "/ws/2/release")
            {
                return JsonResponse(page);
            }

            _ = groupRequestStarted.TrySetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            throw new InvalidOperationException("The cancelled group request must not resume.");
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxReleaseGroupLookups: 1, operationTimeoutSeconds: 10),
            timeProvider,
            new ImmediateRequestGate(),
            cache.Cache);

        Task<ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome>> operation =
            harness.Provider.BrowseReleasesAsync(
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                CancellationToken.None);
        await groupRequestStarted.Task.WaitAsync(TimeSpan.FromSeconds(2));
        timeProvider.Advance(TimeSpan.FromSeconds(10));

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result;
        try
        {
            result = await operation.WaitAsync(TimeSpan.FromSeconds(2));
        }
        finally
        {
            await ConfirmAllCacheAdmissionsReleasedAsync(cache.Cache, "group-deadline");
        }

        Assert.True(result.IsSuccess);
        _ = Assert.Single(result.Value.Releases);
        Assert.True(result.Value.ChronologyComplete);
        Assert.False(result.Value.ReleaseGroupContextComplete);
        Assert.Contains("musicbrainz.release_group_context_incomplete", result.Value.Warnings);
        Assert.Contains("musicbrainz.operation_budget_exhausted", result.Value.Warnings);
    }

    private static async Task ConfirmAllCacheAdmissionsReleasedAsync(
        ExternalMetadataRequestCache cache,
        string keyPrefix)
    {
        TaskCompletionSource allAdmitted = NewSignal();
        TaskCompletionSource release = NewSignal();
        int admitted = 0;
        List<Task<ExternalMetadataResult<string>>> occupants = [];

        for (int index = 0; index < 64; index++)
        {
            int current = index;
            occupants.Add(cache.GetOrCreateAsync(
                SharedRequestCache.Key($"{keyPrefix}-{current}"),
                TimeSpan.FromMinutes(1),
                TimeSpan.FromMinutes(1),
                HoldAdmissionAsync,
                CancellationToken.None));
        }

        try
        {
            await allAdmitted.Task.WaitAsync(TimeSpan.FromSeconds(2));
        }
        finally
        {
            _ = release.TrySetResult();
            _ = await Task.WhenAll(occupants).WaitAsync(TimeSpan.FromSeconds(2));
        }

        async Task<ExternalMetadataResult<string>> HoldAdmissionAsync(CancellationToken cancellationToken)
        {
            if (Interlocked.Increment(ref admitted) == 64)
            {
                _ = allAdmitted.TrySetResult();
            }

            await release.Task.WaitAsync(cancellationToken);
            return new ExternalMetadataResult<string>("released");
        }
    }

    private static string SingleValidReleasePage()
    {
        var source = (JsonObject)JsonNode.Parse(ReadFixture("release-page-1.json"))!;
        JsonNode release = source["releases"]!.AsArray()[0]!.DeepClone();
        return new JsonObject
        {
            ["release-count"] = 1,
            ["release-offset"] = 0,
            ["releases"] = new JsonArray(release)
        }.ToJsonString();
    }
}
