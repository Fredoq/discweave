using DiscWeave.Api.Features.Credits;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static async Task<IReadOnlyList<ReleaseLabel>> ResolveLabelsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        CancellationToken cancellationToken)
    {
        if (draft.NotOnLabel)
        {
            return [];
        }

        if (draft.Labels.Count > 0)
        {
            return await ResolveDraftLabelsAsync(context, collectionId, draft, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(draft.LabelName))
        {
            return [];
        }

        Label? label = await FindLabelByNameAsync(context, collectionId, draft.LabelName, cancellationToken);
        if (label is null)
        {
            label = Label.Create(collectionId, LabelId.New(), draft.LabelName);
            _ = context.Labels.Add(label);
        }

        return
        [
            ReleaseLabel.Create(
                label.Id,
                string.IsNullOrWhiteSpace(draft.CatalogNumber) ? Optional.Missing<string>() : Optional.From(draft.CatalogNumber),
                hasNoCatalogNumber: string.IsNullOrWhiteSpace(draft.CatalogNumber))
        ];
    }

    private static async Task<IReadOnlyList<ReleaseLabel>> ResolveDraftLabelsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        CancellationToken cancellationToken)
    {
        if (draft.NotOnLabel || draft.Labels.Count == 0)
        {
            return [];
        }

        List<ReleaseLabel> labels = [];
        foreach (ReleaseImportLabel labelRequest in draft.Labels)
        {
            Label label = await ResolveImportLabelAsync(context, collectionId, labelRequest, cancellationToken);
            labels.Add(ReleaseLabel.Create(
                label.Id,
                string.IsNullOrWhiteSpace(labelRequest.CatalogNumber) ? Optional.Missing<string>() : Optional.From(labelRequest.CatalogNumber),
                labelRequest.HasNoCatalogNumber));
        }

        return labels;
    }

    private static async Task AddTracksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        ReleaseImportDraft draft,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        CancellationToken cancellationToken)
    {
        List<ReleaseTrack> releaseTracks = [];
        List<ResolvedDraftTrack> resolvedTracks = [];
        foreach (ReleaseImportDraftTrack draftTrack in draftTracks)
        {
            Track track = await ResolveTrackAsync(context, collectionId, draftTrack, cancellationToken);
            resolvedTracks.Add(new ResolvedDraftTrack(draftTrack, track));
            resolvedTrackIdsByDraftTrackId[draftTrack.Id] = track.Id;
        }

        IReadOnlyDictionary<TrackId, Credit[]> existingCreditsByTrackId = await LoadExistingTrackCreditsAsync(
            context,
            collectionId,
            [.. resolvedTracks.Select(resolved => resolved.Track.Id)],
            cancellationToken);

        foreach (ResolvedDraftTrack resolvedTrack in resolvedTracks)
        {
            ReleaseImportDraftTrack draftTrack = resolvedTrack.DraftTrack;
            Track track = resolvedTrack.Track;
            await AddTrackCreditsAsync(context, collectionId, track, draft, draftTrack, existingCreditsByTrackId, cancellationToken);
            await AddTrackOwnedItemAsync(context, collectionId, track, draftTrack, cancellationToken);
            releaseTracks.Add(ReleaseTrack.Create(
                track.Id,
                TrackPosition.FromNumber(
                    draftTrack.Position ?? (releaseTracks.Count + 1),
                    draftTrack.Disc ?? string.Empty,
                    draftTrack.Side ?? string.Empty)));
        }

        release.ReplaceTracklist(releaseTracks);
    }

    private static async Task AddTrackCreditsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track track,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack draftTrack,
        IReadOnlyDictionary<TrackId, Credit[]> existingCreditsByTrackId,
        CancellationToken cancellationToken)
    {
        var desiredCredits = new List<ResolvedImportCredit>();
        if (draftTrack.InheritReleaseArtistCredits && !draft.IsVariousArtists)
        {
            foreach (ReleaseImportArtistCredit credit in MainArtistCredits(draft))
            {
                Artist artist = await ResolveArtistCreditAsync(context, collectionId, credit, cancellationToken);
                desiredCredits.Add(new ResolvedImportCredit(artist, [MainArtistRole]));
            }
        }

        if (draftTrack.ArtistCredits.Count > 0)
        {
            foreach (ReleaseImportArtistCredit credit in draftTrack.ArtistCredits)
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

                desiredCredits.Add(new ResolvedImportCredit(artist, [role]));
            }
        }
        else if (draftTrack.ArtistNames.Count > 0)
        {
            IReadOnlyList<Artist> artists = await ResolveArtistsAsync(context, collectionId, draftTrack.ArtistNames, draftTrack.SelectedArtistIds, cancellationToken);
            foreach (Artist artist in artists)
            {
                desiredCredits.Add(new ResolvedImportCredit(artist, [MainArtistRole]));
            }
        }

        AddMissingTrackCredits(context, collectionId, track, existingCreditsByTrackId, MergeImportCredits(desiredCredits));
    }

    private static async Task<IReadOnlyDictionary<TrackId, Credit[]>> LoadExistingTrackCreditsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyCollection<TrackId> trackIds,
        CancellationToken cancellationToken)
    {
        if (trackIds.Count == 0)
        {
            return new Dictionary<TrackId, Credit[]>();
        }

        TrackId?[] nullableTrackIds = [.. trackIds.Select(trackId => (TrackId?)trackId)];
        Credit[] existingCredits = await context.Credits
            .Where(credit =>
                credit.CollectionId == collectionId &&
                nullableTrackIds.Contains(EF.Property<TrackId?>(credit, "_targetTrackId")))
            .ToArrayAsync(cancellationToken);

        return existingCredits
            .GroupBy(credit => ((TrackCreditTarget)credit.Target).TrackId)
            .ToDictionary(group => group.Key, group => group.ToArray());
    }

    private static void AddMissingTrackCredits(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track track,
        IReadOnlyDictionary<TrackId, Credit[]> existingCreditsByTrackId,
        IReadOnlyList<ResolvedImportCredit> desiredCredits)
    {
        Credit[] existingCredits = existingCreditsByTrackId.GetValueOrDefault(track.Id) ?? [];
        var existingRoles = existingCredits
            .SelectMany(credit => credit.Roles.Select(role => new CreditIdentity(credit.Contributor.ArtistId, role)))
            .ToHashSet();

        foreach (ResolvedImportCredit desiredCredit in desiredCredits)
        {
            string[] missingRoles =
            [
                .. desiredCredit.Roles.Where(role => !existingRoles.Contains(new CreditIdentity(desiredCredit.Artist.Id, role)))
            ];
            if (missingRoles.Length == 0)
            {
                continue;
            }

            _ = context.Credits.Add(Credit.Create(
                collectionId,
                CreditId.New(),
                CreditContributor.FromArtist(desiredCredit.Artist),
                CreditTarget.ForTrack(track.Id),
                missingRoles));
            foreach (string role in missingRoles)
            {
                _ = existingRoles.Add(new CreditIdentity(desiredCredit.Artist.Id, role));
            }
        }
    }

    private sealed record ResolvedDraftTrack(ReleaseImportDraftTrack DraftTrack, Track Track);

    private static IReadOnlyList<ResolvedImportCredit> MergeImportCredits(IReadOnlyList<ResolvedImportCredit> credits)
    {
        return
        [
            .. credits
                .GroupBy(credit => credit.Artist.Id)
                .Select(group => new ResolvedImportCredit(
                    group.First().Artist,
                    [.. group.SelectMany(credit => credit.Roles).Distinct(StringComparer.Ordinal)]))
        ];
    }

    private sealed record ResolvedImportCredit(Artist Artist, IReadOnlyList<string> Roles);

    private sealed record CreditIdentity(ArtistId ArtistId, string Role);

    private static async Task<Label?> FindLabelByNameAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string name,
        CancellationToken cancellationToken)
    {
        string normalized = Normalize(name);
        Label[] labels = await context.Labels.Where(label => label.CollectionId == collectionId).ToArrayAsync(cancellationToken);

        return labels.FirstOrDefault(label => Normalize(label.Name) == normalized);
    }

    private static async Task<Label> ResolveImportLabelAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportLabel labelRequest,
        CancellationToken cancellationToken)
    {
        if (labelRequest.LabelId is { } labelId)
        {
            Label? existing = await context.Labels.SingleOrDefaultAsync(
                label => label.CollectionId == collectionId && label.Id == new LabelId(labelId),
                cancellationToken);

            return existing ?? throw new DomainException("release_import.label_conflict", "Release import label does not exist");
        }

        if (string.IsNullOrWhiteSpace(labelRequest.Name))
        {
            throw new DomainException("release_import.label_name_required", "Release import label name is required");
        }

        Label? label = await FindLabelByNameAsync(context, collectionId, labelRequest.Name, cancellationToken);
        if (label is not null)
        {
            return label;
        }

        label = Label.Create(collectionId, LabelId.New(), labelRequest.Name);
        _ = context.Labels.Add(label);
        return label;
    }
}
