using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
    public static ReleaseImportSessionResponse ToSessionResponse(
        ReleaseImportSession session,
        IReadOnlyList<ReleaseImportScanDiagnostic>? diagnostics = null,
        IReadOnlyList<ReleaseImportLooseFileCandidate>? looseFileCandidates = null)
    {
        return ToSessionResponse(session, diagnostics, looseFileCandidates, FileMoveHintLookup.Empty);
    }

    private static ReleaseImportSessionResponse ToSessionResponse(
        ReleaseImportSession session,
        IReadOnlyList<ReleaseImportScanDiagnostic>? diagnostics,
        IReadOnlyList<ReleaseImportLooseFileCandidate>? looseFileCandidates,
        FileMoveHintLookup moveHints)
    {
        ReleaseImportScanDiagnostic[] sessionDiagnostics = [.. diagnostics ?? []];
        return new ReleaseImportSessionResponse(
            session.Id.Value,
            SourceKindCode(session.SourceKind),
            OptionalReference(session.SourceRoot),
            StatusCode(session.Status),
            ScanModeCode(OptionalStruct(session.ScanMode)),
            session.DraftCount,
            session.TrackCount,
            session.IgnoredFileCount,
            session.LooseFileCandidateCount,
            session.CreatedAt,
            session.UpdatedAt,
            [.. sessionDiagnostics.Select(ToScanDiagnosticResponse)],
            [.. ScanDiagnosticSummaries(sessionDiagnostics)],
            looseFileCandidates is null ? null : [.. looseFileCandidates.Select(candidate => ToLooseFileCandidateResponse(candidate, moveHints))],
            null,
            null,
            session.ArchivedAt);
    }

    public static async Task<ReleaseImportSessionResponse> ToDetailResponseAsync(
        ReleaseImportSession session,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        ReleaseImportDraft[] drafts = await context.ReleaseImportDrafts.AsNoTracking()
            .Where(draft => draft.CollectionId == collectionId && draft.SessionId == session.Id)
            .ToArrayAsync(cancellationToken);
        drafts =
        [
            .. drafts.OrderBy(draft => OptionalReference(draft.RelativePath), StringComparer.Ordinal)
        ];
        ReleaseImportDraftId[] draftIds = [.. drafts.Select(draft => draft.Id)];
        ReleaseImportDraftTrack[] tracks = draftIds.Length == 0
            ? []
            : await context.ReleaseImportDraftTracks.AsNoTracking()
                .Where(track => track.CollectionId == collectionId && draftIds.Contains(track.DraftId))
                .ToArrayAsync(cancellationToken);
        tracks =
        [
            .. tracks.OrderBy(track => track.Position ?? 9999)
                .ThenBy(
                    track => OptionalReference(track.LocalFile)?.RelativePath,
                    StringComparer.Ordinal)
        ];
        SuggestionLookup suggestions = await SuggestionLookup.LoadAsync(context, collectionId, cancellationToken);
        ReleaseImportRelationSuggestion[] relationSuggestions = draftIds.Length == 0
            ? []
            : await context.ReleaseImportRelationSuggestions.AsNoTracking()
                .Where(suggestion => suggestion.CollectionId == collectionId && suggestion.SessionId == session.Id)
                .OrderBy(suggestion => suggestion.DraftId)
                .ThenBy(suggestion => suggestion.Token)
                .ThenBy(suggestion => suggestion.Id)
                .ToArrayAsync(cancellationToken);
        ReleaseImportScanDiagnostic[] diagnostics = await context.ReleaseImportScanDiagnostics.AsNoTracking()
            .Where(diagnostic => diagnostic.CollectionId == collectionId && diagnostic.SessionId == session.Id)
            .OrderBy(diagnostic => diagnostic.Severity)
            .ThenBy(diagnostic => diagnostic.Code)
            .ThenBy(diagnostic => diagnostic.RelativePath)
            .ToArrayAsync(cancellationToken);
        ReleaseImportLooseFileCandidate[] looseFileCandidates = await context.ReleaseImportLooseFileCandidates.AsNoTracking()
            .Where(candidate => candidate.CollectionId == collectionId && candidate.SessionId == session.Id)
            .OrderBy(candidate => candidate.RelativePath)
            .ToArrayAsync(cancellationToken);
        FileMoveHintLookup moveHints = await FileMoveHintLookup.LoadAsync(
            context,
            collectionId,
            tracks,
            looseFileCandidates,
            cancellationToken);
        var relationTargetLookup = RelationTargetLookup.Create(tracks, suggestions.ExistingTracks);
        Dictionary<Guid, ProvenanceCandidates> provenanceCandidates = [];
        foreach (ReleaseImportDraft draft in drafts.Where(item => item.SourceKind == ReleaseImportSourceKind.ExternalMetadata))
        {
            provenanceCandidates[draft.Id.Value] = await LoadProvenanceCandidatesAsync(
                context,
                collectionId,
                draft,
                cancellationToken);
        }

        return ToSessionResponse(session, diagnostics, looseFileCandidates, moveHints) with
        {
            Drafts = [.. drafts.Select(draft => ToDraftResponse(
                session.SourceKind,
                draft,
                tracks,
                suggestions,
                moveHints,
                provenanceCandidates.TryGetValue(draft.Id.Value, out ProvenanceCandidates? candidates)
                    ? candidates
                    : ProvenanceCandidates.Empty))],
            RelationSuggestions = [.. relationSuggestions.Select(suggestion => ToRelationSuggestionResponse(suggestion, relationTargetLookup))]
        };
    }

    private static ReleaseImportDraftResponse ToDraftResponse(
        ReleaseImportSourceKind sessionSourceKind,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        SuggestionLookup suggestions,
        FileMoveHintLookup moveHints,
        ProvenanceCandidates provenanceCandidates)
    {
        EnsureSourceKindsAgree(sessionSourceKind, draft.SourceKind, "release import session and draft");

        return new ReleaseImportDraftResponse(
            draft.Id.Value,
            SourceKindCode(draft.SourceKind),
            OptionalReference(draft.SourcePath),
            OptionalReference(draft.RelativePath),
            DraftStatusCode(draft.Status),
            draft.Title,
            draft.Type,
            draft.CatalogNumber,
            draft.LabelName,
            draft.ReleaseDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            draft.Year,
            draft.IsVariousArtists,
            draft.NotOnLabel,
            draft.CreateCatalogTracks,
            draft.ArtistNames,
            [.. EffectiveArtistCredits(draft).Select(ToArtistCreditResponse)],
            draft.SelectedArtistIds,
            suggestions.ForArtists([.. EffectiveArtistCredits(draft).Select(credit => credit.Name)]),
            [.. EffectiveLabels(draft).Select(ToLabelResponse)],
            draft.Genres,
            draft.Tags,
            ReleaseImportProviderReferenceMapper.ToResponses(draft.ExternalSources),
            draft.CoverPath,
            [.. draft.Issues.Select(ToIssueResponse)],
            [.. tracks
                .Where(track => track.DraftId == draft.Id)
                .Select(track => ToTrackResponse(draft.SourceKind, track, suggestions, moveHints))],
            ReleaseImportExternalReviewMapper.ToBindingDto(draft),
            ReleaseImportExternalReviewMapper.ToLocalSelectionDto(draft),
            draft.ExternalReviewRevision,
            ReleaseImportExternalReviewMapper.ToIntentDto(draft),
            provenanceCandidates.Releases,
            provenanceCandidates.Tracks);
    }

    private static async Task<ProvenanceCandidates> LoadProvenanceCandidatesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        CancellationToken cancellationToken)
    {
        if (draft.SelectedOriginalBinding is not PresentOptionalValue<SelectedOriginalBinding> present)
        {
            return ProvenanceCandidates.Empty;
        }

        SelectedOriginalBinding binding = present.Value;
        List<ReleaseImportProviderReference> releaseSources =
        [
            binding.ReleaseRoute.MusicBrainzRelease
        ];
        _ = binding.ReleaseRoute.DiscogsRelease.Match(
            source =>
            {
                releaseSources.Add(source);
                return true;
            },
            () => true);
        List<ReleaseImportProviderReference> trackSources =
        [
            binding.RecordingSource,
            ExternalReleaseProviderReferenceFactory.MusicBrainzTrack(
                Guid.Parse(binding.MusicBrainzRow.TrackMbid))
        ];

        Guid[] releaseIds = await FindEntityIdsAsync(
            context,
            collectionId,
            "release_external_sources",
            releaseSources,
            cancellationToken);
        Guid[] trackIds = await FindEntityIdsAsync(
            context,
            collectionId,
            "track_external_sources",
            trackSources,
            cancellationToken);
        HashSet<Guid> releaseIdSet = [.. releaseIds];
        HashSet<Guid> trackIdSet = [.. trackIds];
        Release[] releases =
        [
            .. (await context.Releases.AsNoTracking()
                    .Where(release => release.CollectionId == collectionId)
                    .ToArrayAsync(cancellationToken))
                .Where(release => releaseIdSet.Contains(release.Id.Value))
        ];
        Track[] tracks =
        [
            .. (await context.Tracks.AsNoTracking()
                    .Where(track => track.CollectionId == collectionId)
                    .ToArrayAsync(cancellationToken))
                .Where(track => trackIdSet.Contains(track.Id.Value))
        ];
        return new(
            [.. releases
                .OrderBy(release => release.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(release => release.Id.Value)
                .Select(release => new ReleaseImportProvenanceCandidateDto(release.Id.Value, release.DisplayName))],
            [.. tracks
                .OrderBy(track => track.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(track => track.Id.Value)
                .Select(track => new ReleaseImportProvenanceCandidateDto(track.Id.Value, track.DisplayName))]);
    }

    private static async Task<Guid[]> FindEntityIdsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string tableName,
        IReadOnlyList<ReleaseImportProviderReference> sources,
        CancellationToken cancellationToken)
    {
        HashSet<Guid> ids = [];
        foreach (ReleaseImportProviderReference source in sources)
        {
            Guid[] matches = tableName == "release_external_sources"
                ? await context.Database.SqlQuery<Guid>($"""
                    SELECT release_id AS "Value"
                    FROM release_external_sources
                    WHERE collection_id = {collectionId.Value}
                      AND provider_name = {source.ProviderCode}
                      AND resource_type = {source.ResourceType}
                      AND external_id = {source.ExternalId}
                    """).ToArrayAsync(cancellationToken)
                : await context.Database.SqlQuery<Guid>($"""
                    SELECT track_id AS "Value"
                    FROM track_external_sources
                    WHERE collection_id = {collectionId.Value}
                      AND provider_name = {source.ProviderCode}
                      AND resource_type = {source.ResourceType}
                      AND external_id = {source.ExternalId}
                    """).ToArrayAsync(cancellationToken);
            ids.UnionWith(matches);
        }

        return [.. ids];
    }

    private sealed record ProvenanceCandidates(
        IReadOnlyList<ReleaseImportProvenanceCandidateDto> Releases,
        IReadOnlyList<ReleaseImportProvenanceCandidateDto> Tracks)
    {
        public static ProvenanceCandidates Empty { get; } = new([], []);
    }

}
