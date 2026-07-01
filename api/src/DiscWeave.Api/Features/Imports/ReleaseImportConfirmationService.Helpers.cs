using DiscWeave.Api.Features.Credits;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static readonly CreditArtistResolverErrors ImportReleaseCreditArtistErrors = new(
        "release_import.artist_conflict",
        "Release import artist does not exist",
        "release_import.artist_name_required",
        "Release import artist name is required");

    private static async Task<IReadOnlyList<Artist>> ResolveArtistsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<string> names,
        IReadOnlyList<Guid> selectedIds,
        CancellationToken cancellationToken)
    {
        List<Artist> artists = [];
        for (int index = 0; index < names.Count; index++)
        {
            string name = names[index];
            Artist? artist = index < selectedIds.Count
                ? await context.Artists.SingleOrDefaultAsync(candidate => candidate.CollectionId == collectionId && candidate.Id == new ArtistId(selectedIds[index]), cancellationToken)
                : await FindArtistByNameAsync(context, collectionId, name, cancellationToken);

            if (artist is null)
            {
                artist = Person.Create(collectionId, ArtistId.New(), name);
                _ = context.Artists.Add(artist);
            }

            artists.Add(artist);
        }

        return artists;
    }

    private static async Task<Artist?> FindArtistByNameAsync(DiscWeaveDbContext context, CollectionId collectionId, string name, CancellationToken cancellationToken)
    {
        string normalized = Normalize(name);
        Artist[] artists = await context.Artists.Where(artist => artist.CollectionId == collectionId).ToArrayAsync(cancellationToken);

        return artists.FirstOrDefault(artist => Normalize(artist.Name) == normalized);
    }

    private static async Task<Artist> ResolveArtistCreditAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportArtistCredit credit,
        CancellationToken cancellationToken)
    {
        if (credit.ArtistId is not null)
        {
            return await CreditArtistResolver.ResolveAsync(
                credit.ArtistId,
                credit.Name,
                context,
                collectionId,
                ImportReleaseCreditArtistErrors,
                cancellationToken);
        }

        if (credit.ExternalSource is { } source)
        {
            Artist? sourcedArtist = await ResolveArtistByExternalSourceAsync(
                context,
                collectionId,
                credit,
                source,
                cancellationToken);
            if (sourcedArtist is not null)
            {
                return sourcedArtist;
            }
        }

        return await CreditArtistResolver.ResolveAsync(
            null,
            credit.Name,
            context,
            collectionId,
            ImportReleaseCreditArtistErrors,
            cancellationToken);
    }

    private static async Task<Artist?> ResolveArtistByExternalSourceAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportArtistCredit credit,
        ReleaseImportArtistCreditExternalSource source,
        CancellationToken cancellationToken)
    {
        if (!IsCompleteExternalSource(source))
        {
            return null;
        }

        Artist[] persistedArtists = await context.Artists
            .Include("_externalSources")
            .Where(artist => artist.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        Artist[] artists =
        [
            .. context.Artists.Local
                .Where(artist => artist.CollectionId == collectionId)
                .Concat(persistedArtists)
                .DistinctBy(artist => artist.Id)
        ];

        Artist[] matches =
        [
            .. artists.Where(artist => artist.ExternalSources.Any(existing =>
                string.Equals(existing.ProviderName, source.ProviderName, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(existing.ResourceType, source.ResourceType, StringComparison.OrdinalIgnoreCase) &&
                existing.ExternalId == source.ExternalId))
        ];

        if (matches.Length > 1)
        {
            throw new DomainException(
                "release_import.artist_external_source_conflict",
                "Release import artist external source matches multiple artists");
        }

        if (matches.Length == 1)
        {
            return matches[0];
        }

        string name = DiscogsArtistNameCleaner.Clean(credit.Name);
        if (string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        Artist created = Person.Create(collectionId, ArtistId.New(), name);
        created.ReplaceExternalSources(
        [
            ExternalSourceReference.Create(
                source.ProviderName,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl,
                DateTimeOffset.UtcNow)
        ]);
        _ = context.Artists.Add(created);

        return created;
    }

    private static bool IsCompleteExternalSource(ReleaseImportArtistCreditExternalSource source)
    {
        return !string.IsNullOrWhiteSpace(source.ProviderName) &&
            !string.IsNullOrWhiteSpace(source.ResourceType) &&
            !string.IsNullOrWhiteSpace(source.ExternalId) &&
            !string.IsNullOrWhiteSpace(source.SourceUrl);
    }

    private static IReadOnlyList<ReleaseImportArtistCredit> EffectiveArtistCredits(ReleaseImportDraft draft)
    {
        return draft.ArtistCredits.Count > 0
            ? draft.ArtistCredits
            : [.. draft.ArtistNames.Select((name, index) => new ReleaseImportArtistCredit(
                index < draft.SelectedArtistIds.Count ? draft.SelectedArtistIds[index] : null,
                name,
                MainArtistRole))];
    }

    private static IReadOnlyList<ReleaseImportArtistCredit> MainArtistCredits(ReleaseImportDraft draft)
    {
        ReleaseImportArtistCredit[] mainCredits =
        [
            .. EffectiveArtistCredits(draft).Where(credit =>
                string.Equals(credit.Role, MainArtistRole, StringComparison.Ordinal) ||
                string.Equals(credit.Role, "Main artist", StringComparison.OrdinalIgnoreCase))
        ];

        return mainCredits.Length > 0 ? mainCredits : EffectiveArtistCredits(draft);
    }

    private static async Task AddReleaseCreditsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        ReleaseImportDraft draft,
        CancellationToken cancellationToken)
    {
        if (draft.IsVariousArtists)
        {
            return;
        }

        foreach (ReleaseImportArtistCredit credit in EffectiveArtistCredits(draft))
        {
            Artist artist = await ResolveArtistCreditAsync(context, collectionId, credit, cancellationToken);
            string role = await ResolveImportCreditRoleAsync(
                context,
                collectionId,
                credit.Role,
                $"release artist \"{artist.Name}\"",
                cancellationToken);

            _ = context.Credits.Add(Credit.Create(
                collectionId,
                CreditId.New(),
                CreditContributor.FromArtist(artist),
                CreditTarget.ForRelease(release.Id),
                role));
        }
    }

    private static async Task<string> ResolveImportCreditRoleAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string role,
        string creditTargetDescription,
        CancellationToken cancellationToken)
    {
        string requestedRole = CreditMapper.ParseRole(string.IsNullOrWhiteSpace(role) ? MainArtistRole : role);

        try
        {
            return await DictionaryValidation.ResolveOrCreateActiveCodeAsync(
                context,
                collectionId,
                DictionaryKind.CreditRole,
                requestedRole,
                "credit.role_invalid",
                "Credit role is invalid",
                cancellationToken);
        }
        catch (DomainException exception) when (exception.Code == "credit.role_invalid")
        {
            throw new DomainException(
                "credit.role_invalid",
                $"Credit role \"{requestedRole}\" is not active for {creditTargetDescription}; add it in Settings > Credit roles or choose an active role");
        }
    }

    private static async Task<Track> ResolveTrackAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraftTrack draftTrack,
        CancellationToken cancellationToken)
    {
        if (draftTrack.TrackMode == ReleaseImportTrackMode.ReleaseOnly)
        {
            throw new DomainException("release_import.track_mode_invalid", "Release-only import tracks cannot resolve to catalog tracks");
        }

        if (draftTrack.TrackMode == ReleaseImportTrackMode.Link && draftTrack.SelectedTrackId is { } selectedTrackId)
        {
            Track? existing = await context.Tracks.SingleOrDefaultAsync(
                track => track.CollectionId == collectionId && track.Id == selectedTrackId,
                cancellationToken);

            Track linkedTrack = existing ?? throw new DomainException("release_import.selected_track_not_found", "Selected import track was not found");
            ApplyDraftTrackMetadata(linkedTrack, draftTrack);

            return linkedTrack;
        }

        var track = Track.Create(collectionId, TrackId.New(), draftTrack.Title);
        ApplyDraftTrackMetadata(track, draftTrack);
        _ = context.Tracks.Add(track);

        return track;
    }

    private static void ApplyDraftTrackMetadata(Track track, ReleaseImportDraftTrack draftTrack)
    {
        track.Rename(draftTrack.Title);
        if (draftTrack.Duration is { } duration)
        {
            track.UpdateDetails(track.Details.WithDuration(duration));
        }

        if (draftTrack.VersionYear is { } versionYear)
        {
            track.UpdateMetadata(track.Metadata.WithVersionYear(versionYear));
        }
    }

    private static string Normalize(string value)
    {
        return string.Join(' ', value.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
