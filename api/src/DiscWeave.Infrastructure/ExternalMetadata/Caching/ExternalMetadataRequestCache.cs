using System.Collections.Concurrent;
using DiscWeave.Application.ExternalMetadata;
using Microsoft.Extensions.Caching.Memory;

namespace DiscWeave.Infrastructure.ExternalMetadata.Caching;

public sealed class ExternalMetadataRequestCache : IExternalMetadataRequestCache, IDisposable
{
    private const int MaximumConcurrentFetches = 64;
    private readonly IMemoryCache _completed;
    private readonly TimeProvider _timeProvider;
    private readonly SemaphoreSlim _admission = new(MaximumConcurrentFetches, MaximumConcurrentFetches);
    private readonly ConcurrentDictionary<CacheOperationKey, Lazy<Task<object>>> _inFlight = new();

    public ExternalMetadataRequestCache(IMemoryCache completed, TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(completed);
        ArgumentNullException.ThrowIfNull(timeProvider);

        _completed = completed;
        _timeProvider = timeProvider;
    }

    public async Task<ExternalMetadataResult<T>> GetOrCreateAsync<T>(
        ExternalMetadataCacheKey key,
        TimeSpan successTtl,
        TimeSpan negativeTtl,
        Func<CancellationToken, Task<ExternalMetadataResult<T>>> factory,
        CancellationToken cancellationToken,
        CancellationToken sharedWorkCancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(factory);
        ValidateTtl(successTtl, nameof(successTtl));
        ValidateTtl(negativeTtl, nameof(negativeTtl));

        CacheOperationKey operationKey = new(key, typeof(T));
        if (_completed.TryGetValue(operationKey, out ExternalMetadataResult<T>? completed))
        {
            return completed!;
        }

        Lazy<Task<object>>? created = null;
        created = new Lazy<Task<object>>(
            () => FetchAsync(
                operationKey,
                created!,
                successTtl,
                negativeTtl,
                factory,
                sharedWorkCancellationToken),
            LazyThreadSafetyMode.ExecutionAndPublication);
        Lazy<Task<object>> inFlight = _inFlight.GetOrAdd(operationKey, created);
        object result = await inFlight.Value.WaitAsync(cancellationToken).ConfigureAwait(false);
        return (ExternalMetadataResult<T>)result;
    }

    private async Task<object> FetchAsync<T>(
        CacheOperationKey operationKey,
        Lazy<Task<object>> owningOperation,
        TimeSpan successTtl,
        TimeSpan negativeTtl,
        Func<CancellationToken, Task<ExternalMetadataResult<T>>> factory,
        CancellationToken sharedWorkCancellationToken)
    {
        try
        {
            if (_completed.TryGetValue(operationKey, out ExternalMetadataResult<T>? completed))
            {
                return completed!;
            }

            await _admission.WaitAsync(sharedWorkCancellationToken).ConfigureAwait(false);
            try
            {
                ExternalMetadataResult<T> result = await factory(sharedWorkCancellationToken).ConfigureAwait(false);
                if (ShouldCache(result))
                {
                    TimeSpan ttl = result.IsSuccess ? successTtl : negativeTtl;
                    _ = _completed.Set(
                        operationKey,
                        result,
                        new MemoryCacheEntryOptions
                        {
                            AbsoluteExpiration = _timeProvider.GetUtcNow() + ttl,
                            Size = 1
                        });
                }

                return result;
            }
            finally
            {
                _ = _admission.Release();
            }
        }
        finally
        {
            _ = ((ICollection<KeyValuePair<CacheOperationKey, Lazy<Task<object>>>>)_inFlight)
                .Remove(new KeyValuePair<CacheOperationKey, Lazy<Task<object>>>(operationKey, owningOperation));
        }
    }

    private static bool ShouldCache<T>(ExternalMetadataResult<T> result)
    {
        return result.IsSuccess || result.Error.Kind == ExternalMetadataErrorKind.NotFound;
    }

    private static void ValidateTtl(TimeSpan ttl, string parameterName)
    {
        if (ttl <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(parameterName);
        }
    }

    public void Dispose()
    {
        _admission.Dispose();
    }

    private readonly record struct CacheOperationKey
    {
        public CacheOperationKey(ExternalMetadataCacheKey key, Type resultType)
        {
            Key = key;
            ResultType = resultType;
        }

        public ExternalMetadataCacheKey Key { get; }

        public Type ResultType { get; }
    }
}
