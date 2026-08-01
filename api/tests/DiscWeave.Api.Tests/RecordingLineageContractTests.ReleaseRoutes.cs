using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class RecordingLineageContractTests
{
    [Fact]
    public void External_release_route_contract_separates_candidate_and_batch_state()
    {
        ExternalMetadataSource recordingSource = Source(
            "recording",
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var retryContext = new DiscogsRouteRetryContext
        {
            RecordingSource = recordingSource,
            Items = []
        };
        var candidate = new ExternalReleaseCandidateRouteResolution
        {
            RecordingSource = recordingSource,
            Routes = [],
            DiscogsStatus = new ExternalProviderOperationStatus
            {
                ProviderCode = "discogs",
                Outcome = ExternalProviderOperationOutcome.Timeout
            },
            Warnings = ["discogs.timeout"],
            RetryContext = retryContext,
            AttemptedDiscogsRouteCount = 1,
            OutboundRequestCount = 2
        };
        var batch = new ExternalReleaseRouteBatchResolution
        {
            Candidates = [candidate],
            DiscogsStatus = new ExternalProviderOperationStatus
            {
                ProviderCode = "discogs",
                Outcome = ExternalProviderOperationOutcome.Succeeded
            },
            AttemptedDiscogsRouteCount = 1,
            OutboundRequestCount = 2,
            Warnings = ["discogs.timeout"]
        };

        Assert.Equal(
            ExternalProviderOperationOutcome.Timeout,
            candidate.DiscogsStatus.Outcome);
        Assert.Equal(
            ExternalProviderOperationOutcome.Succeeded,
            batch.DiscogsStatus.Outcome);
        Assert.Same(retryContext, candidate.RetryContext);
    }
}
