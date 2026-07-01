using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Importing;
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
            session.SourceRoot,
            StatusCode(session.Status),
            ScanModeCode(session.ScanMode),
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
            .OrderBy(draft => draft.RelativePath)
            .ToArrayAsync(cancellationToken);
        ReleaseImportDraftId[] draftIds = [.. drafts.Select(draft => draft.Id)];
        ReleaseImportDraftTrack[] tracks = draftIds.Length == 0
            ? []
            : await context.ReleaseImportDraftTracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId && draftIds.Contains(track.DraftId))
            .OrderBy(track => track.Position ?? 9999)
            .ThenBy(track => track.RelativePath)
            .ToArrayAsync(cancellationToken);
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

        return ToSessionResponse(session, diagnostics, looseFileCandidates, moveHints) with
        {
            Drafts = [.. drafts.Select(draft => ToDraftResponse(draft, tracks, suggestions, moveHints))],
            RelationSuggestions = [.. relationSuggestions.Select(suggestion => ToRelationSuggestionResponse(suggestion, relationTargetLookup))]
        };
    }

    private static ReleaseImportDraftResponse ToDraftResponse(
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        SuggestionLookup suggestions,
        FileMoveHintLookup moveHints)
    {
        return new ReleaseImportDraftResponse(
            draft.Id.Value,
            draft.SourcePath,
            draft.RelativePath,
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
            ExternalSourceReferenceMapper.ToResponses(draft.ExternalSources),
            draft.CoverPath,
            [.. draft.Issues.Select(ToIssueResponse)],
            [.. tracks.Where(track => track.DraftId == draft.Id).Select(track => ToTrackResponse(track, suggestions, moveHints))]);
    }

    private static IReadOnlyList<ReleaseImportArtistCredit> EffectiveArtistCredits(ReleaseImportDraft draft)
    {
        return draft.ArtistCredits.Count > 0
            ? draft.ArtistCredits
            : [.. draft.ArtistNames.Select((name, index) => new ReleaseImportArtistCredit(
                index < draft.SelectedArtistIds.Count ? draft.SelectedArtistIds[index] : null,
                name,
                "mainArtist"))];
    }

    private static IReadOnlyList<ReleaseImportLabel> EffectiveLabels(ReleaseImportDraft draft)
    {
        if (draft.Labels.Count > 0)
        {
            return draft.Labels;
        }

        IReadOnlyList<ReleaseImportLabel> labels = [];
        if (!string.IsNullOrWhiteSpace(draft.LabelName))
        {
            labels =
            [
                new ReleaseImportLabel(
                    null,
                    draft.LabelName,
                    draft.CatalogNumber,
                    string.IsNullOrWhiteSpace(draft.CatalogNumber))
            ];
        }

        return labels;
    }

    private static ReleaseImportArtistCreditResponse ToArtistCreditResponse(ReleaseImportArtistCredit credit)
    {
        return new ReleaseImportArtistCreditResponse(
            credit.ArtistId,
            credit.Name,
            credit.Role,
            ToArtistCreditExternalSourceResponse(credit.ExternalSource));
    }

    private static ReleaseImportArtistCreditExternalSourceResponse? ToArtistCreditExternalSourceResponse(
        ReleaseImportArtistCreditExternalSource? source)
    {
        return source is null
            ? null
            : new ReleaseImportArtistCreditExternalSourceResponse(
                source.ProviderName,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl);
    }

    private static ReleaseImportLabelResponse ToLabelResponse(ReleaseImportLabel label)
    {
        return new ReleaseImportLabelResponse(label.LabelId, label.Name, label.CatalogNumber, label.HasNoCatalogNumber);
    }

    private static ReleaseImportLooseFileCandidateResponse ToLooseFileCandidateResponse(
        ReleaseImportLooseFileCandidate candidate)
    {
        return new ReleaseImportLooseFileCandidateResponse(
            candidate.Id.Value,
            candidate.FilePath,
            candidate.RelativePath,
            ReleaseImportFileRules.FormatCode(candidate.Format),
            candidate.SizeBytes,
            candidate.LastModifiedAt,
            candidate.ContentHash,
            candidate.Duration is null ? null : (int)candidate.Duration.Value.TotalSeconds,
            candidate.Codec,
            QualityCode(candidate.Quality),
            candidate.BitrateKbps,
            candidate.SampleRateHz,
            candidate.Channels,
            candidate.TitleHint,
            candidate.ArtistHints,
            candidate.AlbumTitleHint,
            candidate.AlbumArtistHints,
            candidate.TrackNumber,
            candidate.Reason,
            candidate.Decision,
            candidate.SourceDraftId?.Value,
            candidate.SourceDraftTrackId?.Value,
            candidate.CreatedAt,
            candidate.UpdatedAt,
            null);
    }

    private static ReleaseImportLooseFileCandidateResponse ToLooseFileCandidateResponse(
        ReleaseImportLooseFileCandidate candidate,
        FileMoveHintLookup moveHints)
    {
        return ToLooseFileCandidateResponse(candidate) with
        {
            MoveHint = moveHints.ForPath(candidate.FilePath)
        };
    }

    private static ReleaseImportDraftTrackResponse ToTrackResponse(
        ReleaseImportDraftTrack track,
        SuggestionLookup suggestions,
        FileMoveHintLookup moveHints)
    {
        return new ReleaseImportDraftTrackResponse(
            track.Id.Value,
            track.FilePath,
            track.RelativePath,
            ReleaseImportFileRules.FormatCode(track.Format),
            track.SizeBytes,
            track.LastModifiedAt,
            track.Duration is null ? null : (int)track.Duration.Value.TotalSeconds,
            track.Position,
            track.Disc,
            track.Side,
            track.Title,
            track.VersionYear,
            track.ArtistNames,
            [.. EffectiveTrackArtistCredits(track).Select(ToArtistCreditResponse)],
            track.InheritReleaseArtistCredits,
            suggestions.ForArtists([.. EffectiveTrackArtistCredits(track).Select(credit => credit.Name)]),
            suggestions.ForTracks(track.Title),
            TrackModeCode(track.TrackMode),
            track.IsSkipped,
            track.SelectedTrackId?.Value,
            track.SelectedArtistIds,
            [.. track.Issues.Select(ToIssueResponse)],
            moveHints.ForPath(track.FilePath));
    }

    private static IReadOnlyList<ReleaseImportArtistCredit> EffectiveTrackArtistCredits(ReleaseImportDraftTrack track)
    {
        return track.ArtistCredits.Count > 0
            ? track.ArtistCredits
            : [.. track.ArtistNames.Select((name, index) => new ReleaseImportArtistCredit(
                index < track.SelectedArtistIds.Count ? track.SelectedArtistIds[index] : null,
                name,
                "mainArtist"))];
    }

    private static ImportIssueResponse ToIssueResponse(ImportReviewIssue issue)
    {
        return new ImportIssueResponse(issue.Code, issue.Message, IssueSeverityCode(issue.Severity));
    }
}
