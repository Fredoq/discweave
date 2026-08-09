using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Features.Imports;

public sealed class ExternalReleaseProviderFailureException : Exception
{
    public ExternalReleaseProviderFailureException(ExternalProviderOperationStatus status)
        : base("External metadata provider failed")
    {
        ArgumentNullException.ThrowIfNull(status);
        Status = status;
    }

    public ExternalProviderOperationStatus Status { get; }
}
