using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private static IReadOnlyList<LineageTarget> CollectLineageTargets(
        IReadOnlyList<LineageSource> sources,
        int maximumTargets,
        out bool truncated)
    {
        var forwardByTarget = new Dictionary<string, List<LineageSupport>>(StringComparer.Ordinal);
        var excludedTargets = new HashSet<string>(StringComparer.Ordinal);

        foreach (LineageSource source in sources)
        {
            foreach (DirectedRelation relation in source.Detail.Relations)
            {
                if (!TryMapLineageSupport(source, relation, out LineageSupport support))
                {
                    continue;
                }

                if (support.Direction == RecordingLineageDirection.CandidateToSelected)
                {
                    _ = excludedTargets.Add(support.TargetMbid);
                    continue;
                }

                if (string.Equals(support.SourceMbid, support.TargetMbid, StringComparison.Ordinal))
                {
                    continue;
                }

                if (!forwardByTarget.TryGetValue(support.TargetMbid, out List<LineageSupport>? supports))
                {
                    supports = [];
                    forwardByTarget.Add(support.TargetMbid, supports);
                }

                supports.Add(support);
            }
        }

        LineageTarget[] ordered =
        [
            .. forwardByTarget
                .Where(pair => !excludedTargets.Contains(pair.Key))
                .Select(pair => new LineageTarget(
                    pair.Key,
                    [
                        .. pair.Value
                            .OrderByDescending(support => support.SourceScore)
                            .ThenBy(support => support.Kind)
                            .ThenBy(support => support.SourceMbid, StringComparer.Ordinal)
                    ]))
                .OrderByDescending(target => target.HighestSourceScore)
                .ThenBy(target => target.BestKind)
                .ThenBy(target => target.Mbid, StringComparer.Ordinal)
        ];
        truncated = ordered.Length > maximumTargets;
        return [.. ordered.Take(maximumTargets)];
    }

    private static bool TryMapLineageSupport(
        LineageSource source,
        DirectedRelation relation,
        out LineageSupport support)
    {
        support = null!;
        if (!string.Equals(relation.TargetType, "recording", StringComparison.Ordinal) ||
            relation.TargetMbid is null ||
            !TryMapLineageKind(relation.TypeId, out RecordingLineageRelationKind kind))
        {
            return false;
        }

        RecordingLineageDirection? direction = relation.Direction switch
        {
            "forward" => RecordingLineageDirection.SelectedToCandidate,
            "backward" => RecordingLineageDirection.CandidateToSelected,
            _ => null
        };
        if (direction is null)
        {
            return false;
        }

        support = new LineageSupport(
            source.Detail.Mbid,
            relation.TargetMbid!,
            source.Score,
            kind,
            direction.Value);
        return true;
    }

    private static bool TryMapLineageKind(
        string relationTypeId,
        out RecordingLineageRelationKind kind)
    {
        switch (relationTypeId)
        {
            case RecordingRemixRelationId:
                kind = RecordingLineageRelationKind.RemixOf;
                return true;
            case RecordingEditRelationId:
                kind = RecordingLineageRelationKind.EditOf;
                return true;
            default:
                kind = default;
                return false;
        }
    }

    private static RecordingWorkEvidence[] MapWorkEvidence(RecordingDetailOutcome detail)
    {
        return
        [
            .. detail.Relations
                .Where(relation =>
                    string.Equals(relation.TargetType, "work", StringComparison.Ordinal) &&
                    relation.TargetMbid is not null)
                .GroupBy(relation => relation.TargetMbid, StringComparer.Ordinal)
                .Select(group => new RecordingWorkEvidence
                {
                    WorkMbid = group.Key!,
                    ExplicitCover = group.Any(relation =>
                        relation.AttributeIds.Contains(
                            PerformanceCoverAttributeId,
                            StringComparer.Ordinal))
                })
                .OrderBy(work => work.WorkMbid, StringComparer.Ordinal)
        ];
    }

    private static RecordingLineageRelation[] MapLineageRelations(LineageTarget target)
    {
        return
        [
            .. target.Supports.Select(support => new RecordingLineageRelation
            {
                Kind = support.Kind,
                Direction = support.Direction,
                SelectedRecordingMbid = support.SourceMbid,
                CandidateRecordingMbid = support.TargetMbid
            })
        ];
    }

    private static RecordingReleaseRoute[] MapReleaseRoutes(
        IReadOnlyList<ReleaseRoute> releases,
        string expectedRecordingMbid,
        out bool invalidRoute)
    {
        var routes = new List<RecordingReleaseRoute>();
        invalidRoute = false;
        foreach (ReleaseRoute release in releases)
        {
            if (release.ReleaseGroupMbid is null)
            {
                invalidRoute = true;
                continue;
            }

            foreach (ExternalMetadataReleaseTrack track in release.Tracks)
            {
                ExternalMetadataSource? recordingSource = track.ExternalSources.FirstOrDefault(source =>
                    string.Equals(source.ProviderName, ProviderCodeValue, StringComparison.Ordinal) &&
                    string.Equals(source.ResourceType, "recording", StringComparison.Ordinal));
                if (recordingSource is null)
                {
                    invalidRoute = true;
                    continue;
                }

                if (!string.Equals(
                        recordingSource.ExternalId,
                        expectedRecordingMbid,
                        StringComparison.Ordinal))
                {
                    continue;
                }

                ExternalMetadataSource? trackSource = track.ExternalSources.FirstOrDefault(source =>
                    string.Equals(source.ProviderName, ProviderCodeValue, StringComparison.Ordinal) &&
                    string.Equals(source.ResourceType, "track", StringComparison.Ordinal));
                if (trackSource is null || string.IsNullOrWhiteSpace(track.Disc))
                {
                    invalidRoute = true;
                    continue;
                }

                routes.Add(new RecordingReleaseRoute
                {
                    ReleaseSource = MusicBrainzSource("release", release.Mbid),
                    ReleaseGroupSource = MusicBrainzSource("release-group", release.ReleaseGroupMbid),
                    Title = release.Title,
                    Date = release.PartialDate,
                    MediumPosition = track.Disc,
                    MusicBrainzTrackMbid = trackSource.ExternalId,
                    ReleaseGroupRerecordingContext = false,
                    RelatedReleaseSources = release.RelatedSources,
                    Artists = release.Artists,
                    Labels = release.Labels,
                    Formats = release.Formats,
                    CatalogNumber = release.CatalogNumber,
                    TrackTitle = track.Title,
                    TrackPosition = track.Position,
                    TrackDuration = track.Duration
                });
            }
        }

        return [.. routes];
    }

    private static bool IsForwardRerecordingGroup(ReleaseGroupDetailOutcome group)
    {
        return group.Relations.Any(relation =>
            string.Equals(relation.TypeId, ReleaseGroupRerecordingRelationId, StringComparison.Ordinal) &&
            string.Equals(relation.TargetType, "release-group", StringComparison.Ordinal) &&
            string.Equals(relation.Direction, "forward", StringComparison.Ordinal));
    }
}
