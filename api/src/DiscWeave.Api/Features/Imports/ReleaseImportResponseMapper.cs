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
            looseFileCandidates is null ? null : [.. looseFileCandidates.Select(ToLooseFileCandidateResponse)],
            null,
            null);
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
        var relationTargetLookup = RelationTargetLookup.Create(tracks, suggestions.ExistingTracks);

        return ToSessionResponse(session, diagnostics, looseFileCandidates) with
        {
            Drafts = [.. drafts.Select(draft => ToDraftResponse(draft, tracks, suggestions))],
            RelationSuggestions = [.. relationSuggestions.Select(suggestion => ToRelationSuggestionResponse(suggestion, relationTargetLookup))]
        };
    }

    private static ReleaseImportDraftResponse ToDraftResponse(
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        SuggestionLookup suggestions)
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
            [.. tracks.Where(track => track.DraftId == draft.Id).Select(track => ToTrackResponse(track, suggestions))]);
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
        return new ReleaseImportArtistCreditResponse(credit.ArtistId, credit.Name, credit.Role);
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
            candidate.UpdatedAt);
    }

    private static ReleaseImportDraftTrackResponse ToTrackResponse(ReleaseImportDraftTrack track, SuggestionLookup suggestions)
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
            track.ArtistNames,
            [.. EffectiveTrackArtistCredits(track).Select(ToArtistCreditResponse)],
            track.InheritReleaseArtistCredits,
            suggestions.ForArtists([.. EffectiveTrackArtistCredits(track).Select(credit => credit.Name)]),
            suggestions.ForTracks(track.Title),
            track.IsSkipped,
            track.SelectedTrackId?.Value,
            track.SelectedArtistIds,
            [.. track.Issues.Select(ToIssueResponse)]);
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

    private static ReleaseImportRelationSuggestionResponse ToRelationSuggestionResponse(
        ReleaseImportRelationSuggestion suggestion,
        RelationTargetLookup targetLookup)
    {
        ReleaseImportRelationSuggestionPayload suggestedPayload = suggestion.SuggestedPayload;
        ReleaseImportRelationSuggestionPayload reviewedPayload = suggestion.ReviewedPayload;

        return new ReleaseImportRelationSuggestionResponse(
            suggestion.Id.Value,
            suggestion.DraftId.Value,
            suggestion.Token,
            suggestion.Confidence,
            DecisionCode(suggestion.Decision),
            ToRelationSuggestionPayloadResponse(suggestedPayload),
            ToRelationSuggestionPayloadResponse(reviewedPayload),
            targetLookup.ForSuggestion(suggestedPayload),
            !RelationPayloadEquals(suggestedPayload, reviewedPayload));
    }

    private static ReleaseImportRelationSuggestionPayloadResponse ToRelationSuggestionPayloadResponse(
        ReleaseImportRelationSuggestionPayload payload)
    {
        return new ReleaseImportRelationSuggestionPayloadResponse(
            ToRelationSuggestionEndpointResponse(payload.Source),
            payload.Target is null ? null : ToRelationSuggestionEndpointResponse(payload.Target),
            payload.RelationTypeCode ?? string.Empty);
    }

    private static ReleaseImportRelationSuggestionEndpointResponse ToRelationSuggestionEndpointResponse(
        ReleaseImportRelationSuggestionEndpoint endpoint)
    {
        return new ReleaseImportRelationSuggestionEndpointResponse(
            EndpointKindCode(endpoint.Kind),
            endpoint.TrackId);
    }

    private static bool RelationPayloadEquals(
        ReleaseImportRelationSuggestionPayload left,
        ReleaseImportRelationSuggestionPayload right)
    {
        return left.Source == right.Source &&
            left.Target == right.Target &&
            string.Equals(left.RelationTypeCode, right.RelationTypeCode, StringComparison.Ordinal);
    }

}
