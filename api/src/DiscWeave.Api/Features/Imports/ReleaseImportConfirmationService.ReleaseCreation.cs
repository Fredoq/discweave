using DiscWeave.Api.Features.Settings;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private async Task<Release> CreateReleaseAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        CancellationToken cancellationToken)
    {
        string releaseType = await DictionaryValidation.ResolveOrCreateActiveCodeAsync(
            context,
            collectionId,
            DictionaryKind.ReleaseType,
            draft.Type,
            "release.type_invalid",
            "Release type is invalid",
            cancellationToken);
        IReadOnlyList<string> genres = await ResolveGenreCodesAsync(
            context,
            collectionId,
            draft.Genres,
            cancellationToken);
        var release = Release.Create(collectionId, ReleaseId.New(), draft.Title);
        ReleaseMetadata metadata = ReleaseMetadata.Empty.WithType(releaseType);

        if (draft.Year is { } year)
        {
            metadata = metadata.WithReleaseYear(year);
        }

        if (draft.ReleaseDate is { } releaseDate)
        {
            metadata = metadata.WithReleaseDate(releaseDate);
        }

        metadata = await ApplyCoverAsync(metadata, release.Id, collectionId, draft, cancellationToken);
        release.UpdateSummary(release.Summary.WithMetadata(metadata));
        release.UpdateArtistDisplay(draft.IsVariousArtists);
        release.UpdateCataloging(CatalogingMapper.Create(genres, draft.Tags));
        release.UpdateLabels(draft.NotOnLabel, await ResolveLabelsAsync(context, collectionId, draft, cancellationToken));
        release.ReplaceExternalSources(draft.ExternalSources);

        _ = context.Releases.Add(release);
        var artistSourceCache = new ImportArtistSourceResolutionCache();
        await AddReleaseCreditsAsync(context, collectionId, release, draft, artistSourceCache, cancellationToken);
        Dictionary<ReleaseImportDraftTrackId, ReleaseTrackId> resolvedReleaseTrackIdsByDraftTrackId = [];
        await AddTracksAsync(
            new TrackMaterializationScope(context, collectionId, draft, artistSourceCache),
            release,
            draftTracks,
            new ResolvedTrackMaps(resolvedTrackIdsByDraftTrackId, resolvedReleaseTrackIdsByDraftTrackId),
            cancellationToken);
        if (draft.SourceKind == ReleaseImportSourceKind.LocalFiles)
        {
            await AddReleaseFileLinksAsync(
                context,
                collectionId,
                release,
                draftTracks,
                resolvedTrackIdsByDraftTrackId,
                resolvedReleaseTrackIdsByDraftTrackId,
                cancellationToken);
        }

        return release;
    }

    private static async Task<IReadOnlyList<string>> ResolveGenreCodesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<string>? genres,
        CancellationToken cancellationToken)
    {
        if (genres is null || genres.Count == 0)
        {
            return [];
        }

        string[] requestedCodes =
        [
            .. genres
                .Select(genre => string.IsNullOrWhiteSpace(genre)
                    ? throw new DomainException("release.genre_invalid", "Release genre is invalid")
                    : genre.Trim())
                .Distinct(StringComparer.Ordinal)
        ];

        var resolved = new List<string>(requestedCodes.Length);
        foreach (string code in requestedCodes)
        {
            resolved.Add(await DictionaryValidation.ResolveOrCreateActiveCodeAsync(
                context,
                collectionId,
                DictionaryKind.Genre,
                code,
                "release.genre_invalid",
                "Release genre is invalid",
                cancellationToken));
        }

        return resolved;
    }
}
