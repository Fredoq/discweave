using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    internal sealed record RecordingSearchOutcome
    {
        public RecordingSearchOutcome(IReadOnlyList<RecordingHypothesis> recordings, int? total)
        {
            Recordings = recordings;
            Total = total;
        }

        public IReadOnlyList<RecordingHypothesis> Recordings { get; }
        public int? Total { get; }
    }

    internal sealed record RecordingHypothesis
    {
        public RecordingHypothesis(
            string mbid,
            string title,
            int score,
            TimeSpan? duration,
            IReadOnlyList<string> artists)
        {
            Mbid = mbid;
            Title = title;
            Score = score;
            Duration = duration;
            Artists = artists;
        }

        public string Mbid { get; }
        public string Title { get; }
        public int Score { get; }
        public TimeSpan? Duration { get; }
        public IReadOnlyList<string> Artists { get; }
    }

    internal sealed record RecordingDetailOutcome
    {
        public RecordingDetailOutcome(
            string mbid,
            string title,
            TimeSpan? duration,
            IReadOnlyList<string> artists,
            IReadOnlyList<DirectedRelation> relations)
        {
            Mbid = mbid;
            Title = title;
            Duration = duration;
            Artists = artists;
            Relations = relations;
        }

        public string Mbid { get; }
        public string Title { get; }
        public TimeSpan? Duration { get; }
        public IReadOnlyList<string> Artists { get; }
        public IReadOnlyList<DirectedRelation> Relations { get; }
    }

    internal sealed record DirectedRelation
    {
        public DirectedRelation(
            string typeId,
            string type,
            string direction,
            string targetType,
            string? targetMbid,
            string? targetTitle,
            IReadOnlyList<string> attributes,
            IReadOnlyList<string> attributeIds)
        {
            TypeId = typeId;
            Type = type;
            Direction = direction;
            TargetType = targetType;
            TargetMbid = targetMbid;
            TargetTitle = targetTitle;
            Attributes = attributes;
            AttributeIds = attributeIds;
        }

        public string TypeId { get; }
        public string Type { get; }
        public string Direction { get; }
        public string TargetType { get; }
        public string? TargetMbid { get; }
        public string? TargetTitle { get; }
        public IReadOnlyList<string> Attributes { get; }
        public IReadOnlyList<string> AttributeIds { get; }
    }

    internal sealed record ReleaseBrowseOutcome
    {
        public ReleaseBrowseOutcome(
            IReadOnlyList<ReleaseRoute> releases,
            IReadOnlyList<ReleaseGroupDetailOutcome> releaseGroups,
            bool chronologyComplete,
            bool releaseGroupContextComplete,
            IReadOnlyList<string> warnings)
        {
            Releases = releases;
            ReleaseGroups = releaseGroups;
            ChronologyComplete = chronologyComplete;
            ReleaseGroupContextComplete = releaseGroupContextComplete;
            Warnings = warnings;
        }

        public IReadOnlyList<ReleaseRoute> Releases { get; }
        public IReadOnlyList<ReleaseGroupDetailOutcome> ReleaseGroups { get; }
        public bool ChronologyComplete { get; }
        public bool ReleaseGroupContextComplete { get; }
        public IReadOnlyList<string> Warnings { get; }
    }

    internal sealed record ReleaseRoute
    {
        public ReleaseRoute(
            string mbid,
            string title,
            DateOnly? releaseDate,
            ProviderPartialDate? partialDate,
            string? releaseGroupMbid,
            IReadOnlyList<ExternalMetadataReleaseTrack> tracks,
            IReadOnlyList<ExternalMetadataSource> relatedSources)
        {
            Mbid = mbid;
            Title = title;
            ReleaseDate = releaseDate;
            PartialDate = partialDate;
            ReleaseGroupMbid = releaseGroupMbid;
            Tracks = tracks;
            RelatedSources = relatedSources;
        }

        public string Mbid { get; }
        public string Title { get; }
        public DateOnly? ReleaseDate { get; }
        public ProviderPartialDate? PartialDate { get; }
        public string? ReleaseGroupMbid { get; }
        public IReadOnlyList<ExternalMetadataReleaseTrack> Tracks { get; }
        public IReadOnlyList<ExternalMetadataSource> RelatedSources { get; }
    }

    internal sealed record ReleaseGroupDetailOutcome
    {
        public ReleaseGroupDetailOutcome(string mbid, IReadOnlyList<DirectedRelation> relations)
        {
            Mbid = mbid;
            Relations = relations;
        }

        public string Mbid { get; }
        public IReadOnlyList<DirectedRelation> Relations { get; }
    }
}
