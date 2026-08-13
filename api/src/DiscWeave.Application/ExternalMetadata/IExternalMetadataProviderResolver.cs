namespace DiscWeave.Application.ExternalMetadata;

public interface IExternalMetadataProviderResolver
{
    IReadOnlyCollection<string> ProviderCodes { get; }

    ExternalMetadataResult<IExternalMetadataProvider> Resolve(string providerCode);

    ExternalMetadataResult<TCapability> ResolveCapability<TCapability>(string providerCode)
        where TCapability : class;
}
