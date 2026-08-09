using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "External candidates without an actionable release route are omitted")]
    public async Task External_candidates_without_an_actionable_release_route_are_omitted()
    {
        var selectedId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        RecordingDiscoveryContext context = new()
        {
            Role = OriginalCandidateRole.HistoricalRoot,
            Paths = new HashSet<OriginalDiscoveryPath>
            {
                OriginalDiscoveryPath.SharedWorkPerformance
            },
            Evidence =
            [
                Evidence(OriginalCandidateEvidenceCode.SharedWork),
                Evidence(OriginalCandidateEvidenceCode.MatchingArtist)
            ],
            StructuralEvidenceComplete = false
        };
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                [
                    LineageCandidate(
                        candidateId,
                        routes: [],
                        discoveryContext: context)
                ],
                RecordingSource(selectedId)))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();

        ExternalOriginalCandidateResult result = await CreateService(
            local,
            provider).FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                null,
                CancellationToken.None);

        Assert.Empty(result.Candidates);
    }
}
