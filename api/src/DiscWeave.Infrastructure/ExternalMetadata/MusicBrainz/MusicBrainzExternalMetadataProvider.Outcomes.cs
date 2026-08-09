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
        public TimeSpan? Duration { get; } // NOSONAR: this result shape uses the domain's conventional duration name.
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
            RecordingDuration = duration;
            Artists = artists;
            Relations = relations;
        }

        public string Mbid { get; }
        public string Title { get; }
        public TimeSpan? RecordingDuration { get; }
        public IReadOnlyList<string> Artists { get; }
        public IReadOnlyList<DirectedRelation> Relations { get; }
    }

    internal sealed record WorkPerformanceOutcome
    {
        public WorkPerformanceOutcome(
            string workMbid,
            string? title,
            IReadOnlyList<WorkRecordingHypothesis> recordings,
            bool complete,
            IReadOnlyList<string> warnings)
        {
            WorkMbid = workMbid;
            Title = title;
            Recordings = recordings;
            Complete = complete;
            Warnings = warnings;
        }

        public string WorkMbid { get; }
        public string? Title { get; }
        public IReadOnlyList<WorkRecordingHypothesis> Recordings { get; }
        public bool Complete { get; }
        public IReadOnlyList<string> Warnings { get; }
    }

    internal sealed record WorkRecordingHypothesis
    {
        public WorkRecordingHypothesis(string mbid, string title)
        {
            Mbid = mbid;
            Title = title;
        }

        public string Mbid { get; }
        public string Title { get; }
    }

    internal sealed record ReleaseGroupHypothesis
    {
        public ReleaseGroupHypothesis(string mbid, string title, int score)
        {
            Mbid = mbid;
            Title = title;
            Score = score;
        }

        public string Mbid { get; }
        public string Title { get; }
        public int Score { get; }
    }

    internal sealed record ReleaseGroupSearchOutcome
    {
        public ReleaseGroupSearchOutcome(
            IReadOnlyList<ReleaseGroupHypothesis> groups,
            int? total)
        {
            Groups = groups;
            Total = total;
        }

        public IReadOnlyList<ReleaseGroupHypothesis> Groups { get; }
        public int? Total { get; }
    }

    internal sealed record DirectedRelation
    {
        public DirectedRelation( // NOSONAR: this immutable provider relation mirrors the external response shape.
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

    internal sealed record ReleaseContextOutcome
    {
        public ReleaseContextOutcome(
            IReadOnlyList<ReleaseRoute> releases,
            bool complete,
            IReadOnlyList<string> warnings)
        {
            Releases = releases;
            Complete = complete;
            Warnings = warnings;
        }

        public IReadOnlyList<ReleaseRoute> Releases { get; }
        public bool Complete { get; }
        public IReadOnlyList<string> Warnings { get; }
    }

    internal sealed record ReleaseRoute
    {
        public ReleaseRoute( // NOSONAR: this immutable route mirrors all provider release fields.
            string mbid,
            string title,
            DateOnly? releaseDate,
            ProviderPartialDate? partialDate,
            string? releaseGroupMbid,
            IReadOnlyList<ExternalMetadataReleaseTrack> tracks,
            IReadOnlyList<ExternalMetadataSource> relatedSources,
            string? status = null,
            string? country = null,
            string? primaryType = null,
            IReadOnlyList<string>? secondaryTypes = null,
            IReadOnlyList<string>? artists = null,
            IReadOnlyList<string>? labels = null,
            IReadOnlyList<string>? formats = null,
            string? catalogNumber = null)
        {
            Mbid = mbid;
            Title = title;
            ReleaseDate = releaseDate;
            PartialDate = partialDate;
            ReleaseGroupMbid = releaseGroupMbid;
            Tracks = tracks;
            RelatedSources = relatedSources;
            Status = status;
            Country = country;
            PrimaryType = primaryType;
            SecondaryTypes = secondaryTypes ?? [];
            Artists = artists ?? [];
            Labels = labels ?? [];
            Formats = formats ?? [];
            CatalogNumber = catalogNumber;
        }

        public string Mbid { get; }
        public string Title { get; }
        public DateOnly? ReleaseDate { get; }
        public ProviderPartialDate? PartialDate { get; }
        public string? ReleaseGroupMbid { get; }
        public IReadOnlyList<ExternalMetadataReleaseTrack> Tracks { get; }
        public IReadOnlyList<ExternalMetadataSource> RelatedSources { get; }
        public string? Status { get; }
        public string? Country { get; }
        public string? PrimaryType { get; }
        public IReadOnlyList<string> SecondaryTypes { get; }
        public IReadOnlyList<string> Artists { get; }
        public IReadOnlyList<string> Labels { get; }
        public IReadOnlyList<string> Formats { get; }
        public string? CatalogNumber { get; }
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
