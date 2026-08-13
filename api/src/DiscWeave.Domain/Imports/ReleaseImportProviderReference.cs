using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportProviderReference
{
    private ReleaseImportProviderReference()
    {
    }

    private ReleaseImportProviderReference(
        string providerCode,
        string resourceType,
        string externalId,
        string sourceUrl)
    {
        ProviderCode = providerCode;
        ResourceType = resourceType;
        ExternalId = externalId;
        SourceUrl = sourceUrl;
    }

    public string ProviderCode { get; private init; } = string.Empty;

    public string ResourceType { get; private init; } = string.Empty;

    public string ExternalId { get; private init; } = string.Empty;

    public string SourceUrl { get; private init; } = string.Empty;

    public static ReleaseImportProviderReference Create(
        string providerCode,
        string resourceType,
        string externalId,
        string sourceUrl)
    {
        return new ReleaseImportProviderReference(
            NormalizeCode(providerCode, nameof(providerCode), "release_import.provider_code_invalid"),
            NormalizeCode(resourceType, nameof(resourceType), "release_import.provider_resource_type_invalid"),
            NormalizeExternalId(externalId),
            NormalizeSourceUrl(sourceUrl));
    }

    internal bool HasSameValueAs(ReleaseImportProviderReference other)
    {
        return other is not null &&
            ProviderCode == other.ProviderCode &&
            ResourceType == other.ResourceType &&
            ExternalId == other.ExternalId &&
            SourceUrl == other.SourceUrl;
    }

    private static string NormalizeCode(string value, string fieldName, string code)
    {
        string normalized = Guard.RequiredText(value, fieldName, code).ToLowerInvariant();
        return normalized.Length <= 32 &&
            normalized[0] is >= 'a' and <= 'z' &&
            normalized.All(character =>
                character is >= 'a' and <= 'z' || char.IsAsciiDigit(character) || character == '-')
            ? normalized
            : throw new DomainException(code, $"{fieldName} must be a canonical code");
    }

    private static string NormalizeExternalId(string externalId)
    {
        string normalized = Guard.RequiredText(
            externalId,
            nameof(externalId),
            "release_import.provider_external_id_required");
        string? guidExternalId = Guid.TryParse(normalized, out Guid guid)
            ? guid.ToString("D")
            : null;
        return guidExternalId ??
            (long.TryParse(normalized, out long numericId) && numericId > 0
                ? numericId.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : normalized);
    }

    private static string NormalizeSourceUrl(string sourceUrl)
    {
        string normalized = Guard.RequiredText(
            sourceUrl,
            nameof(sourceUrl),
            "release_import.provider_source_url_invalid");
        return Uri.TryCreate(normalized, UriKind.Absolute, out Uri? uri) &&
            uri.Scheme == Uri.UriSchemeHttps &&
            !string.IsNullOrWhiteSpace(uri.Host)
            ? uri.AbsoluteUri
            : throw new DomainException(
                "release_import.provider_source_url_invalid",
                "Provider source URL must be an absolute HTTPS URL");
    }
}
