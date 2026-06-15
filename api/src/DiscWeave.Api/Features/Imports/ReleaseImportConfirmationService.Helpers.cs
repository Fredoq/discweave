using DiscWeave.Api.Features.Credits;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static readonly CreditArtistResolverErrors ImportReleaseCreditArtistErrors = new(
        "release_import.artist_conflict",
        "Release import artist does not exist",
        "release_import.artist_name_required",
        "Release import artist name is required");

    private static async Task<IReadOnlyList<Artist>> ResolveArtistsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<string> names,
        IReadOnlyList<Guid> selectedIds,
        CancellationToken cancellationToken)
    {
        List<Artist> artists = [];
        for (int index = 0; index < names.Count; index++)
        {
            string name = names[index];
            Artist? artist = index < selectedIds.Count
                ? await context.Artists.SingleOrDefaultAsync(candidate => candidate.CollectionId == collectionId && candidate.Id == new ArtistId(selectedIds[index]), cancellationToken)
                : await FindArtistByNameAsync(context, collectionId, name, cancellationToken);

            if (artist is null)
            {
                artist = Person.Create(collectionId, ArtistId.New(), name);
                _ = context.Artists.Add(artist);
            }

            artists.Add(artist);
        }

        return artists;
    }

    private static async Task<Artist?> FindArtistByNameAsync(DiscWeaveDbContext context, CollectionId collectionId, string name, CancellationToken cancellationToken)
    {
        string normalized = Normalize(name);
        Artist[] artists = await context.Artists.Where(artist => artist.CollectionId == collectionId).ToArrayAsync(cancellationToken);

        return artists.FirstOrDefault(artist => Normalize(artist.Name) == normalized);
    }

    private static async Task<Artist> ResolveArtistCreditAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportArtistCredit credit,
        CancellationToken cancellationToken)
    {
        return await CreditArtistResolver.ResolveAsync(
            credit.ArtistId,
            credit.Name,
            context,
            collectionId,
            ImportReleaseCreditArtistErrors,
            cancellationToken);
    }

    private static IReadOnlyList<ReleaseImportArtistCredit> EffectiveArtistCredits(ReleaseImportDraft draft)
    {
        return draft.ArtistCredits.Count > 0
            ? draft.ArtistCredits
            : [.. draft.ArtistNames.Select((name, index) => new ReleaseImportArtistCredit(
                index < draft.SelectedArtistIds.Count ? draft.SelectedArtistIds[index] : null,
                name,
                MainArtistRole))];
    }

    private static IReadOnlyList<ReleaseImportArtistCredit> MainArtistCredits(ReleaseImportDraft draft)
    {
        ReleaseImportArtistCredit[] mainCredits =
        [
            .. EffectiveArtistCredits(draft).Where(credit =>
                string.Equals(credit.Role, MainArtistRole, StringComparison.Ordinal) ||
                string.Equals(credit.Role, "Main artist", StringComparison.OrdinalIgnoreCase))
        ];

        return mainCredits.Length > 0 ? mainCredits : EffectiveArtistCredits(draft);
    }

    private static async Task AddReleaseCreditsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        ReleaseImportDraft draft,
        CancellationToken cancellationToken)
    {
        if (draft.IsVariousArtists)
        {
            return;
        }

        foreach (ReleaseImportArtistCredit credit in EffectiveArtistCredits(draft))
        {
            Artist artist = await ResolveArtistCreditAsync(context, collectionId, credit, cancellationToken);
            string role = await DictionaryValidation.RequireActiveCodeAsync(
                context,
                collectionId,
                DictionaryKind.CreditRole,
                CreditMapper.ParseRole(string.IsNullOrWhiteSpace(credit.Role) ? MainArtistRole : credit.Role),
                "credit.role_invalid",
                "Credit role is invalid",
                cancellationToken);

            _ = context.Credits.Add(Credit.Create(
                collectionId,
                CreditId.New(),
                CreditContributor.FromArtist(artist),
                CreditTarget.ForRelease(release.Id),
                role));
        }
    }

    private static async Task<Track> ResolveTrackAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraftTrack draftTrack,
        CancellationToken cancellationToken)
    {
        if (draftTrack.SelectedTrackId is { } selectedTrackId)
        {
            Track? existing = await context.Tracks.SingleOrDefaultAsync(
                track => track.CollectionId == collectionId && track.Id == selectedTrackId,
                cancellationToken);

            return existing ?? throw new DomainException("release_import.selected_track_not_found", "Selected import track was not found");
        }

        var track = Track.Create(collectionId, TrackId.New(), draftTrack.Title);
        if (draftTrack.Duration is { } duration)
        {
            track.UpdateDetails(track.Details.WithDuration(duration));
        }

        _ = context.Tracks.Add(track);
        return track;
    }

    private static string Normalize(string value)
    {
        return string.Join(' ', value.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static Dictionary<ReleaseImportDraftTrackId, TrackId> CreateSelectedTrackMap(
        IEnumerable<ReleaseImportDraftTrack> draftTracks)
    {
        return draftTracks
            .Where(track => track.SelectedTrackId.HasValue)
            .ToDictionary(track => track.Id, track => track.SelectedTrackId!.Value);
    }

    private static async Task<IReadOnlyList<ImportReviewIssue>> AddAcceptedTrackRelationsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraft draft,
        IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        CancellationToken cancellationToken)
    {
        ReleaseImportRelationSuggestion[] acceptedSuggestions = await context.ReleaseImportRelationSuggestions.AsNoTracking()
            .Where(suggestion =>
                suggestion.CollectionId == collectionId &&
                suggestion.SessionId == sessionId &&
                suggestion.DraftId == draft.Id &&
                suggestion.Decision == ReleaseImportRelationSuggestionDecision.Accepted)
            .OrderBy(suggestion => suggestion.Id)
            .ToArrayAsync(cancellationToken);
        if (acceptedSuggestions.Length == 0)
        {
            return [];
        }

        TrackRelation[] existingRelations = await context.TrackRelations.AsNoTracking()
            .Where(relation => relation.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        HashSet<TrackRelationIdentity> relationIdentities =
        [
            .. existingRelations.Select(relation => new TrackRelationIdentity(
                relation.SourceTrackId,
                relation.TargetTrackId,
                relation.RelationType)),
            .. context.TrackRelations.Local
                .Where(relation => relation.CollectionId == collectionId)
                .Select(relation => new TrackRelationIdentity(
                    relation.SourceTrackId,
                    relation.TargetTrackId,
                    relation.RelationType))
        ];

        List<ImportReviewIssue> warnings = [];
        foreach (ReleaseImportRelationSuggestion suggestion in acceptedSuggestions)
        {
            ReleaseImportRelationSuggestionPayload payload = suggestion.ReviewedPayload;
            TrackId sourceTrackId = ResolveRelationEndpoint(payload.Source, resolvedTrackIdsByDraftTrackId);
            if (payload.Target is null || string.IsNullOrWhiteSpace(payload.RelationTypeCode))
            {
                continue;
            }

            TrackId targetTrackId = ResolveRelationEndpoint(payload.Target, resolvedTrackIdsByDraftTrackId);
            if (sourceTrackId == targetTrackId)
            {
                warnings.Add(new ImportReviewIssue(
                    "release_import_relation.self_resolved",
                    "Accepted relation suggestion resolved to the same track and was skipped"));
                continue;
            }

            var relationIdentity = new TrackRelationIdentity(sourceTrackId, targetTrackId, payload.RelationTypeCode);
            if (relationIdentities.Contains(relationIdentity))
            {
                warnings.Add(new ImportReviewIssue(
                    "release_import_relation.duplicate",
                    "Accepted relation suggestion duplicated an existing track relation and was skipped"));
                continue;
            }

            _ = context.TrackRelations.Add(TrackRelation.Create(
                TrackRelationId.New(),
                collectionId,
                sourceTrackId,
                targetTrackId,
                payload.RelationTypeCode));
            _ = relationIdentities.Add(relationIdentity);
        }

        return warnings;
    }

    private static TrackId ResolveRelationEndpoint(
        ReleaseImportRelationSuggestionEndpoint endpoint,
        IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId)
    {
        return endpoint.Kind switch
        {
            ReleaseImportRelationSuggestionEndpointKind.ExistingTrack => new TrackId(endpoint.TrackId),
            ReleaseImportRelationSuggestionEndpointKind.DraftTrack => resolvedTrackIdsByDraftTrackId.TryGetValue(
                new ReleaseImportDraftTrackId(endpoint.TrackId),
                out TrackId trackId)
                ? trackId
                : throw new DomainException(
                    "release_import_relation.draft_track_unresolved",
                    "Accepted relation suggestion references an unresolved draft track"),
            _ => throw new DomainException(
                "release_import_relation.endpoint_kind_invalid",
                "Accepted relation suggestion endpoint kind is invalid")
        };
    }

    private static void AppendDraftIssues(ReleaseImportDraft draft, IReadOnlyList<ImportReviewIssue> issues)
    {
        if (issues.Count == 0)
        {
            return;
        }

        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            draft.Title,
            draft.Type,
            ToOptionalText(draft.CatalogNumber),
            ToOptionalText(draft.LabelName),
            ToOptionalDate(draft.ReleaseDate),
            ToOptionalInt(draft.Year),
            draft.IsVariousArtists,
            draft.NotOnLabel,
            ToOptionalText(draft.CoverPath),
            draft.ArtistNames,
            draft.ArtistCredits,
            draft.Labels,
            draft.SelectedArtistIds,
            draft.Genres,
            draft.Tags,
            draft.ExternalSources,
            [.. draft.Issues, .. issues]));
    }

    private static IOptionalValue<string> ToOptionalText(string? value)
    {
        return value is null ? Optional.Missing<string>() : Optional.From(value);
    }

    private static IOptionalValue<DateOnly> ToOptionalDate(DateOnly? value)
    {
        return value.HasValue ? Optional.From(value.Value) : Optional.Missing<DateOnly>();
    }

    private static IOptionalValue<int> ToOptionalInt(int? value)
    {
        return value.HasValue ? Optional.From(value.Value) : Optional.Missing<int>();
    }

    private readonly record struct TrackRelationIdentity(TrackId SourceTrackId, TrackId TargetTrackId, string RelationType);
}
