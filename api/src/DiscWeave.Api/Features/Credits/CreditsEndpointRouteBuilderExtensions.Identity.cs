using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Credits;

public static partial class CreditsEndpointRouteBuilderExtensions
{
    private static async Task<bool> CreditExistsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string identityKey,
        CreditId? excludedCreditId,
        CancellationToken cancellationToken)
    {
        IQueryable<Credit> query = context.Credits
            .AsNoTracking()
            .Where(credit => credit.CollectionId == collectionId && EF.Property<string>(credit, "_identityKey") == identityKey);

        if (excludedCreditId is { } creditId)
        {
            query = query.Where(credit => credit.Id != creditId);
        }

        return await query.AnyAsync(cancellationToken);
    }

    private static async Task<bool> TargetExistsAsync(
        CreditTarget target,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return target switch
        {
            ReleaseCreditTarget releaseTarget => await context.Releases.AnyAsync(release => release.CollectionId == collectionId && release.Id == releaseTarget.ReleaseId, cancellationToken),
            TrackCreditTarget trackTarget => await context.Tracks.AnyAsync(track => track.CollectionId == collectionId && track.Id == trackTarget.TrackId, cancellationToken),
            _ => false
        };
    }
}
