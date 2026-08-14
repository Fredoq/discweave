using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using Microsoft.Extensions.Logging;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private async Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseDetailCoreAsync(
        string mbid,
        ExternalMetadataRequestFreshness freshness,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        ExternalMetadataCacheKey key = MbidKey("release-detail", mbid);
        return freshness == ExternalMetadataRequestFreshness.Authoritative
            ? await FetchReleaseDetailAsync(mbid, context).ConfigureAwait(false)
            : await GetOrCreateWithOperationAsync(
                key,
                DetailTtl,
                NotFoundTtl,
                _ => FetchReleaseDetailAsync(mbid, context),
                context,
                cancellationToken).ConfigureAwait(false);
    }

    private async Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> FetchReleaseDetailAsync(
        string mbid,
        MusicBrainzOperationContext context)
    {
        ExternalMetadataResult<ReleaseDto> raw = await SendAsync<ReleaseDto>(
            ReleaseDetailPath(mbid),
            context).ConfigureAwait(false);
        return !raw.IsSuccess
            ? Failure<ExternalMetadataReleaseDetail>(raw.Error)
            : TryMapReleaseDetail(raw.Value, mbid, out ExternalMetadataReleaseDetail mapped) // NOSONAR: provider mapping keeps invalid and transport failures distinct.
            ? new ExternalMetadataResult<ExternalMetadataReleaseDetail>(mapped)
            : Failure<ExternalMetadataReleaseDetail>(InvalidResponse());
    }

    private async Task<ExternalMetadataResult<ReleasePageResponse>> GetReleasePageCoreAsync(
        string recordingMbid,
        int offset,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        var key = ExternalMetadataCacheKey.Create(
            ProviderCodeValue,
            "release-browse",
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["recording"] = recordingMbid,
                ["limit"] = "100",
                ["offset"] = offset.ToString(System.Globalization.CultureInfo.InvariantCulture)
            });
        return await GetOrCreateWithOperationAsync(
            key,
            SearchTtl,
            SearchTtl,
            _ => SendAsync<ReleasePageResponse>(
                ReleaseBrowsePath(recordingMbid, offset),
                context),
            context,
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<ExternalMetadataResult<ReleasePageResponse>> GetReleaseGroupPageCoreAsync(
        string releaseGroupMbid,
        int offset,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        var key = ExternalMetadataCacheKey.Create(
            ProviderCodeValue,
            "release-group-browse",
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["release-group"] = releaseGroupMbid,
                ["limit"] = "100",
                ["offset"] = offset.ToString(System.Globalization.CultureInfo.InvariantCulture)
            });
        return await GetOrCreateWithOperationAsync(
            key,
            SearchTtl,
            SearchTtl,
            _ => SendAsync<ReleasePageResponse>(
                ReleaseGroupBrowsePath(releaseGroupMbid, offset),
                context),
            context,
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<ExternalMetadataResult<ReleaseGroupDetailOutcome>> GetReleaseGroupDetailCoreAsync(
        string mbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        ExternalMetadataCacheKey key = MbidKey("release-group-detail", mbid);
        return await GetOrCreateWithOperationAsync(
            key,
            DetailTtl,
            NotFoundTtl,
            async _ =>
            {
                ExternalMetadataResult<ReleaseGroupDto> raw = await SendAsync<ReleaseGroupDto>(
                    ReleaseGroupDetailPath(mbid),
                    context).ConfigureAwait(false);
                return !raw.IsSuccess
                    ? Failure<ReleaseGroupDetailOutcome>(raw.Error)
                    : TryMapReleaseGroupDetail(raw.Value, mbid, out ReleaseGroupDetailOutcome mapped) // NOSONAR: provider result mapping keeps failure and invalid-response branches explicit.
                    ? new ExternalMetadataResult<ReleaseGroupDetailOutcome>(mapped)
                    : Failure<ReleaseGroupDetailOutcome>(InvalidResponse());
            },
            context,
            cancellationToken).ConfigureAwait(false);
    }

    internal Task<ExternalMetadataResult<ReleaseGroupSearchOutcome>> SearchReleaseGroupsAsync(
        string query,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return SearchReleaseGroupsCoreAsync(query, context, cancellationToken);
    }

    private async Task<ExternalMetadataResult<ReleaseGroupSearchOutcome>> SearchReleaseGroupsCoreAsync(
        string query,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        var key = ExternalMetadataCacheKey.Create(
            ProviderCodeValue,
            "release-group-search",
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["query"] = query,
                ["limit"] = _options.MaxReleaseGroupSearchCandidates.ToString(
                    System.Globalization.CultureInfo.InvariantCulture),
                ["offset"] = "0"
            });
        ExternalMetadataResult<ReleaseGroupSearchResponse> response = await GetOrCreateWithOperationAsync(
            key,
            SearchTtl,
            NotFoundTtl,
            _ => SendAsync<ReleaseGroupSearchResponse>(
                ReleaseGroupSearchPath(query, _options.MaxReleaseGroupSearchCandidates),
                context),
            context,
            cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccess)
        {
            return Failure<ReleaseGroupSearchOutcome>(response.Error);
        }

        ReleaseGroupHypothesis[] groups =
        [
            .. (response.Value.ReleaseGroups ?? [])
                .Where(group =>
                    TryNormalizeMbid(group.Id, out _) &&
                    !string.IsNullOrWhiteSpace(group.Title))
                .Select(group => new ReleaseGroupHypothesis(
                    NormalizeRequiredMbid(group.Id!), // NOSONAR: the preceding predicate validates the MBID.
                    group.Title!.Trim(), // NOSONAR: the preceding predicate validates the title.
                    100))
                .Take(_options.MaxReleaseGroupSearchCandidates)
        ];
        return new ExternalMetadataResult<ReleaseGroupSearchOutcome>(
            new ReleaseGroupSearchOutcome(groups, response.Value.Count ?? groups.Length));
    }

    private async Task<ExternalMetadataResult<T>> ExecuteOwnedAsync<T>(
        string operationName,
        Func<T, int> resultCount,
        Func<MusicBrainzOperationContext, Task<ExternalMetadataResult<T>>> operation,
        CancellationToken cancellationToken)
    {
        long startedTimestamp = _timeProvider.GetTimestamp();
        MusicBrainzOperationContext context = CreateOperationContext();
        Task<ExternalMetadataResult<T>> ownedOperation = CompleteOwnedAsync(context, operation(context));
        try
        {
            ExternalMetadataResult<T> result =
                await ownedOperation.WaitAsync(cancellationToken).ConfigureAwait(false);
            LogOperationCompleted(
                operationName,
                ResultStatus(result),
                result.IsSuccess ? resultCount(result.Value) : 0,
                startedTimestamp);
            return result;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            ExternalMetadataResult<T> result = Failure<T>(Timeout());
            LogOperationCompleted(operationName, ResultStatus(result), 0, startedTimestamp);
            return result;
        }
        catch (OperationCanceledException)
        {
            LogOperationCompleted(operationName, "cancelled", 0, startedTimestamp);
            throw;
        }
    }

    private static string ResultStatus<T>(ExternalMetadataResult<T> result)
    {
        return result.IsSuccess
            ? "success"
            : result.Error?.Kind.ToString() ?? "unknown";
    }

    private void LogOperationCompleted(
        string operation,
        string status,
        int resultCount,
        long startedTimestamp)
    {
        double durationMilliseconds = _timeProvider.GetElapsedTime(startedTimestamp).TotalMilliseconds;
        OperationCompleted(
            _logger,
            ProviderCodeValue,
            operation,
            status,
            durationMilliseconds,
            resultCount);
    }

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "External metadata operation completed. ProviderCode: {ProviderCode}; Operation: {Operation}; Status: {Status}; DurationMilliseconds: {DurationMilliseconds}; ResultCount: {ResultCount}")]
    private static partial void OperationCompleted(
        ILogger logger,
        string providerCode,
        string operation,
        string status,
        double durationMilliseconds,
        int resultCount);

}
