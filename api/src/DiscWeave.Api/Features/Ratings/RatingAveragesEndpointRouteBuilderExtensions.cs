using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Ratings;

public static partial class RatingsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> ListRatingAveragesAsync(
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        CollectionId collectionId = currentCollection.CollectionId;
        RatingCriterion[] criteria = await context.RatingCriteria.AsNoTracking()
            .Where(criterion => criterion.CollectionId == collectionId && criterion.IsActive)
            .ToArrayAsync(cancellationToken);
        RatingValue[] trackRatings = await RatingEndpointHelpers
            .FilterByTargetType(
                context.RatingValues.AsNoTracking().Where(value => value.CollectionId == collectionId),
                RatingTargetType.Track)
            .ToArrayAsync(cancellationToken);
        Release[] releases = await context.Releases.AsNoTracking()
            .Where(release => release.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        Credit[] credits = await context.Credits.AsNoTracking()
            .Where(credit => credit.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        ArtistRelation[] relations = await context.ArtistRelations.AsNoTracking()
            .Where(relation => relation.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);

        var source = new RatingAverageSource(
            [.. criteria
                .Where(criterion => criterion.AppliesTo(RatingTargetType.Track))
                .Select(criterion => new RatingAverageCriterion(criterion.Id, criterion.ArtistAverageRoles))],
            [.. trackRatings.Select(value => new RatingAverageTrackRating(
                value.CriterionId,
                ((TrackRatingTarget)value.Target).TrackId,
                value.Rating.Value))],
            [.. releases.Select(release => new RatingAverageRelease(
                release.Id,
                [.. release.Tracklist.Select(track => track.TrackId).OfType<TrackId>()],
                [.. release.Labels.Select(label => label.LabelId)]))],
            ToTrackArtists(releases, credits),
            [.. relations.Select(relation => new RatingAverageArtistLink(relation.SourceArtistId, relation.TargetArtistId, relation.Type))]);

        RatingAverageResponse[] items =
        [
            .. RatingAverageCalculator.Calculate(source).Select(average => new RatingAverageResponse(
                RatingTargetTypeCodes.ToCode(average.TargetType),
                average.TargetId,
                average.CriterionId.Value,
                average.Average,
                average.RatedTrackCount,
                average.TrackCount))
        ];

        return Results.Ok(new RatingAverageListResponse(items));
    }

    /// <summary>
    /// A track's artists come from its own credits and its release tracklist credits.
    /// A track without either falls back to the credits of the releases it appears on.
    /// </summary>
    private static RatingAverageTrackArtist[] ToTrackArtists(Release[] releases, Credit[] credits)
    {
        List<RatingAverageTrackArtist> direct =
        [
            .. credits
                .Where(credit => credit.Target is TrackCreditTarget)
                .SelectMany(credit => credit.Roles.Select(role => new RatingAverageTrackArtist(
                    ((TrackCreditTarget)credit.Target).TrackId,
                    credit.Contributor.ArtistId,
                    role))),
            .. releases.SelectMany(release => release.Tracklist
                .Where(track => track.TrackId.HasValue)
                .SelectMany(track => track.ArtistCredits.SelectMany(credit => credit.Roles.Select(role =>
                    new RatingAverageTrackArtist(track.TrackId.GetValueOrDefault(), credit.ArtistId, role)))))
        ];
        HashSet<TrackId> creditedTrackIds = [.. direct.Select(credit => credit.TrackId)];
        ILookup<ReleaseId, Credit> releaseCredits = credits
            .Where(credit => credit.Target is ReleaseCreditTarget)
            .ToLookup(credit => ((ReleaseCreditTarget)credit.Target).ReleaseId);

        return
        [
            .. direct,
            .. releases.SelectMany(release => release.Tracklist
                .Where(track => track.TrackId.HasValue && !creditedTrackIds.Contains(track.TrackId.GetValueOrDefault()))
                .SelectMany(track => releaseCredits[release.Id].SelectMany(credit => credit.Roles.Select(role =>
                    new RatingAverageTrackArtist(track.TrackId.GetValueOrDefault(), credit.Contributor.ArtistId, role)))))
        ];
    }
}
