namespace DiscWeave.Api.Features.Imports;

public sealed record ExternalDiscogsReleaseAttachRequest(
    string ReleaseId,
    long ExpectedReviewRevision);
