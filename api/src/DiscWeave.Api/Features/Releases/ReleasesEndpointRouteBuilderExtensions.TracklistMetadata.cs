using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static string RequiredTrackTitle(ReleaseTrackRequest trackRequest)
    {
        string title = trackRequest.Title?.Trim() ?? string.Empty;
        return title.Length == 0
            ? throw new DomainException("release_track.title_required", "Release track title is required when trackId is not provided")
            : title;
    }

    private static void ApplyTrackRequestMetadata(Track track, ReleaseTrackRequest trackRequest, int? releaseYear)
    {
        track.Rename(RequiredTrackTitle(trackRequest));
        track.UpdateDetails(TrackDetailsFromRequest(trackRequest));
        if ((trackRequest.VersionYear ?? releaseYear) is { } versionYear)
        {
            track.UpdateMetadata(track.Metadata.WithVersionYear(versionYear));
        }

        track.ReplaceExternalSources(ExternalSourceReferenceMapper.FromRequests(trackRequest.ExternalSources, DateTimeOffset.UtcNow));
    }

    private static void ApplyOptionalLinkedTrackRequestMetadata(Track track, ReleaseTrackRequest trackRequest)
    {
        string title = trackRequest.Title?.Trim() ?? string.Empty;
        if (title.Length > 0)
        {
            track.Rename(title);
        }

        if (trackRequest.DurationSeconds is { } durationSeconds)
        {
            track.UpdateDetails(track.Details.WithDuration(TimeSpan.FromSeconds(durationSeconds)));
        }

        if (trackRequest.VersionYear is { } versionYear)
        {
            track.UpdateMetadata(track.Metadata.WithVersionYear(versionYear));
        }
    }

    private static TrackDetails TrackDetailsFromRequest(ReleaseTrackRequest trackRequest)
    {
        TrackDetails details = TrackDetails.Empty;
        if (trackRequest.DurationSeconds is { } durationSeconds)
        {
            details = details.WithDuration(TimeSpan.FromSeconds(durationSeconds));
        }

        return details;
    }

    private static async Task AddTrackCreditsAsync(
        Track track,
        ReleaseTrackRequest trackRequest,
        IReadOnlyList<ResolvedCredit> releaseCredits,
        bool isVariousArtists,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ResolvedCredit> trackCredits = await ResolveTrackCreditsAsync(
            trackRequest.ArtistCredits,
            ShouldInheritReleaseArtistCredits(trackRequest, allowDefaultInheritance: true),
            releaseCredits,
            isVariousArtists,
            context,
            collectionId,
            cancellationToken);

        AddCredits(track, trackCredits, context, collectionId);
    }

    private static async Task AddMissingTrackCreditsAsync(
        Track track,
        ReleaseTrackRequest trackRequest,
        IReadOnlyList<ResolvedCredit> releaseCredits,
        bool isVariousArtists,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        bool shouldInherit = ShouldInheritReleaseArtistCredits(trackRequest, allowDefaultInheritance: false);
        if (!shouldInherit && trackRequest.ArtistCredits is not { Count: > 0 })
        {
            return;
        }

        IReadOnlyList<ResolvedCredit> trackCredits = await ResolveTrackCreditsAsync(
            trackRequest.ArtistCredits,
            shouldInherit,
            releaseCredits,
            isVariousArtists,
            context,
            collectionId,
            cancellationToken);
        await AddMissingResolvedTrackCreditsAsync(track, trackCredits, context, collectionId, cancellationToken);
    }

    private static void AddCredits(
        Track track,
        IReadOnlyList<ResolvedCredit> trackCredits,
        DiscWeaveDbContext context,
        CollectionId collectionId)
    {
        foreach (ResolvedCredit credit in trackCredits)
        {
            _ = context.Credits.Add(Credit.Create(collectionId, CreditId.New(), CreditContributor.FromArtist(credit.Artist), CreditTarget.ForTrack(track.Id), credit.Roles));
        }
    }

    private static async Task ReplaceTrackCreditsAsync(
        Track track,
        ReleaseTrackRequest trackRequest,
        IReadOnlyList<ResolvedCredit> releaseCredits,
        bool isVariousArtists,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Credit[] trackCreditsToRemove = await context.Credits
            .Where(credit =>
                credit.CollectionId == collectionId &&
                EF.Property<TrackId?>(credit, "_targetTrackId") == track.Id)
            .ToArrayAsync(cancellationToken);
        context.Credits.RemoveRange(trackCreditsToRemove);

        await AddTrackCreditsAsync(track, trackRequest, releaseCredits, isVariousArtists, context, collectionId, cancellationToken);
    }

    private static async Task AddMissingResolvedTrackCreditsAsync(
        Track track,
        IReadOnlyList<ResolvedCredit> trackCredits,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Credit[] existingCredits = await context.Credits
            .Where(credit =>
                credit.CollectionId == collectionId &&
                EF.Property<TrackId?>(credit, "_targetTrackId") == track.Id)
            .ToArrayAsync(cancellationToken);
        var existingRoles = existingCredits
            .SelectMany(credit => credit.Roles.Select(role => new CreditRoleIdentity(credit.Contributor.ArtistId, role)))
            .ToHashSet();

        foreach (ResolvedCredit credit in trackCredits)
        {
            string[] missingRoles =
            [
                .. credit.Roles.Where(role => !existingRoles.Contains(new CreditRoleIdentity(credit.Artist.Id, role)))
            ];
            if (missingRoles.Length == 0)
            {
                continue;
            }

            _ = context.Credits.Add(Credit.Create(collectionId, CreditId.New(), CreditContributor.FromArtist(credit.Artist), CreditTarget.ForTrack(track.Id), missingRoles));
            foreach (string role in missingRoles)
            {
                _ = existingRoles.Add(new CreditRoleIdentity(credit.Artist.Id, role));
            }
        }
    }

    private static bool ShouldInheritReleaseArtistCredits(ReleaseTrackRequest trackRequest, bool allowDefaultInheritance)
    {
        return trackRequest.InheritReleaseArtistCredits ?? (allowDefaultInheritance && trackRequest.ArtistCredits is not { Count: > 0 });
    }

    private static ReleaseTrackArtistCredit[] ToReleaseTrackArtistCredits(IReadOnlyList<ResolvedCredit> credits)
    {
        return
        [
            .. credits.Select(credit => ReleaseTrackArtistCredit.Create(credit.Artist.Id, credit.Roles))
        ];
    }

    private sealed record CreditRoleIdentity(ArtistId ArtistId, string Role);
}
