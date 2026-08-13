using System.Net;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    [Fact(DisplayName = "Direct authority rejects contradictory complete tracklists")]
    public void Direct_authority_rejects_contradictory_complete_tracklists()
    {
        ExternalReleaseRouteMatchResult result = MatrixMatch(
            MusicBrainzRelease(
                ExternalMetadataPartialDate.ForYear(1983)),
            MatrixDiscogs(
                rows:
                [
                    DiscogsRow("Blue Monday", "A1"),
                    DiscogsRow("Other", "A2")
                ]),
            ExternalReleaseRouteMatchAuthority.DirectRelationship);

        Assert.Equal(
            ExternalReleaseRouteMatchOutcome.NotMatched,
            result.Outcome);
        Assert.Contains(
            "discogs.tracklist_contradiction",
            result.ContradictionCodes);
    }

    [Fact(DisplayName = "Malformed nested Discogs detail preserves the MusicBrainz fallback")]
    public async Task Malformed_nested_Discogs_detail_preserves_the_MusicBrainz_fallback()
    {
        RecordingReleaseRoute route = ResolverRoute(1);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(route, RecordingMbid));
        string payload = DiscogsDetail("249504").Replace(
            "\"labels\": [{ \"name\": \"Factory\", \"catno\": \"FAC 73\" }]",
            "\"labels\": [null]",
            StringComparison.Ordinal);
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            new RecordingHttpMessageHandler(_ => JsonResponse(payload)));

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        AssertInvalidDiscogsFallback(result);
    }

    [Fact(DisplayName = "Discogs release not found remains distinct and preserves the MusicBrainz fallback")]
    public async Task Discogs_release_not_found_remains_distinct_and_preserves_the_MusicBrainz_fallback()
    {
        RecordingReleaseRoute route = ResolverRoute(1);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(route, RecordingMbid));
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            new RecordingHttpMessageHandler(_ =>
                new HttpResponseMessage(HttpStatusCode.NotFound)));

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Null(Assert.Single(candidate.Routes).DiscogsBinding);
        Assert.Equal(
            ExternalProviderOperationOutcome.NotFound,
            candidate.DiscogsStatus.Outcome);
        Assert.Equal(
            "external_metadata.not_found",
            candidate.DiscogsStatus.ErrorCode);
        Assert.Contains("discogs.not_found", candidate.Warnings);
        _ = Assert.Single(candidate.RetryContext.Items);
    }
}
