using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata;

public sealed class ExternalMetadataProviderResolver : IExternalMetadataProviderResolver
{
    private readonly Dictionary<string, IExternalMetadataProvider> _providers;

    public ExternalMetadataProviderResolver(IEnumerable<IExternalMetadataProvider> providers)
    {
        ArgumentNullException.ThrowIfNull(providers);

        Dictionary<string, IExternalMetadataProvider> providerByCode = new(StringComparer.Ordinal);
        foreach (IExternalMetadataProvider provider in providers)
        {
            ArgumentNullException.ThrowIfNull(provider);
            ValidateProviderCode(provider.ProviderCode);
            if (!providerByCode.TryAdd(provider.ProviderCode, provider))
            {
                throw new InvalidOperationException($"Duplicate external metadata provider code '{provider.ProviderCode}'.");
            }
        }

        _providers = providerByCode;
        ProviderCodes = Array.AsReadOnly([.. providerByCode.Keys.OrderBy(code => code, StringComparer.Ordinal)]);
    }

    public IReadOnlyCollection<string> ProviderCodes { get; }

    public ExternalMetadataResult<IExternalMetadataProvider> Resolve(string providerCode)
    {
        string? normalizedProviderCode = NormalizeCallerProviderCode(providerCode);
        return normalizedProviderCode is not null &&
            _providers.TryGetValue(normalizedProviderCode, out IExternalMetadataProvider? provider)
            ? new ExternalMetadataResult<IExternalMetadataProvider>(provider)
            : new ExternalMetadataResult<IExternalMetadataProvider>(UnknownProvider());
    }

    public ExternalMetadataResult<TCapability> ResolveCapability<TCapability>(string providerCode)
        where TCapability : class
    {
        ExternalMetadataResult<IExternalMetadataProvider> providerResult = Resolve(providerCode);
        return providerResult.IsSuccess
            ? MapCapability<TCapability>(providerResult.Value)
            : new ExternalMetadataResult<TCapability>(providerResult.Error);
    }

    private static ExternalMetadataResult<TCapability> MapCapability<TCapability>(IExternalMetadataProvider provider)
        where TCapability : class
    {
        return provider is TCapability capability
            ? new ExternalMetadataResult<TCapability>(capability)
            : new ExternalMetadataResult<TCapability>(UnsupportedCapability());
    }

    private static void ValidateProviderCode(string? providerCode)
    {
        if (string.IsNullOrEmpty(providerCode) || !IsCanonicalProviderCode(providerCode))
        {
            throw new ArgumentException(
                "External metadata provider codes must be canonical lowercase identifiers.",
                nameof(providerCode));
        }
    }

    private static string? NormalizeCallerProviderCode(string? providerCode)
    {
        if (string.IsNullOrWhiteSpace(providerCode))
        {
            return null;
        }

        string normalized = providerCode.Trim().ToLowerInvariant();
        return IsCanonicalProviderCode(normalized) ? normalized : null;
    }

    private static bool IsCanonicalProviderCode(string providerCode)
    {
        if (providerCode.Length is < 1 or > 32 || !IsLowercaseLetter(providerCode[0]))
        {
            return false;
        }

        foreach (char character in providerCode.Skip(1))
        {
            if (!IsLowercaseLetter(character) && !char.IsAsciiDigit(character) && character != '-')
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsLowercaseLetter(char character)
    {
        return character is >= 'a' and <= 'z';
    }

    private static ExternalMetadataError UnknownProvider()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.UnknownProvider,
            "external_metadata.unknown_provider",
            "External metadata provider is not registered");
    }

    private static ExternalMetadataError UnsupportedCapability()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.UnsupportedCapability,
            "external_metadata.unsupported_capability",
            "External metadata provider does not support this operation");
    }
}
