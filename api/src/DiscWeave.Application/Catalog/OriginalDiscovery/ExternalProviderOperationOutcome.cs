namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public enum ExternalProviderOperationOutcome
{
    Succeeded,
    NotFound,
    Disabled,
    NotConfigured,
    Unauthorized,
    UnknownProvider,
    UnsupportedCapability,
    RateLimited,
    Timeout,
    Unavailable,
    InvalidResponse
}
