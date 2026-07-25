using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Caching;

public interface IExternalMetadataRequestCache
{
    Task<ExternalMetadataResult<T>> GetOrCreateAsync<T>(
        ExternalMetadataCacheKey key,
        TimeSpan successTtl,
        TimeSpan negativeTtl,
        Func<CancellationToken, Task<ExternalMetadataResult<T>>> factory,
        CancellationToken cancellationToken);
}
