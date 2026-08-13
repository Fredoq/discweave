using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    private static ExternalMetadataSource RecordingSource(Guid recordingId)
    {
        string id = recordingId.ToString("D").ToLowerInvariant();
        return new ExternalMetadataSource(
            "musicbrainz",
            "recording",
            id,
            $"https://musicbrainz.org/recording/{id}",
            "MusicBrainz");
    }

    private static RecordingLineageRelation Relation(
        Guid selectedRecordingId,
        Guid candidateRecordingId,
        RecordingLineageRelationKind kind = RecordingLineageRelationKind.RemixOf,
        RecordingLineageDirection direction =
            RecordingLineageDirection.SelectedToCandidate)
    {
        return new RecordingLineageRelation
        {
            Kind = kind,
            Direction = direction,
            SelectedRecordingMbid =
                selectedRecordingId.ToString("D").ToLowerInvariant(),
            CandidateRecordingMbid =
                candidateRecordingId.ToString("D").ToLowerInvariant()
        };
    }

    private static RecordingReleaseRoute Route(
        Guid releaseId,
        int year,
        int? month = null,
        int? day = null,
        bool rerecordingContext = false)
    {
        var groupId = Guid.Parse(
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        string releaseMbid = releaseId.ToString("D").ToLowerInvariant();
        string groupMbid = groupId.ToString("D").ToLowerInvariant();
        return new RecordingReleaseRoute
        {
            ReleaseSource = new ExternalMetadataSource(
                "musicbrainz",
                "release",
                releaseMbid,
                $"https://musicbrainz.org/release/{releaseMbid}",
                "MusicBrainz"),
            ReleaseGroupSource = new ExternalMetadataSource(
                "musicbrainz",
                "release-group",
                groupMbid,
                $"https://musicbrainz.org/release-group/{groupMbid}",
                "MusicBrainz"),
            Title = $"Release {releaseMbid}",
            Date = new ProviderPartialDate
            {
                Year = year,
                Month = month,
                Day = day
            },
            MediumPosition = "1",
            MusicBrainzTrackMbid =
                Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc")
                    .ToString("D"),
            ReleaseGroupRerecordingContext = rerecordingContext,
            RelatedReleaseSources = []
        };
    }

    private static RecordingLineageCandidate LineageCandidate(
        Guid recordingId,
        IReadOnlyList<RecordingLineageRelation>? relations = null,
        IReadOnlyList<RecordingReleaseRoute>? routes = null,
        IReadOnlyList<RecordingWorkEvidence>? workEvidence = null,
        IReadOnlyList<string>? warnings = null,
        string title = "Blue Monday",
        string artist = "New Order",
        int? durationSeconds = 418,
        bool chronologyComplete = true,
        RecordingDiscoveryContext? discoveryContext = null)
    {
        return new RecordingLineageCandidate
        {
            RecordingSource = RecordingSource(recordingId),
            Title = title,
            Artists = [artist],
            Duration = durationSeconds is { } value
                ? TimeSpan.FromSeconds(value)
                : null,
            Relations = relations ?? [],
            WorkEvidence = workEvidence ?? [],
            ReleaseRoutes = routes ?? [],
            ChronologyComplete = chronologyComplete,
            Warnings = warnings ?? [],
            DiscoveryContext = discoveryContext
        };
    }

    private static RecordingLineageResult LineageResult(
        IReadOnlyList<RecordingLineageCandidate> candidates,
        ExternalMetadataSource? selectedRecording = null,
        IReadOnlyList<string>? warnings = null)
    {
        return new RecordingLineageResult
        {
            SelectedRecording = selectedRecording,
            Candidates = candidates,
            ChronologyComplete =
                candidates.All(candidate => candidate.ChronologyComplete),
            Warnings = warnings ?? []
        };
    }
}
