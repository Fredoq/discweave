using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed partial class LocalOriginalCandidateService
    : ILocalOriginalCandidateService
{
    private const string CoverRelationTypeCode = "coverOf";
    private const string RemixRelationTypeCode = "remixOf";
    private const string RemixerRoleCode = "remixer";
    private readonly ILocalOriginalCandidateDataSource _dataSource;

    public LocalOriginalCandidateService(
        ILocalOriginalCandidateDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<LocalOriginalCandidateResult> FindAsync(
        CollectionId collectionId,
        TrackId sourceTrackId,
        CancellationToken cancellationToken)
    {
        LocalOriginalCandidateSnapshot snapshot = await _dataSource.LoadAsync(
            collectionId,
            sourceTrackId,
            cancellationToken);
        LocalOriginalCandidateSnapshot.SourceTrackFact? source = snapshot.Source;
        if (source is null
            || source.CollectionId != collectionId
            || source.TrackId != sourceTrackId)
        {
            return Result(
                LocalOriginalCandidateStatus.SourceNotFound,
                sourceTrackId,
                null,
                []);
        }

        TrackStackGraph graph = CreateGraph(snapshot, collectionId);
        MarkerFacts marker = FindMarker(snapshot, collectionId, source.Title);
        OriginalCandidateChronology? sourceChronology =
            FindChronology(snapshot, collectionId, sourceTrackId);
        LocalOriginalSourceFacts sourceFacts = new()
        {
            TrackId = sourceTrackId,
            Title = source.Title,
            BaseTitle = marker.BaseTitle,
            SuggestedRelationTypeCode = marker.SuggestedRelationTypeCode,
            Artists = ArtistNames(snapshot, collectionId, sourceTrackId),
            Duration = source.Duration,
            ApproximateYear =
                source.VersionYear ?? sourceChronology?.LowerBound.Year,
            RecordingSource = source.RecordingSource
        };
        if (source.IsOriginal || !graph.IsStandalone(sourceTrackId))
        {
            return Result(
                LocalOriginalCandidateStatus.SourceNotEligible,
                sourceTrackId,
                sourceFacts,
                []);
        }

        List<CandidateWorkItem> workItems = [];
        foreach (LocalOriginalCandidateSnapshot.CandidateTrackFact candidate
            in snapshot.Candidates)
        {
            CandidateWorkItem? workItem = CreateWorkItem(
                snapshot,
                graph,
                collectionId,
                source,
                sourceChronology,
                marker,
                candidate);
            if (workItem is not null)
            {
                workItems.Add(workItem);
            }
        }

        IReadOnlyList<RankedOriginalCandidate> ranked =
            OriginalCandidateRanker.Rank(
                [.. workItems.Select(item => item.Input)]);
        IReadOnlyDictionary<string, CandidateWorkItem> byKey =
            workItems.ToDictionary(item => item.Input.CandidateKey);
        LocalOriginalCandidate[] candidates =
        [
            .. ranked.Select(item => ToCandidate(byKey[item.CandidateKey], item))
        ];

        return Result(
            LocalOriginalCandidateStatus.Success,
            sourceTrackId,
            sourceFacts,
            candidates);
    }

    private static CandidateWorkItem? CreateWorkItem(
        LocalOriginalCandidateSnapshot snapshot,
        TrackStackGraph graph,
        CollectionId collectionId,
        LocalOriginalCandidateSnapshot.SourceTrackFact source,
        OriginalCandidateChronology? sourceChronology,
        MarkerFacts marker,
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate)
    {
        string candidateBaseTitle =
            FindMarker(snapshot, collectionId, candidate.Title).BaseTitle;
        if (OriginalDiscoveryTextNormalizer.ForTitleKey(marker.BaseTitle)
            != OriginalDiscoveryTextNormalizer.ForTitleKey(candidateBaseTitle))
        {
            return null;
        }

        if (HasExactRecordingIdentity(
            source.RecordingSource,
            candidate.RecordingSource))
        {
            return null;
        }

        HashSet<OriginalCandidateHardGate> hardGates = HardGates(
            snapshot,
            graph,
            collectionId,
            source,
            marker.RelationTypeCode,
            candidate);
        bool isExistingRoot = IsExistingRoot(
            snapshot,
            graph,
            collectionId,
            candidate);
        int memberCount = isExistingRoot
            ? MemberCount(snapshot, graph, collectionId, candidate.TrackId)
            : 0;
        string sourceArtist = ArtistDisplay(
            snapshot,
            collectionId,
            source.TrackId);
        string candidateArtist = ArtistDisplay(
            snapshot,
            collectionId,
            candidate.TrackId);
        string candidateKey = OriginalCandidateKey.ForLocalTrack(
            candidate.TrackId);
        OriginalCandidateFacts facts = new()
        {
            CandidateKey = candidateKey,
            SourceBaseTitle = marker.BaseTitle,
            CandidateBaseTitle = candidateBaseTitle,
            SourcePrimaryArtist = EmptyToNull(sourceArtist),
            CandidatePrimaryArtist = EmptyToNull(candidateArtist),
            SourceDuration = source.Duration,
            CandidateDuration = candidate.Duration,
            SourceChronology = sourceChronology,
            CandidateChronology = FindChronology(
                snapshot,
                collectionId,
                candidate.TrackId),
            DirectedLineage = HasDirectedLineage(
                snapshot,
                collectionId,
                source.TrackId,
                candidate.TrackId,
                marker.RelationTypeCode),
            KnownLocalRoot = isExistingRoot,
            VersionMarker = marker.HasMarker,
            CreditsSupport = CreditsSupport(
                snapshot,
                collectionId,
                source.TrackId,
                marker.RelationTypeCode),
            HardGates = hardGates,
            AdditionalEvidence = []
        };

        return new CandidateWorkItem
        {
            Candidate = candidate,
            CandidateArtistDisplay = candidateArtist,
            CandidateIsExistingRoot = isExistingRoot,
            CandidateMemberCount = memberCount,
            SuggestedRelationTypeCode = marker.SuggestedRelationTypeCode,
            Input = OriginalCandidateEvidenceExtractor.Extract(facts)
        };
    }
}
