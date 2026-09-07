using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record DiscogsOriginalCandidate(
    ExternalMetadataReleaseDetail Release,
    int RowOrdinal,
    string Fingerprint,
    string? SuggestedRelationTypeCode);
