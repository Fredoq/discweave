using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task UpdateTracksAsync(
        ReleaseImportDraftUpdateRequest request,
        ReleaseImportDraft draft,
        DiscWeaveDbContext context,
        CancellationToken cancellationToken)
    {
        if (request.Tracks is null)
        {
            return;
        }

        ReleaseImportDraftTrack[] tracks = await context.ReleaseImportDraftTracks
            .Where(track => track.CollectionId == draft.CollectionId && track.DraftId == draft.Id)
            .ToArrayAsync(cancellationToken);
        Dictionary<Guid, ReleaseImportDraftTrack> tracksById = tracks.ToDictionary(track => track.Id.Value);
        TrackId[] requestedSelectedTrackIds =
        [
            .. request.Tracks
                .Select(track => track.SelectedTrackId)
                .Where(id => id.HasValue)
                .Select(id => new TrackId(id!.Value)) // NOSONAR: HasValue was checked immediately before projection.
                .Distinct()
        ];
        HashSet<TrackId> existingSelectedTrackIds = requestedSelectedTrackIds.Length == 0
            ? []
            :
            [
                .. await context.Tracks
                    .Where(candidate =>
                        candidate.CollectionId == draft.CollectionId &&
                        requestedSelectedTrackIds.Contains(candidate.Id))
                    .Select(candidate => candidate.Id)
                    .ToArrayAsync(cancellationToken)
            ];

        foreach (ReleaseImportDraftTrackUpdateRequest trackRequest in request.Tracks)
        {
            if (!tracksById.TryGetValue(trackRequest.Id, out ReleaseImportDraftTrack? track))
            {
                throw new DomainException("release_import.track_not_found", "Release import draft track was not found");
            }

            TrackId? selectedTrackId = trackRequest.SelectedTrackId is null
                ? null
                : new TrackId(trackRequest.SelectedTrackId.Value);
            ReleaseImportTrackMode trackMode = ParseTrackMode(
                trackRequest.TrackMode,
                selectedTrackId,
                draft.CreateCatalogTracks);
            if (selectedTrackId is { } trackId && !existingSelectedTrackIds.Contains(trackId))
            {
                throw new DomainException(
                    "release_import.selected_track_not_found",
                    "Selected import track was not found");
            }

            var fields = new DraftTrackEditableFields(
                trackRequest.Position,
                trackRequest.Disc,
                trackRequest.Side,
                trackRequest.Title,
                trackRequest.DurationSeconds is null ? null : TimeSpan.FromSeconds(trackRequest.DurationSeconds.Value),
                trackRequest.VersionYear ?? draft.Year,
                trackRequest.ArtistNames ?? [],
                [.. trackRequest.ArtistCredits?.Select(ToImportArtistCredit) ?? []],
                trackRequest.InheritReleaseArtistCredits ?? ShouldDefaultTrackInheritance(trackRequest),
                trackRequest.SelectedArtistIds ?? [],
                trackMode,
                selectedTrackId,
                trackRequest.IsSkipped,
                track.Issues,
                trackRequest.IsOriginal);
            if (track.SourceKind == ReleaseImportSourceKind.ExternalMetadata)
            {
                draft.ApplyExternalTrackReviewEdit(track, fields);
            }
            else
            {
                if (trackRequest.ExternalSources is not null)
                {
                    track.UnionAuthoritativeExternalSources(
                        ReleaseImportProviderReferenceMapper.ToDomain(trackRequest.ExternalSources));
                }

                track.UpdateEditableFields(fields);
            }
        }
    }
}
