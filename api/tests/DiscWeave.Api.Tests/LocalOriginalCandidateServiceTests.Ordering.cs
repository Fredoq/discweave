using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateServiceTests
{
    [Fact]
    public async Task Candidate_order_is_stable_when_snapshot_order_is_shuffled()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source =
            Source(collectionId);
        var lowerId = new TrackId(
            Guid.Parse("00000000-0000-0000-0000-000000000001"));
        var higherId = new TrackId(
            Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"));
        LocalOriginalCandidateSnapshot.CandidateTrackFact higher =
            Candidate(collectionId, trackId: higherId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact lower =
            Candidate(collectionId, trackId: lowerId);
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            higher,
            lower);

        LocalOriginalCandidateResult result = await CreateService(snapshot)
            .FindAsync(
                collectionId,
                source.TrackId,
                CancellationToken.None);

        Assert.Equal(
            [lowerId, higherId],
            result.Candidates.Select(candidate => candidate.LocalTrackId));
    }
}
