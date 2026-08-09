using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private sealed record LineageSource
    {
        public LineageSource(RecordingDetailOutcome detail, int score)
        {
            Detail = detail;
            Score = score;
        }

        public RecordingDetailOutcome Detail { get; }
        public int Score { get; }
    }

    private sealed record LineageSourceResolution
    {
        public LineageSourceResolution(
            ExternalMetadataSource? selectedRecording,
            IReadOnlyList<LineageSource> sources,
            bool operationStopped,
            IReadOnlyList<ExternalProviderSearchDiagnostic>? searchDiagnostics = null)
        {
            SelectedRecording = selectedRecording;
            Sources = sources;
            OperationStopped = operationStopped;
            SearchDiagnostics = searchDiagnostics ?? [];
        }

        public ExternalMetadataSource? SelectedRecording { get; }
        public IReadOnlyList<LineageSource> Sources { get; }
        public bool OperationStopped { get; }
        public IReadOnlyList<ExternalProviderSearchDiagnostic> SearchDiagnostics { get; }
    }

    private sealed record LineageSupport
    {
        public LineageSupport(
            string sourceMbid,
            string targetMbid,
            int sourceScore,
            RecordingLineageRelationKind kind,
            RecordingLineageDirection direction)
        {
            SourceMbid = sourceMbid;
            TargetMbid = targetMbid;
            SourceScore = sourceScore;
            Kind = kind;
            Direction = direction;
        }

        public string SourceMbid { get; }
        public string TargetMbid { get; }
        public int SourceScore { get; }
        public RecordingLineageRelationKind Kind { get; }
        public RecordingLineageDirection Direction { get; }
    }

    private sealed record LineageTarget
    {
        public LineageTarget(string mbid, IReadOnlyList<LineageSupport> supports)
        {
            Mbid = mbid;
            Supports = supports;
            HighestSourceScore = supports.Max(support => support.SourceScore);
            BestKind = supports.Min(support => support.Kind);
        }

        public string Mbid { get; }
        public IReadOnlyList<LineageSupport> Supports { get; }
        public int HighestSourceScore { get; }
        public RecordingLineageRelationKind BestKind { get; }
    }
}
