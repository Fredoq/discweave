using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;
using System.Reflection;

namespace DiscWeave.Api.Tests;

public sealed partial class RecordingLineageContractTests
{
    [Fact]
    public void Lineage_contract_represents_selected_candidate_and_release_route_evidence()
    {
        ExternalMetadataSource selected = Source("recording", "selected-recording");
        ExternalMetadataSource candidate = Source("recording", "candidate-recording");
        var query = new RecordingLineageQuery
        {
            Title = "Selected recording",
            Artists = ["Selected artist"],
            Duration = TimeSpan.FromSeconds(210),
            ApproximateYear = 1971,
            KnownRecording = selected
        };
        var route = new RecordingReleaseRoute
        {
            ReleaseSource = Source("release", "release-id"),
            ReleaseGroupSource = Source("release-group", "release-group-id"),
            Title = "Original release",
            Date = new ProviderPartialDate { Year = 1971, Month = 4 },
            MediumPosition = "2",
            MusicBrainzTrackMbid = "track-id",
            ReleaseGroupRerecordingContext = false,
            RelatedReleaseSources = [Source("release", "related-release-id")]
        };
        var lineageCandidate = new RecordingLineageCandidate
        {
            RecordingSource = candidate,
            Title = "Candidate recording",
            Artists = ["Candidate artist"],
            Duration = TimeSpan.FromSeconds(210),
            Relations =
            [
                new RecordingLineageRelation
                {
                    Kind = RecordingLineageRelationKind.RemixOf,
                    Direction = RecordingLineageDirection.SelectedToCandidate,
                    SelectedRecordingMbid = "selected-recording",
                    CandidateRecordingMbid = "candidate-recording"
                }
            ],
            WorkEvidence =
            [
                new RecordingWorkEvidence
                {
                    WorkMbid = "work-id",
                    ExplicitCover = true
                }
            ],
            ReleaseRoutes = [route],
            ChronologyComplete = false,
            Warnings = ["musicbrainz.release_paging_omitted"]
        };
        RecordingLineageCandidate completeCandidate = lineageCandidate with
        {
            RecordingSource = Source("recording", "complete-recording"),
            ChronologyComplete = true,
            Warnings = []
        };
        var result = new RecordingLineageResult
        {
            SelectedRecording = selected,
            Candidates = [lineageCandidate, completeCandidate],
            ChronologyComplete = false,
            Warnings = ["musicbrainz.release_paging_omitted"]
        };

        Assert.Equal("musicbrainz", result.SelectedRecording!.ProviderName);
        Assert.Equal("recording", result.SelectedRecording.ResourceType);
        Assert.Equal(RecordingLineageDirection.SelectedToCandidate,
            result.Candidates[0].Relations[0].Direction);
        Assert.True(result.Candidates[0].WorkEvidence[0].ExplicitCover);
        ProviderPartialDate date = Assert.IsType<ProviderPartialDate>(
            result.Candidates[0].ReleaseRoutes[0].Date);
        Assert.Equal(1971, date.Year);
        Assert.Equal(4, date.Month);
        Assert.Equal("release", result.Candidates[0].ReleaseRoutes[0].ReleaseSource.ResourceType);
        Assert.Equal("release-group",
            result.Candidates[0].ReleaseRoutes[0].ReleaseGroupSource.ResourceType);
        Assert.Equal("track-id", result.Candidates[0].ReleaseRoutes[0].MusicBrainzTrackMbid);
        Assert.Equal(selected, query.KnownRecording);
        Assert.False(result.Candidates[0].ChronologyComplete);
        Assert.Contains("musicbrainz.release_paging_omitted", result.Candidates[0].Warnings);
        Assert.True(result.Candidates[1].ChronologyComplete);
        Assert.Empty(result.Candidates[1].Warnings);

        MethodInfo? providerMethod = typeof(IRecordingLineageProvider).GetMethod(
            nameof(IRecordingLineageProvider.FindOriginalsAsync));

        Assert.NotNull(providerMethod);
    }

    [Fact]
    public void External_result_keeps_provider_statuses_and_partial_warnings_independent()
    {
        var externalCandidate = new ExternalOriginalCandidate
        {
            CandidateKey = "musicbrainz:recording:candidate-recording",
            LocalTrackId = new TrackId(Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")),
            RecordingSource = Source("recording", "candidate-recording"),
            Title = "Candidate recording",
            Artists = ["Candidate artist"],
            Ranked = Ranked("musicbrainz:recording:candidate-recording"),
            SuggestedRelationTypeCode = "remixOf",
            ReleaseRoutes = [],
            DiscogsStatus = new ExternalProviderOperationStatus
            {
                ProviderCode = "discogs",
                Outcome = ExternalProviderOperationOutcome.Disabled
            },
            DiscogsWarnings = [],
            DiscogsRetryContext = new DiscogsRouteRetryContext
            {
                RecordingSource =
                    Source("recording", "candidate-recording"),
                Items = []
            }
        };
        var result = new ExternalOriginalCandidateResult
        {
            Local = new LocalOriginalCandidateResult
            {
                Status = LocalOriginalCandidateStatus.Success,
                SourceTrackId = new TrackId(Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")),
                Candidates = []
            },
            Candidates = [externalCandidate],
            ProviderStatuses =
            [
                new ExternalProviderOperationStatus
                {
                    ProviderCode = "musicbrainz",
                    Outcome = ExternalProviderOperationOutcome.RateLimited,
                    ErrorCode = "musicbrainz.rate_limited",
                    RetryAfter = TimeSpan.FromSeconds(30)
                },
                new ExternalProviderOperationStatus
                {
                    ProviderCode = "discogs",
                    Outcome = ExternalProviderOperationOutcome.Disabled
                }
            ],
            Warnings = ["musicbrainz.release_paging_omitted"]
        };

        Assert.Equal(ExternalProviderOperationOutcome.RateLimited,
            result.ProviderStatuses[0].Outcome);
        Assert.Equal(TimeSpan.FromSeconds(30), result.ProviderStatuses[0].RetryAfter);
        Assert.Equal(ExternalProviderOperationOutcome.Disabled,
            result.ProviderStatuses[1].Outcome);
        Assert.Equal("musicbrainz:recording:candidate-recording",
            result.Candidates[0].Ranked.CandidateKey);
        Assert.Contains("musicbrainz.release_paging_omitted", result.Warnings);
    }

    private static RankedOriginalCandidate Ranked(string candidateKey)
    {
        return new RankedOriginalCandidate
        {
            CandidateKey = candidateKey,
            Confidence = OriginalCandidateConfidence.Medium,
            Selectable = true,
            SupportingEvidence = [],
            Contradictions = [],
            MissingEvidence = []
        };
    }

    private static ExternalMetadataSource Source(string resourceType, string externalId)
    {
        return new ExternalMetadataSource(
            "musicbrainz",
            resourceType,
            externalId,
            $"https://musicbrainz.org/{resourceType}/{externalId}",
            "MusicBrainz");
    }
}
