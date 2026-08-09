using System.Security.Cryptography;
using System.Text;

namespace DiscWeave.Infrastructure.ExternalMetadata.Caching;

public readonly record struct ExternalMetadataCacheKey
{
    private static readonly HashSet<string> ReservedArgumentNames =
    [
        "token", "authorization", "collectionid", "userid", "path", "ownership", "note",
        "accesstoken", "apikey", "secret", "password", "credential"
    ];

    private ExternalMetadataCacheKey(string providerCode, string operation, string publicArgumentsHash)
    {
        ProviderCode = providerCode;
        Operation = operation;
        PublicArgumentsHash = publicArgumentsHash;
    }

    public string ProviderCode { get; }

    public string Operation { get; }

    public string PublicArgumentsHash { get; }

    public static ExternalMetadataCacheKey Create(
        string providerCode,
        string operation,
        IReadOnlyDictionary<string, string> normalizedPublicArguments)
    {
        ArgumentNullException.ThrowIfNull(normalizedPublicArguments);

        string normalizedProviderCode = NormalizeIdentifier(providerCode, nameof(providerCode));
        string normalizedOperation = NormalizeIdentifier(operation, nameof(operation));
        KeyValuePair<string, string>[] arguments =
        [.. normalizedPublicArguments
            .Select(NormalizeArgument)
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)];

        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach ((string name, string value) in arguments)
        {
            AppendLengthPrefixed(hash, name);
            AppendLengthPrefixed(hash, value);
        }

        return new ExternalMetadataCacheKey(
            normalizedProviderCode,
            normalizedOperation,
            Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant());
    }

    private static KeyValuePair<string, string> NormalizeArgument(KeyValuePair<string, string> argument)
    {
        if (string.IsNullOrWhiteSpace(argument.Key))
        {
            throw new ArgumentException("Public argument names must not be blank.", nameof(argument));
        }

        string name = argument.Key.Trim();
        return (ReservedArgumentNames.Contains(name.ToLowerInvariant()), argument.Value) switch
        {
            (true, _) => throw new ArgumentException("A private argument name cannot be cached.", nameof(argument)), // NOSONAR: tuple pattern keeps validation branches explicit.
            (_, null) => throw new ArgumentException("Public argument values must not be null.", nameof(argument)),
            (_, string value) => new KeyValuePair<string, string>(name, value)
        };
    }

    private static string NormalizeIdentifier(string value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("An identifier must not be blank.", parameterName);
        }

        string normalized = value.Trim().ToLowerInvariant();
        return normalized.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '.' or '_')
            ? normalized
            : throw new ArgumentException("An identifier contains unsupported characters.", parameterName);
    }

    private static void AppendLengthPrefixed(IncrementalHash hash, string value)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(value);
        hash.AppendData(BitConverter.GetBytes(bytes.Length));
        hash.AppendData(bytes);
    }
}
