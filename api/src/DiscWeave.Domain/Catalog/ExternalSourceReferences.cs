using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Domain.Catalog;

internal static class ExternalSourceReferences
{
    public static void Replace(
        List<ExternalSourceReference> current,
        IReadOnlyList<ExternalSourceReference> replacement)
    {
        ArgumentNullException.ThrowIfNull(current);
        ArgumentNullException.ThrowIfNull(replacement);

        ExternalSourceReference[] replacementSnapshot = [.. replacement];
        for (int index = 0; index < replacementSnapshot.Length; index++)
        {
            ExternalSourceReference source = replacementSnapshot[index] ?? throw new DomainException(
                "external_source.required",
                "External source reference is required");

            if (replacementSnapshot.Take(index).Any(source.HasSameIdentity))
            {
                throw new DomainException("external_source.duplicate", "External source reference already exists");
            }
        }

        current.Clear();
        current.AddRange(replacementSnapshot);
    }

    public static void Union(
        List<ExternalSourceReference> current,
        IReadOnlyCollection<ExternalSourceReference> authoritativeSources)
    {
        ArgumentNullException.ThrowIfNull(current);
        ArgumentNullException.ThrowIfNull(authoritativeSources);

        ExternalSourceReference[] incoming = [.. authoritativeSources];
        for (int index = 0; index < incoming.Length; index++)
        {
            ExternalSourceReference source = incoming[index] ?? throw new DomainException(
                "external_source.required",
                "External source reference is required");
            if (incoming.Take(index).Any(source.HasSameIdentity))
            {
                throw new DomainException("external_source.duplicate", "External source reference already exists");
            }
        }

        List<ExternalSourceReference> next = [.. current];
        foreach (ExternalSourceReference authoritativeSource in incoming)
        {
            ExternalSourceReference? existing = next.FirstOrDefault(
                source => source.HasSameIdentity(authoritativeSource));
            if (existing is null)
            {
                next.Add(authoritativeSource);
            }
            else
            {
                existing.ApplyAuthoritativeMetadataFrom(authoritativeSource);
            }
        }

        current.Clear();
        current.AddRange(next);
    }
}
