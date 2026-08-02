using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Catalog;

public sealed class ExternalSourceReference
{
    private ExternalSourceReference()
    {
        ProviderName = string.Empty;
        ResourceType = string.Empty;
        ExternalId = string.Empty;
        SourceUrl = string.Empty;
    }

    private ExternalSourceReference(
        string providerName,
        string resourceType,
        string externalId,
        string sourceUrl,
        DateTimeOffset appliedAt)
    {
        ProviderName = ValidateCode(providerName, nameof(providerName), "external_source.provider_name_required");
        ResourceType = ValidateCode(resourceType, nameof(resourceType), "external_source.resource_type_required");
        ExternalId = ValidateRequired(externalId, nameof(externalId), "external_source.external_id_required");
        SourceUrl = ValidateSourceUrl(sourceUrl);
        AppliedAt = appliedAt;
    }

    public string ProviderName { get; private set; }

    public string ResourceType { get; private set; }

    public string ExternalId { get; private set; }

    public string SourceUrl { get; private set; }

    public DateTimeOffset AppliedAt { get; private set; }

    public static ExternalSourceReference Create(
        string providerName,
        string resourceType,
        string externalId,
        string sourceUrl,
        DateTimeOffset appliedAt)
    {
        return new ExternalSourceReference(providerName, resourceType, externalId, sourceUrl, appliedAt);
    }

    internal bool HasSameIdentity(ExternalSourceReference other)
    {
        ArgumentNullException.ThrowIfNull(other);

        return string.Equals(ProviderName, other.ProviderName, StringComparison.Ordinal) &&
            string.Equals(ResourceType, other.ResourceType, StringComparison.Ordinal) &&
            string.Equals(ExternalId, other.ExternalId, StringComparison.Ordinal);
    }

    internal void ApplyAuthoritativeMetadataFrom(ExternalSourceReference authoritativeSource)
    {
        ArgumentNullException.ThrowIfNull(authoritativeSource);
        if (!HasSameIdentity(authoritativeSource))
        {
            throw new DomainException(
                "external_source.identity_mismatch",
                "Authoritative external source identity does not match the existing reference");
        }

        if (authoritativeSource.AppliedAt >= AppliedAt)
        {
            SourceUrl = authoritativeSource.SourceUrl;
            AppliedAt = authoritativeSource.AppliedAt;
        }
    }

    private static string ValidateRequired(string value, string fieldName, string code)
    {
        return Guard.RequiredText(value, fieldName, code);
    }

    private static string ValidateCode(string value, string fieldName, string code)
    {
        string normalized = Guard.RequiredText(value, fieldName, code).ToLowerInvariant();
        return normalized.Length is > 0 and <= 32 &&
            normalized[0] is >= 'a' and <= 'z' &&
            normalized.All(character => character is >= 'a' and <= 'z' || char.IsAsciiDigit(character) || character == '-')
            ? normalized
            : throw new DomainException(code, $"{fieldName} must be a canonical code");
    }

    private static string ValidateSourceUrl(string sourceUrl)
    {
        string trimmed = Guard.RequiredText(sourceUrl, nameof(sourceUrl), "external_source.source_url_required");
        return Uri.TryCreate(trimmed, UriKind.Absolute, out Uri? uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? trimmed
            : throw new DomainException("external_source.source_url_invalid", "External source URL must be an absolute HTTP URL");
    }
}
