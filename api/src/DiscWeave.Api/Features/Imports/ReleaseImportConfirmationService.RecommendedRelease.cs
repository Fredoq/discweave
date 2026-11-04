using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private async Task ConfirmRecommendedReleaseAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSession session,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        CancellationToken cancellationToken)
    {
        await RecommendedReleaseImport.ValidateAsync(session, draft, tracks,
            _externalBindingValidator, context, cancellationToken);
        IReadOnlyList<ExternalSourceReference> sources = ReleaseImportProviderReferenceCatalogMapper.ToCatalog(
            draft.ExternalSources, _timeProvider.GetUtcNow());
        Release release = await CreateReleaseAsync(context, collectionId, draft, tracks, [], sources, cancellationToken);
        ReleaseTrack[] rows = [.. release.Tracklist];
        for (int index = 0; index < tracks.Length; index++)
        {
            ReleaseImportDraftTrack track = tracks[index];
            _ = rows[index].UpdatePlacement(TrackPosition.FromNumber(track.Position ?? (index + 1),
                track.Disc ?? string.Empty, track.Side ?? string.Empty), rows[index].TitleOverride);
        }

        release.ReplaceTracklist(rows);
        await MaterializeExternalCollectionItemAsync(context, collectionId, release, draft, cancellationToken);
        draft.Confirm(release.Id);
        await UpdateSessionStatusAsync(context, session, draft, cancellationToken);
    }
}
