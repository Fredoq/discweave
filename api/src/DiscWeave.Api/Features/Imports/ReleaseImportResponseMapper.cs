using DiscWeave.Domain.Catalog;
using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Importing;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace DiscWeave.Api.Features.Imports;

internal static class ReleaseImportResponseMapper
{
    public static ReleaseImportSessionResponse ToSessionResponse(ReleaseImportSession session)
    {
        return new ReleaseImportSessionResponse(
            session.Id.Value,
            session.SourceRoot,
            StatusCode(session.Status),
            session.DraftCount,
            session.TrackCount,
            session.IgnoredFileCount,
            session.CreatedAt,
            session.UpdatedAt,
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
        var relationTargetLookup = RelationTargetLookup.Create(tracks, suggestions.ExistingTracks);

        return ToSessionResponse(session) with
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
            targetLookup.ForSource(suggestedPayload.Source.TrackId),
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

    private static string IssueSeverityCode(ImportReviewSeverity severity)
    {
        return severity switch
        {
            ImportReviewSeverity.Info => "info",
            ImportReviewSeverity.Warning => "warning",
            ImportReviewSeverity.Error => "error",
            _ => throw new InvalidOperationException("Import review issue severity is not supported")
        };
    }

    private static string StatusCode(ReleaseImportSessionStatus status)
    {
        return status switch
        {
            ReleaseImportSessionStatus.ReadyForReview => "readyForReview",
            ReleaseImportSessionStatus.Completed => "completed",
            _ => throw new InvalidOperationException("Release import session status is not supported")
        };
    }

    private static string DraftStatusCode(ReleaseImportDraftStatus status)
    {
        return status switch
        {
            ReleaseImportDraftStatus.NeedsReview => "needsReview",
            ReleaseImportDraftStatus.Ready => "ready",
            ReleaseImportDraftStatus.Confirmed => "confirmed",
            ReleaseImportDraftStatus.Skipped => "skipped",
            _ => throw new InvalidOperationException("Release import draft status is not supported")
        };
    }

    private static string DecisionCode(ReleaseImportRelationSuggestionDecision decision)
    {
        return decision switch
        {
            ReleaseImportRelationSuggestionDecision.Pending => "pending",
            ReleaseImportRelationSuggestionDecision.Accepted => "accepted",
            ReleaseImportRelationSuggestionDecision.Rejected => "rejected",
            _ => throw new InvalidOperationException("Release import relation suggestion decision is not supported")
        };
    }

    private static string EndpointKindCode(ReleaseImportRelationSuggestionEndpointKind kind)
    {
        return kind switch
        {
            ReleaseImportRelationSuggestionEndpointKind.DraftTrack => "draftTrack",
            ReleaseImportRelationSuggestionEndpointKind.ExistingTrack => "existingTrack",
            _ => throw new InvalidOperationException("Release import relation suggestion endpoint kind is not supported")
        };
    }

    private sealed class SuggestionLookup
    {
        private readonly Artist[] _artists;
        private readonly Track[] _tracks;

        private SuggestionLookup(Artist[] artists, Track[] tracks)
        {
            _artists = artists;
            _tracks = tracks;
        }

        public static async Task<SuggestionLookup> LoadAsync(DiscWeaveDbContext context, CollectionId collectionId, CancellationToken cancellationToken)
        {
            Artist[] artists = await context.Artists.AsNoTracking().Where(artist => artist.CollectionId == collectionId).ToArrayAsync(cancellationToken);
            Track[] tracks = await context.Tracks.AsNoTracking().Where(track => track.CollectionId == collectionId).ToArrayAsync(cancellationToken);

            return new SuggestionLookup(artists, tracks);
        }

        public IReadOnlyList<Track> ExistingTracks => _tracks;

        public IReadOnlyList<EntitySuggestionResponse> ForArtists(IReadOnlyList<string> names)
        {
            return [.. names.SelectMany(name => Match(_artists, name, artist => artist.Id.Value, artist => artist.Name)).DistinctBy(suggestion => suggestion.Id)];
        }

        public IReadOnlyList<EntitySuggestionResponse> ForTracks(string title)
        {
            return [.. Match(_tracks, title, track => track.Id.Value, track => track.Title).Take(5)];
        }

        private static IEnumerable<EntitySuggestionResponse> Match<T>(IEnumerable<T> entities, string value, Func<T, Guid> id, Func<T, string> name)
        {
            string normalized = Normalize(value);
            return entities
                .Select(entity => new { Entity = entity, Normalized = Normalize(name(entity)) })
                .Where(candidate => candidate.Normalized == normalized || candidate.Normalized.Contains(normalized, StringComparison.Ordinal))
                .Select(candidate => new EntitySuggestionResponse(id(candidate.Entity), name(candidate.Entity), candidate.Normalized == normalized ? "exact" : "close"));
        }

        private static string Normalize(string value)
        {
            return string.Join(' ', value.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }
    }

    private sealed class RelationTargetLookup
    {
        private readonly Dictionary<Guid, ReleaseImportDraftTrack> _draftTracksById;
        private readonly Dictionary<string, ReleaseImportDraftTrack[]> _draftTracksByNormalizedTitle;
        private readonly Dictionary<string, Track[]> _existingTracksByNormalizedTitle;

        private RelationTargetLookup(
            Dictionary<Guid, ReleaseImportDraftTrack> draftTracksById,
            Dictionary<string, ReleaseImportDraftTrack[]> draftTracksByNormalizedTitle,
            Dictionary<string, Track[]> existingTracksByNormalizedTitle)
        {
            _draftTracksById = draftTracksById;
            _draftTracksByNormalizedTitle = draftTracksByNormalizedTitle;
            _existingTracksByNormalizedTitle = existingTracksByNormalizedTitle;
        }

        public static RelationTargetLookup Create(IReadOnlyList<ReleaseImportDraftTrack> draftTracks, IReadOnlyList<Track> existingTracks)
        {
            return new RelationTargetLookup(
                draftTracks.ToDictionary(track => track.Id.Value),
                draftTracks
                    .Where(track => !track.IsSkipped)
                    .GroupBy(track => RelationSuggestionAnalyzer.NormalizeTitle(track.Title), StringComparer.Ordinal)
                    .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal),
                existingTracks
                    .GroupBy(track => RelationSuggestionAnalyzer.NormalizeTitle(track.Title), StringComparer.Ordinal)
                    .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal));
        }

        public IReadOnlyList<ReleaseImportRelationSuggestionEndpointResponse> ForSource(Guid sourceTrackId)
        {
            if (!_draftTracksById.TryGetValue(sourceTrackId, out ReleaseImportDraftTrack? sourceTrack))
            {
                return [];
            }

            RelationSuggestionAnalyzer.TitleToken? titleToken = RelationSuggestionAnalyzer.TrySplitLastParenthetical(sourceTrack.Title);
            if (titleToken is null)
            {
                return [];
            }

            string normalizedBaseTitle = RelationSuggestionAnalyzer.NormalizeTitle(titleToken.BaseTitle);
            ReleaseImportDraftTrack[] draftTargets = _draftTracksByNormalizedTitle.GetValueOrDefault(normalizedBaseTitle) ?? [];
            Track[] existingTargets = _existingTracksByNormalizedTitle.GetValueOrDefault(normalizedBaseTitle) ?? [];

            return
            [
                .. draftTargets
                    .Where(track => track.Id.Value != sourceTrackId)
                    .Select(track => new ReleaseImportRelationSuggestionEndpointResponse("draftTrack", track.Id.Value)),
                .. existingTargets.Select(track => new ReleaseImportRelationSuggestionEndpointResponse("existingTrack", track.Id.Value))
            ];
        }
    }
}
