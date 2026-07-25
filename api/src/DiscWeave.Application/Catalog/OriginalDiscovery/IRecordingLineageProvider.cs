using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public interface IRecordingLineageProvider
{
    string ProviderCode { get; }

    Task<ExternalMetadataResult<RecordingLineageResult>> FindOriginalsAsync(
        RecordingLineageQuery query,
        CancellationToken cancellationToken);
}
