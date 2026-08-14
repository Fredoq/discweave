using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
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

    private async Task<ExternalMetadataResult<T>> GetOrCreateWithOperationAsync<T>(
        ExternalMetadataCacheKey key,
        TimeSpan successTtl,
        TimeSpan negativeTtl,
        Func<CancellationToken, Task<ExternalMetadataResult<T>>> factory,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        using CancellationTokenSource? linkedWait = cancellationToken.CanBeCanceled
            ? CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, context.DeadlineToken)
            : null;
        CancellationToken waitToken = linkedWait?.Token ?? context.DeadlineToken;
        try
        {
            waitToken.ThrowIfCancellationRequested();
            return await _cache.GetOrCreateAsync(
                key,
                successTtl,
                negativeTtl,
                factory,
                waitToken,
                context.DeadlineToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (
            !cancellationToken.IsCancellationRequested &&
            context.DeadlineToken.IsCancellationRequested)
        {
            return Failure<T>(Timeout());
        }
    }
}
