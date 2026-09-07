using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Theory]
    [InlineData(false, "Nice", "Duran Duran", 1)]
    [InlineData(true, "Nice", "Duran Duran", 1)]
    [InlineData(false, "Nice (Radio Mix)", "Duran Duran", 0)]
    [InlineData(false, "Nice", "Another Artist", 0)]
    [InlineData(false, "Nice", "", 1)]
    public async Task Discogs_search_finds_original_rows_independently_of_musicbrainz(
        bool musicBrainzFails, string title, string artist, int expectedCount)
    {
        LocalOriginalCandidateResult local = EmptyLocalResult();
        local = local with { Source = local.Source! with { Title = "Nice (Radio Mix By Eric Prydz)", BaseTitle = "Nice", Artists = ["Duran Duran"] } };
        var musicBrainz = new FakeRecordingLineageProvider();
        if (musicBrainzFails)
        {
            musicBrainz.Result = new ExternalMetadataResult<RecordingLineageResult>(new ExternalMetadataError(
                ExternalMetadataErrorKind.Unavailable, "musicbrainz.unavailable", "Unavailable"));
        }

        var source = new ExternalMetadataSource("discogs", "release", "12345", "https://www.discogs.com/release/12345", "Discogs");
        ExternalMetadataReleaseTrack row = new(title, "1", TimeSpan.FromSeconds(207), string.IsNullOrEmpty(artist) ? [] : [artist], "1", null);
        ExternalMetadataReleaseDetail detail = new(source, "Nice", ["Duran Duran"], 2005, null, [], ["CD"], "single", [], [row], [], null, [], []);
        var discogs = new FakeExternalMetadataProvider("discogs")
        {
            ReleaseSearchResult = new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
                new ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>(
                    [new ExternalMetadataReleaseCandidate(source, "Nice", ["Duran Duran"], 2005, [], ["CD"], null, 1, [])], 1)),
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(detail)
        };
        ExternalOriginalCandidateResult result = await CreateService(local, musicBrainz, discogs).FindAsync(
            CollectionId.New(), local.SourceTrackId, null, CancellationToken.None, OriginalDiscoverySearchMode.ReleaseFirst);
        Assert.Equal(expectedCount, result.DiscogsCandidates.Count);
        if (expectedCount > 0)
        {
            Assert.Equal(DiscogsReleaseRowFingerprint.Create(row.Position, row.Title, row.Artists.Count > 0 ? row.Artists : detail.Artists, row.Duration),
                result.DiscogsCandidates[0].Fingerprint);
        }
        Assert.Equal("Nice", discogs.LastReleaseSearchQuery?.Title);
        Assert.Equal("Duran Duran", discogs.LastReleaseSearchQuery?.Artist);
        Assert.Contains(result.ProviderStatuses, status => status.ProviderCode == "discogs" && status.Outcome == ExternalProviderOperationOutcome.Succeeded);
    }
}
