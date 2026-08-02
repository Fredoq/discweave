using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Application.Catalog;

public sealed class ExternalSourceLookupIdentity : IEquatable<ExternalSourceLookupIdentity>
{
    private ExternalSourceLookupIdentity(string providerCode, string resourceType, string externalId)
    {
        ProviderCode = providerCode;
        ResourceType = resourceType;
        ExternalId = externalId;
    }

    public string ProviderCode { get; }

    public string ResourceType { get; }

    public string ExternalId { get; }

    public static ExternalSourceLookupIdentity Create(
        string providerCode,
        string resourceType,
        string externalId)
    {
        return new ExternalSourceLookupIdentity(
            NormalizeCode(providerCode, nameof(providerCode)),
            NormalizeCode(resourceType, nameof(resourceType)),
            NormalizeExternalId(externalId));
    }

    public bool Equals(ExternalSourceLookupIdentity? other)
    {
        return other is not null &&
            string.Equals(ProviderCode, other.ProviderCode, StringComparison.Ordinal) &&
            string.Equals(ResourceType, other.ResourceType, StringComparison.Ordinal) &&
            string.Equals(ExternalId, other.ExternalId, StringComparison.Ordinal);
    }

    public override bool Equals(object? obj)
    {
        return obj is ExternalSourceLookupIdentity other && Equals(other);
    }

    public override int GetHashCode()
    {
        return HashCode.Combine(
            StringComparer.Ordinal.GetHashCode(ProviderCode),
            StringComparer.Ordinal.GetHashCode(ResourceType),
            StringComparer.Ordinal.GetHashCode(ExternalId));
    }

    private static string NormalizeCode(string value, string fieldName)
    {
        string normalized = value?.Trim().ToLowerInvariant() ?? string.Empty;
        return normalized.Length is > 0 and <= 32 &&
            normalized[0] is >= 'a' and <= 'z' &&
            normalized.All(character => character is >= 'a' and <= 'z' || char.IsAsciiDigit(character) || character == '-')
            ? normalized
            : throw new DomainException(
                "external_source.lookup_identity_invalid",
                $"{fieldName} must be a canonical provider code");
    }

    private static string NormalizeExternalId(string value)
    {
        string normalized = value?.Trim() ?? string.Empty;
        return normalized.Length > 0
            ? normalized
            : throw new DomainException(
                "external_source.lookup_identity_invalid",
                "External source lookup identity requires an external ID");
    }
}
