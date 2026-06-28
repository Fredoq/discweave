using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Application.Errors;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static async Task<Release> CreateReleaseEntryAsync(
        ReleaseRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Release release = await ApplyReleaseRequestAsync(
            Release.Create(collectionId, ReleaseId.New(), request.Title),
            request,
            context,
            collectionId,
            cancellationToken);
        IReadOnlyList<ResolvedCredit> releaseCredits = await ResolveCreditsAsync(
            request.ArtistCredits,
            context,
            collectionId,
            cancellationToken);

        if (!request.IsVariousArtists && releaseCredits.All(credit => !credit.Roles.Contains("mainArtist", StringComparer.Ordinal)))
        {
            throw new DomainException("release.artist_required", "Release artist is required unless the release is marked as Various Artists");
        }

        IReadOnlyList<ReleaseLabel> labels = await ResolveLabelsAsync(request, context, collectionId, cancellationToken);
        release.UpdateLabels(request.NotOnLabel, labels);
        release.ReplaceExternalSources(ExternalSourceReferenceMapper.FromRequests(request.ExternalSources, DateTimeOffset.UtcNow));
        _ = context.Releases.Add(release);

        foreach (ResolvedCredit credit in releaseCredits)
        {
            _ = context.Credits.Add(Credit.Create(collectionId, CreditId.New(), CreditContributor.FromArtist(credit.Artist), CreditTarget.ForRelease(release.Id), credit.Roles));
        }

        await ReplaceReleaseTracklistAsync(request, release, releaseCredits, context, collectionId, cancellationToken);
        await CreateOwnedCopyAsync(request, release, context, collectionId, cancellationToken);

        return release;
    }

    private static async Task ReplaceReleaseTracklistAsync(
        ReleaseRequest request,
        Release release,
        IReadOnlyList<ResolvedCredit> releaseCredits,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        EnsureTracklistHasNoDuplicateTrackIds(request.Tracklist ?? []);

        ReleaseTrack[] existingReleaseTracks = [.. release.Tracklist];
        DigitalTrackFileLink[] existingFileLinks = await LoadDigitalFileLinksForReleaseTracklistAsync(
            context,
            collectionId,
            existingReleaseTracks,
            cancellationToken);
        var existingReleaseTracksByPosition = existingReleaseTracks
            .GroupBy(releaseTrack => ReleaseTrackPositionKey.From(releaseTrack.Position))
            .ToDictionary(group => group.Key, group => group.First());
        var uniqueExistingReleaseTracksByTrackId = existingReleaseTracks
            .Where(releaseTrack => releaseTrack.TrackId.HasValue)
            .GroupBy(releaseTrack => releaseTrack.TrackId!.Value)
            .Where(group => group.Count() == 1)
            .ToDictionary(group => group.Key, group => group.Single());
        TrackId[] existingTrackIds =
        [
            .. existingReleaseTracksByPosition.Values
                .Select(releaseTrack => releaseTrack.TrackId)
                .Where(trackId => trackId.HasValue)
                .Select(trackId => trackId!.Value)
                .Distinct()
        ];
        Dictionary<TrackId, Track> existingTracksById = existingTrackIds.Length == 0
            ? []
            : await context.Tracks
                .Where(track => track.CollectionId == collectionId && existingTrackIds.Contains(track.Id))
                .ToDictionaryAsync(track => track.Id, cancellationToken);
        var overlaidPositions = new HashSet<ReleaseTrackPositionKey>();
        var releaseTracks = new List<ReleaseTrack>();
        var fileLinkMigrations = new List<ReleaseTrackFileLinkMigration>();
        foreach (ReleaseTrackRequest trackRequest in request.Tracklist ?? [])
        {
            string trackMode = NormalizeTrackMode(trackRequest);
            var position = TrackPosition.FromNumber(trackRequest.Position, trackRequest.Disc ?? string.Empty, trackRequest.Side ?? string.Empty);
            if (trackMode == ReleaseOnlyTrackMode)
            {
                IReadOnlyList<ResolvedCredit> releaseTrackCredits = await ResolveTrackCreditsAsync(
                    trackRequest.ArtistCredits,
                    ShouldInheritReleaseArtistCredits(trackRequest, allowDefaultInheritance: true),
                    releaseCredits,
                    request.IsVariousArtists,
                    context,
                    collectionId,
                    cancellationToken);
                releaseTracks.Add(ReleaseTrack.CreateReleaseOnly(
                        ReleaseTrackId.New(),
                        position,
                        RequiredTrackTitle(trackRequest),
                        TrackDetailsFromRequest(trackRequest))
                    .WithArtistCredits(ToReleaseTrackArtistCredits(releaseTrackCredits)));
                continue;
            }

            Track track;
            ReleaseTrack? fileLinkSource = null;
            if (trackMode == LinkTrackMode)
            {
                Guid trackId = trackRequest.TrackId
                    ?? throw new DomainException("release_track.track_id_required", "Release track with link mode must include trackId");
                EnsureExistingTrackRequestHasNoExternalSources(trackRequest);
                var requestedTrackId = new TrackId(trackId);

                track = await context.Tracks.SingleOrDefaultAsync(
                    entity => entity.CollectionId == collectionId && entity.Id == requestedTrackId,
                    cancellationToken)
                    ?? throw new DomainException("release_track.track_conflict", "Release track does not exist");
                ApplyOptionalLinkedTrackRequestMetadata(track, trackRequest);
                fileLinkSource = uniqueExistingReleaseTracksByTrackId.GetValueOrDefault(requestedTrackId);
                await AddMissingTrackCreditsAsync(
                    track,
                    trackRequest,
                    releaseCredits,
                    request.IsVariousArtists,
                    context,
                    collectionId,
                    cancellationToken);
            }
            else
            {
                var positionKey = ReleaseTrackPositionKey.From(trackRequest);
                if (existingReleaseTracksByPosition.TryGetValue(positionKey, out ReleaseTrack? existingReleaseTrack) &&
                    existingReleaseTrack.TrackId is { } existingTrackId &&
                    existingTracksById.TryGetValue(existingTrackId, out Track? existingTrack) &&
                    overlaidPositions.Add(positionKey))
                {
                    track = existingTrack;
                    fileLinkSource = existingReleaseTrack;
                    ApplyTrackRequestMetadata(track, trackRequest, request.Year);
                    await ReplaceTrackCreditsAsync(
                        track,
                        trackRequest,
                        releaseCredits,
                        request.IsVariousArtists,
                        context,
                        collectionId,
                        cancellationToken);
                }
                else
                {
                    track = Track.Create(collectionId, TrackId.New(), RequiredTrackTitle(trackRequest));
                    ApplyTrackRequestMetadata(track, trackRequest, request.Year);
                    _ = context.Tracks.Add(track);
                    await AddTrackCreditsAsync(
                        track,
                        trackRequest,
                        releaseCredits,
                        request.IsVariousArtists,
                        context,
                        collectionId,
                        cancellationToken);
                }
            }

            var releaseTrack = ReleaseTrack.Create(
                track.Id,
                position,
                Optional.Missing<string>());
            releaseTracks.Add(releaseTrack);
            if (fileLinkSource is not null)
            {
                fileLinkMigrations.Add(new ReleaseTrackFileLinkMigration(fileLinkSource.Id, releaseTrack.Id));
            }
        }

        release.ReplaceTracklist(releaseTracks);
        PreserveDigitalFileLinksForReplacedTracklist(context, collectionId, existingFileLinks, fileLinkMigrations);
    }

    private static async Task<IReadOnlyList<ReleaseLabel>> ResolveLabelsAsync(
        ReleaseRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (request.NotOnLabel)
        {
            return [];
        }

        var labels = new List<ReleaseLabel>();
        if (request.Labels is { Count: > 0 })
        {
            foreach (ReleaseLabelRequest labelRequest in request.Labels)
            {
                Label label = await ResolveLabelAsync(labelRequest, context, collectionId, cancellationToken);
                labels.Add(ReleaseLabel.Create(label.Id, ToOptionalString(labelRequest.CatalogNumber), labelRequest.HasNoCatalogNumber));
            }
        }
        else if (request.LabelId is { } labelId)
        {
            Label? label = await context.Labels.SingleOrDefaultAsync(
                record => record.CollectionId == collectionId && record.Id == new LabelId(labelId),
                cancellationToken);
            _ = label ?? throw new ReferencedResourceMissingException(new InvalidOperationException(LabelMissingMessage));

            labels.Add(ReleaseLabel.Create(label.Id, Optional.Missing<string>(), false));
        }

        return labels;
    }

    private static async Task<Label> ResolveLabelAsync(
        ReleaseLabelRequest labelRequest,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (labelRequest.LabelId is { } labelId)
        {
            Label? existing = await context.Labels.SingleOrDefaultAsync(
                label => label.CollectionId == collectionId && label.Id == new LabelId(labelId),
                cancellationToken);

            return existing ?? throw new ReferencedResourceMissingException(new InvalidOperationException(LabelMissingMessage));
        }

        if (string.IsNullOrWhiteSpace(labelRequest.Name))
        {
            throw new DomainException("release_label.name_required", "Release label name is required");
        }

        string name = LabelName.NormalizeDisplayName(labelRequest.Name);
        string nameKey = LabelName.NormalizeKey(name);
        Label? existingByName = context.Labels.Local.FirstOrDefault(label => label.CollectionId == collectionId && label.NameKey == nameKey);
        existingByName ??= await context.Labels.SingleOrDefaultAsync(
            label => label.CollectionId == collectionId && label.NameKey == nameKey,
            cancellationToken);

        if (existingByName is not null)
        {
            return existingByName;
        }

        var created = Label.Create(collectionId, LabelId.New(), name);
        _ = context.Labels.Add(created);

        return created;
    }

    private static IOptionalValue<string> ToOptionalString(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? Optional.Missing<string>()
            : Optional.From(value.Trim());
    }

    private static async Task ReplaceReleaseCreditsAsync(
        Release release,
        IReadOnlyList<ResolvedCredit> releaseCredits,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Credit[] releaseCreditsToRemove = await context.Credits
            .Where(credit =>
                credit.CollectionId == collectionId &&
                EF.Property<ReleaseId?>(credit, "_targetReleaseId") == release.Id)
            .ToArrayAsync(cancellationToken);
        context.Credits.RemoveRange(releaseCreditsToRemove);

        foreach (ResolvedCredit credit in releaseCredits)
        {
            _ = context.Credits.Add(Credit.Create(collectionId, CreditId.New(), CreditContributor.FromArtist(credit.Artist), CreditTarget.ForRelease(release.Id), credit.Roles));
        }
    }
}
