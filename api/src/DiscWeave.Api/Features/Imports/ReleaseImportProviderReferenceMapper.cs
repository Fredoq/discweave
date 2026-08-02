using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Api.Features.Imports;

internal static class ReleaseImportProviderReferenceMapper
{
    internal static IReadOnlyList<ReleaseImportProviderReference> ToDomain(
        IReadOnlyList<ReleaseImportProviderReferenceRequest>? sources)
    {
        return sources is null
            ? []
            : [.. sources.Select(source => ReleaseImportProviderReference.Create(
                source.ProviderCode,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl))];
    }

    internal static IReadOnlyList<ReleaseImportProviderReferenceResponse> ToResponses(
        IReadOnlyList<ReleaseImportProviderReference> sources)
    {
        return
        [
            .. CanonicalOrder(sources).Select(source => new ReleaseImportProviderReferenceResponse
            {
                ProviderCode = source.ProviderCode,
                ResourceType = source.ResourceType,
                ExternalId = source.ExternalId,
                SourceUrl = source.SourceUrl
            })
        ];
    }

    internal static void EnsureEqualEcho(
        IReadOnlyList<ReleaseImportProviderReferenceRequest>? echoedSources,
        IReadOnlyList<ReleaseImportProviderReference> persistedSources)
    {
        if (echoedSources is null)
        {
            throw ReadOnlyException();
        }

        ReleaseImportProviderReference[] echoed;
        try
        {
            echoed = [.. ToDomain(echoedSources)];
        }
        catch (DomainException)
        {
            throw ReadOnlyException();
        }

        ReleaseImportProviderReference[] orderedEcho = [.. CanonicalOrder(echoed)];
        ReleaseImportProviderReference[] orderedPersisted = [.. CanonicalOrder(persistedSources)];
        if (orderedEcho.Length != orderedPersisted.Length ||
            orderedEcho.Where((source, index) => !HasSameValue(source, orderedPersisted[index])).Any())
        {
            throw ReadOnlyException();
        }
    }

    private static bool HasSameValue(
        ReleaseImportProviderReference left,
        ReleaseImportProviderReference right)
    {
        return left.ProviderCode == right.ProviderCode &&
            left.ResourceType == right.ResourceType &&
            left.ExternalId == right.ExternalId &&
            left.SourceUrl == right.SourceUrl;
    }

    private static IOrderedEnumerable<ReleaseImportProviderReference> CanonicalOrder(
        IEnumerable<ReleaseImportProviderReference> sources)
    {
        return sources
            .OrderBy(source => source.ProviderCode, StringComparer.Ordinal)
            .ThenBy(source => source.ResourceType, StringComparer.Ordinal)
            .ThenBy(source => source.ExternalId, StringComparer.Ordinal)
            .ThenBy(source => source.SourceUrl, StringComparer.Ordinal);
    }

    private static DomainException ReadOnlyException()
    {
        return new DomainException(
            "import.external_sources_read_only",
            "External import provenance is read-only");
    }
}
