using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Tracks;

public sealed partial class ExternalOriginalCandidateService
{
    private static HashSet<Guid> SourceRecordingIds(
        LocalOriginalSourceFacts source,
        IEnumerable<RecordingLineageResult> results)
    {
        HashSet<Guid> ids = [];
        if (TryRecordingId(source.RecordingSource, out Guid localId))
        {
            _ = ids.Add(localId);
        }

        foreach (RecordingLineageResult result in results)
        {
            if (TryRecordingId(
                result.SelectedRecording,
                out Guid selectedId))
            {
                _ = ids.Add(selectedId);
            }
        }

        return ids;
    }

    private static bool TryRecordingId(
        ExternalMetadataSource? source,
        out Guid recordingId)
    {
        recordingId = default;
        return source is not null
            && string.Equals(
                source.ProviderName,
                "musicbrainz",
                StringComparison.OrdinalIgnoreCase)
            && string.Equals(
                source.ResourceType,
                "recording",
                StringComparison.OrdinalIgnoreCase)
            && Guid.TryParse(source.ExternalId, out recordingId);
    }

    private static bool RelationTargets(
        RecordingLineageRelation relation,
        Guid recordingId)
    {
        return Guid.TryParse(
                relation.CandidateRecordingMbid,
                out Guid relationCandidateId)
            && relationCandidateId == recordingId;
    }

    private static bool HasRetainedForwardRelation(
        CandidateAggregate aggregate)
    {
        return aggregate.Relations.Any(relation =>
            relation.Direction
                == RecordingLineageDirection.SelectedToCandidate
            && relation.Kind is RecordingLineageRelationKind.RemixOf
                or RecordingLineageRelationKind.EditOf);
    }

    private static ExternalMetadataSource CanonicalRecordingSource(
        ExternalMetadataSource source,
        Guid recordingId)
    {
        return new ExternalMetadataSource(
            "musicbrainz",
            "recording",
            recordingId.ToString("D").ToLowerInvariant(),
            source.SourceUrl,
            source.Attribution);
    }

    private static string RouteKey(RecordingReleaseRoute route)
    {
        return string.Join(
            '\u001f',
            route.ReleaseSource.ProviderName.ToLowerInvariant(),
            route.ReleaseSource.ResourceType.ToLowerInvariant(),
            route.ReleaseSource.ExternalId.ToLowerInvariant(),
            route.MediumPosition,
            route.MusicBrainzTrackMbid.ToLowerInvariant());
    }

    private static bool HasVersionMarker(
        LocalOriginalSourceFacts source)
    {
        return !string.Equals(
            OriginalDiscoveryTextNormalizer.ForTitleKey(source.Title),
            OriginalDiscoveryTextNormalizer.ForTitleKey(source.BaseTitle),
            StringComparison.Ordinal);
    }

    private static string? SuggestedRelationType(
        IEnumerable<RecordingLineageRelation> relations)
    {
        RecordingLineageRelationKind[] forwardKinds =
        [
            .. relations
                .Where(relation =>
                    relation.Direction
                        == RecordingLineageDirection.SelectedToCandidate)
                .Select(relation => relation.Kind)
        ];
        return forwardKinds.Contains(
            RecordingLineageRelationKind.RemixOf)
            ? "remixOf"
            : forwardKinds.Contains(RecordingLineageRelationKind.EditOf)
                ? "versionOf"
                : null;
    }

    private sealed class CandidateMappingWorkItem
    {
        public CandidateMappingWorkItem(
            Guid recordingId,
            RecordingLineageCandidate candidate)
        {
            RecordingId = recordingId;
            Candidate = candidate;
        }

        public Guid RecordingId { get; }

        public RecordingLineageCandidate Candidate { get; }
    }

    private sealed class CandidateAggregate
    {
        public required Guid RecordingId { get; init; }
        public required ExternalMetadataSource RecordingSource { get; init; }
        public required string Title { get; init; }
        public required IReadOnlyList<string> Artists { get; init; }
        public TimeSpan? Duration { get; init; }
        public required IReadOnlyList<RecordingLineageRelation> Relations { get; init; }
        public required IReadOnlyList<RecordingWorkEvidence> WorkEvidence { get; init; }
        public required IReadOnlyList<RecordingReleaseRoute> ReleaseRoutes { get; init; }
        public required bool ChronologyComplete { get; init; }

        public string CandidateKey =>
            OriginalCandidateKey.ForMusicBrainzRecording(RecordingId);
    }
}
