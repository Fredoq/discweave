using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private async Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseDetailCoreAsync(
        string mbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        ExternalMetadataCacheKey key = MbidKey("release-detail", mbid);
        return await _cache.GetOrCreateAsync(
            key,
            DetailTtl,
            NotFoundTtl,
            async _ =>
            {
                ExternalMetadataResult<ReleaseDto> raw = await SendAsync<ReleaseDto>(
                    ReleaseDetailPath(mbid),
                    context).ConfigureAwait(false);
                return raw.IsSuccess && TryMapReleaseDetail(raw.Value, mbid, out ExternalMetadataReleaseDetail mapped)
                    ? new ExternalMetadataResult<ExternalMetadataReleaseDetail>(mapped)
                    : raw.IsSuccess
                        ? Failure<ExternalMetadataReleaseDetail>(InvalidResponse())
                        : Failure<ExternalMetadataReleaseDetail>(raw.Error);
            },
            cancellationToken).ConfigureAwait(false);
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
        return await _cache.GetOrCreateAsync(
            key,
            SearchTtl,
            SearchTtl,
            _ => SendAsync<ReleasePageResponse>(
                ReleaseBrowsePath(recordingMbid, offset),
                context),
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<ExternalMetadataResult<ReleaseGroupDetailOutcome>> GetReleaseGroupDetailCoreAsync(
        string mbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        ExternalMetadataCacheKey key = MbidKey("release-group-detail", mbid);
        return await _cache.GetOrCreateAsync(
            key,
            DetailTtl,
            NotFoundTtl,
            async _ =>
            {
                ExternalMetadataResult<ReleaseGroupDto> raw = await SendAsync<ReleaseGroupDto>(
                    ReleaseGroupDetailPath(mbid),
                    context).ConfigureAwait(false);
                return raw.IsSuccess &&
                    TryMapReleaseGroupDetail(raw.Value, mbid, out ReleaseGroupDetailOutcome mapped)
                        ? new ExternalMetadataResult<ReleaseGroupDetailOutcome>(mapped)
                        : raw.IsSuccess
                            ? Failure<ReleaseGroupDetailOutcome>(InvalidResponse())
                            : Failure<ReleaseGroupDetailOutcome>(raw.Error);
            },
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<ExternalMetadataResult<T>> ExecuteOwnedAsync<T>(
        Func<MusicBrainzOperationContext, Task<ExternalMetadataResult<T>>> operation,
        CancellationToken cancellationToken)
    {
        MusicBrainzOperationContext context = CreateOperationContext();
        Task<ExternalMetadataResult<T>> ownedOperation = CompleteOwnedAsync(context, operation(context));
        return await ownedOperation.WaitAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task<ExternalMetadataResult<T>> CompleteOwnedAsync<T>(
        MusicBrainzOperationContext context,
        Task<ExternalMetadataResult<T>> operation)
    {
        try
        {
            return await operation.ConfigureAwait(false);
        }
        finally
        {
            context.Dispose();
        }
    }

    private Task<ExternalMetadataResult<T>> UnsupportedAsync<T>(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ExternalMetadataError error = _options.Enabled ? UnsupportedCapability() : Disabled();
        return Task.FromResult(Failure<T>(error));
    }

    private static ExternalMetadataCacheKey MbidKey(string operation, string mbid)
    {
        return ExternalMetadataCacheKey.Create(
            ProviderCodeValue,
            operation,
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["mbid"] = mbid
            });
    }

    private static ExternalMetadataResult<T> Failure<T>(ExternalMetadataError error)
    {
        return new ExternalMetadataResult<T>(error);
    }
}
