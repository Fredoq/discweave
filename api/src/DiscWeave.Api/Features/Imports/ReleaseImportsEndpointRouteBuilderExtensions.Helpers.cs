using DiscWeave.Api.Features.Settings;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task<ReleaseImportSession?> FindSessionAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        return await context.ReleaseImportSessions.SingleOrDefaultAsync(
            session => session.CollectionId == collectionId && session.Id == new ReleaseImportSessionId(sessionId),
            cancellationToken);
    }

    private static async Task<ReleaseImportDraft?> FindDraftAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        CancellationToken cancellationToken)
    {
        return await context.ReleaseImportDrafts.SingleOrDefaultAsync(
            draft => draft.CollectionId == collectionId &&
                draft.SessionId == new ReleaseImportSessionId(sessionId) &&
                draft.Id == new ReleaseImportDraftId(draftId),
            cancellationToken);
    }

    private static DateOnly? ParseOptionalDate(string? releaseDate)
    {
        return string.IsNullOrWhiteSpace(releaseDate) ? null : ParseRequiredDate(releaseDate.Trim());
    }

    private static async Task ApplyDraftUpdateAsync(
        ReleaseImportDraftUpdateRequest request,
        ReleaseImportDraft draft,
        DiscWeaveDbContext context,
        CancellationToken cancellationToken)
    {
        DateOnly? releaseDate = ParseOptionalDate(request.ReleaseDate);
        if (draft.SourceKind == ReleaseImportSourceKind.ExternalMetadata)
        {
            ReleaseImportExternalReviewMapper.ApplyEditableReviewState(request, draft);
            ReleaseImportProviderReferenceMapper.EnsureEqualEcho(request.ExternalSources, draft.ExternalSources);
            await EnsureTrackExternalSourceEchoesAsync(request, draft, context, cancellationToken);
        }
        else if (request.ExternalSources is not null)
        {
            draft.UnionAuthoritativeExternalSources(
                ReleaseImportProviderReferenceMapper.ToDomain(request.ExternalSources));
        }

        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            request.Title,
            request.Type ?? "unknown",
            ToOptional(request.CatalogNumber),
            ToOptional(request.LabelName),
            ToOptional(releaseDate),
            ToOptional(request.Year),
            request.IsVariousArtists,
            request.NotOnLabel,
            ToOptional(request.CoverPath),
            request.ArtistNames ?? [],
            [.. request.ArtistCredits?.Select(ToImportArtistCredit) ?? []],
            [.. request.Labels?.Select(ToImportLabel) ?? []],
            request.SelectedArtistIds ?? [],
            request.Genres ?? [],
            request.Tags ?? [],
            request.CreateCatalogTracks ?? draft.CreateCatalogTracks,
            [.. draft.Issues.Where(issue => issue.Code != ImportIssueCodes.InvalidReleaseDate)]));
        await UpdateTracksAsync(request, draft, context, cancellationToken);
    }

    private static DateOnly ParseRequiredDate(string releaseDate)
    {
        return DateOnly.TryParseExact(releaseDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateOnly parsed)
            ? parsed
            : throw new DomainException("release_import.release_date_invalid", "Release date must use yyyy-MM-dd format");
    }

    private static IOptionalValue<string> ToOptional(string? value)
    {
        return value is null ? Optional.Missing<string>() : Optional.From(value);
    }

    private static IOptionalValue<T> ToOptional<T>(T? value)
        where T : struct
    {
        return value is { } present ? Optional.From(present) : Optional.Missing<T>();
    }

    private static ReleaseImportRelationSuggestionDecision ParseRelationSuggestionDecision(string? decision)
    {
        return decision?.Trim() switch
        {
            "pending" => ReleaseImportRelationSuggestionDecision.Pending,
            "accepted" => ReleaseImportRelationSuggestionDecision.Accepted,
            "rejected" => ReleaseImportRelationSuggestionDecision.Rejected,
            _ => throw new DomainException(
                "release_import_relation_suggestion.decision_invalid",
                "Relation suggestion decision is invalid")
        };
    }

    private static async Task<ReleaseImportRelationSuggestionPayload> ToValidatedRelationSuggestionPayloadAsync(
        ReleaseImportRelationSuggestionPayloadRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId owningDraftId,
        bool requireDraftTargetsInOwningDraft,
        CancellationToken cancellationToken)
    {
        if (request.Source is null)
        {
            throw new DomainException(
                "release_import_relation_suggestion.source_required",
                "Relation suggestion source is required");
        }

        ReleaseImportRelationSuggestionEndpoint source = await ToValidatedRelationSuggestionEndpointAsync(
            request.Source,
            context,
            collectionId,
            sessionId,
            requiredDraftId: owningDraftId,
            cancellationToken);
        ReleaseImportRelationSuggestionEndpoint? target = null;
        if (request.Target is not null)
        {
            target = await ToValidatedRelationSuggestionEndpointAsync(
                request.Target,
                context,
                collectionId,
                sessionId,
                requiredDraftId: requireDraftTargetsInOwningDraft ? owningDraftId : null,
                cancellationToken);
        }

        string? relationTypeCode = string.IsNullOrWhiteSpace(request.RelationTypeCode)
            ? null
            : await DictionaryValidation.RequireActiveCodeAsync(
                context,
                collectionId,
                DictionaryKind.TrackRelationType,
                request.RelationTypeCode,
                "release_import_relation_suggestion.relation_type_invalid",
                "Relation suggestion relation type is invalid",
                cancellationToken);

        return new ReleaseImportRelationSuggestionPayload(source, target, relationTypeCode);
    }

    private static async Task<ReleaseImportRelationSuggestionEndpoint> ToValidatedRelationSuggestionEndpointAsync(
        ReleaseImportRelationSuggestionEndpointRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId? requiredDraftId,
        CancellationToken cancellationToken)
    {
        ReleaseImportRelationSuggestionEndpointKind kind = ParseRelationSuggestionEndpointKind(request.Kind);
        if (request.Id == Guid.Empty)
        {
            throw new DomainException(
                "release_import_relation_suggestion.endpoint_id_required",
                "Relation suggestion endpoint id is required");
        }

        if (kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack)
        {
            var draftTrackId = new ReleaseImportDraftTrackId(request.Id);
            ReleaseImportDraftTrack? draftTrack = await context.ReleaseImportDraftTracks.SingleOrDefaultAsync(
                track =>
                    track.CollectionId == collectionId &&
                    track.Id == draftTrackId &&
                    context.ReleaseImportDrafts.Any(draft =>
                        draft.CollectionId == collectionId &&
                        draft.SessionId == sessionId &&
                        (!requiredDraftId.HasValue || draft.Id == requiredDraftId.Value) &&
                        draft.Id == track.DraftId),
                cancellationToken)
                ?? throw new DomainException(
                    "release_import_relation_suggestion.draft_track_not_found",
                    "Relation suggestion draft track was not found");

            if (draftTrack.TrackMode == ReleaseImportTrackMode.ReleaseOnly)
            {
                throw new DomainException(
                    "release_import_relation.release_only",
                    "Relation suggestion references a release-only tracklist row");
            }
        }
        else
        {
            var trackId = new TrackId(request.Id);
            bool exists = await context.Tracks.AnyAsync(
                track => track.CollectionId == collectionId && track.Id == trackId,
                cancellationToken);
            if (!exists)
            {
                throw new DomainException(
                    "release_import_relation_suggestion.track_not_found",
                    "Relation suggestion existing track was not found");
            }
        }

        return kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack
            ? ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(new ReleaseImportDraftTrackId(request.Id))
            : ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(new TrackId(request.Id));
    }

    private static ReleaseImportRelationSuggestionEndpointKind ParseRelationSuggestionEndpointKind(string? kind)
    {
        return kind?.Trim() switch
        {
            "draftTrack" => ReleaseImportRelationSuggestionEndpointKind.DraftTrack,
            "existingTrack" => ReleaseImportRelationSuggestionEndpointKind.ExistingTrack,
            _ => throw new DomainException(
                "release_import_relation_suggestion.endpoint_kind_invalid",
                "Relation suggestion endpoint kind is invalid")
        };
    }
}
