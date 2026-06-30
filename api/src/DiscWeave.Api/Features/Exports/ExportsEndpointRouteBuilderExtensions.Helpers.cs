using DiscWeave.Api.Features.ArtistRelations;
using DiscWeave.Api.Features.OwnedItems;
using DiscWeave.Api.Features.Playlists;
using DiscWeave.Api.Features.Ratings;
using DiscWeave.Api.Features.Releases;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace DiscWeave.Api.Features.Exports;

public static partial class ExportsEndpointRouteBuilderExtensions
{
    private static async Task<IReadOnlyList<OwnedItemResponse>> LoadOwnedItemsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Domain.Collection.OwnedItem[] ownedItems =
        [
            .. await context.OwnedItems.AsNoTracking()
                .Where(item => item.CollectionId == collectionId)
                .OrderBy(item => item.Id)
                .ToArrayAsync(cancellationToken)
        ];

        return await OwnedItemResponseMapper.ToResponsesAsync(context, collectionId, ownedItems, cancellationToken);
    }

    private static async Task<IReadOnlyList<PlaylistResponse>> LoadPlaylistsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Domain.Playlists.Playlist[] playlists = await context.Playlists.AsNoTracking()
            .Include(playlist => playlist.Entries)
            .Where(playlist => playlist.CollectionId == collectionId)
            .OrderBy(playlist => playlist.Name)
            .ToArrayAsync(cancellationToken);
        List<PlaylistResponse> responses = new(playlists.Length);
        foreach (Domain.Playlists.Playlist playlist in playlists)
        {
            responses.Add(await PlaylistMapper.ToResponseAsync(playlist, context, cancellationToken));
        }

        return responses;
    }

    private static async Task<IReadOnlyList<ArtistRelationResponse>> LoadArtistRelationsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.ArtistRelations.AsNoTracking()
                .Where(relation => relation.CollectionId == collectionId)
                .ToArrayAsync(cancellationToken))
                .OrderBy(relation => relation.Id.Value)
                .Select(relation => ArtistRelationMapper.ToResponse(relation))
        ];
    }

    private static async Task<IReadOnlyList<TrackRelationResponse>> LoadTrackRelationsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.TrackRelations.AsNoTracking()
                .Where(relation => relation.CollectionId == collectionId)
                .ToArrayAsync(cancellationToken))
                .OrderBy(relation => relation.Id.Value)
                .Select(relation => TrackRelationMapper.ToResponse(relation))
        ];
    }

    private static async Task<IReadOnlyList<DictionaryEntryResponse>> LoadDictionariesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.CollectionDictionaryEntries.AsNoTracking()
                .Where(entry => entry.CollectionId == collectionId)
                .OrderBy(entry => entry.Kind)
                .ThenBy(entry => entry.SortOrder)
                .ThenBy(entry => entry.Name)
                .ToArrayAsync(cancellationToken))
                .Select(ToDictionaryResponse)
        ];
    }

    private static async Task<IReadOnlyList<RatingCriterionResponse>> LoadRatingCriteriaAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.RatingCriteria.AsNoTracking()
                .Where(criterion => criterion.CollectionId == collectionId)
                .OrderBy(criterion => criterion.SortOrder)
                .ThenBy(criterion => criterion.Name)
                .ToArrayAsync(cancellationToken))
                .Select(RatingEndpointHelpers.ToCriterionResponse)
        ];
    }

    private static async Task<IReadOnlyList<RatingValueResponse>> LoadRatingsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.RatingValues.AsNoTracking()
                .Where(rating => rating.CollectionId == collectionId)
                .ToArrayAsync(cancellationToken))
                .OrderBy(rating => rating.Id.Value)
                .Select(RatingEndpointHelpers.ToValueResponse)
        ];
    }

    private static CoverImageResponse? ToCoverImageResponse(Release release)
    {
        return release.Summary.Metadata.CoverImage is PresentOptionalValue<CoverImage> { Value: CoverImage coverImage }
            ? new CoverImageResponse(
                $"/api/releases/{release.Id.Value}/cover-image",
                coverImage.ContentType,
                coverImage.OriginalFileName,
                coverImage.SizeBytes,
                coverImage.SourceType)
            : null;
    }

    private static DictionaryEntryResponse ToDictionaryResponse(CollectionDictionaryEntry entry)
    {
        return new DictionaryEntryResponse(
            entry.Id.Value,
            DictionaryKindMapper.ToCode(entry.Kind),
            entry.Code,
            entry.Name,
            entry.SortOrder,
            entry.IsActive,
            entry.IsBuiltin,
            entry.IsProtected,
            OptionalString(entry.MediaProfile));
    }

    private static TrackRelationParserRuleResponse ToTrackRelationParserRuleResponse(TrackRelationParserRule rule)
    {
        return new TrackRelationParserRuleResponse(
            rule.Id.Value,
            rule.RelationTypeCode,
            rule.Alias,
            TrackRelationParserRuleMatchModeMapper.ToCode(rule.MatchMode),
            rule.Confidence,
            TrackRelationParserRuleDirectionMapper.ToCode(rule.Direction),
            rule.SortOrder,
            rule.IsActive,
            rule.IsBuiltin);
    }

    private static ImportPatternResponse ToImportPatternResponse(ImportPattern pattern)
    {
        return new ImportPatternResponse(
            pattern.Id.Value,
            ImportPatternKindMapper.ToCode(pattern.Kind),
            pattern.Template,
            pattern.SortOrder,
            pattern.IsActive,
            pattern.IsBuiltin);
    }

    private static int? ToDurationSeconds(Track track)
    {
        return track.Details.Duration.HasValue
            ? track.Details.Duration.Match(value => (int)value.TotalSeconds, () => 0)
            : null;
    }

    private static int? ToDurationSeconds(ReleaseTrack track)
    {
        return track.Details.Duration.HasValue
            ? track.Details.Duration.Match(value => (int)value.TotalSeconds, () => 0)
            : null;
    }

    private static Guid? OptionalGuid(IOptionalValue<NamingProfileId>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(value => value.Value, () => Guid.Empty) : null;
    }

    private static int? OptionalInt(IOptionalValue<int>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(value => value, () => 0) : null;
    }

    private static string? OptionalDate(IOptionalValue<DateOnly>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(value => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), () => string.Empty) : null;
    }

    private static string? OptionalString(IOptionalValue<string>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(value => value, () => string.Empty) : null;
    }

}
