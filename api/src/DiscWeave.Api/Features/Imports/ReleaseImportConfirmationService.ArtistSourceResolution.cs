using DiscWeave.Api.Features.Credits;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static async Task<Artist> ResolveArtistCreditAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportArtistCredit credit,
        ImportArtistSourceResolutionCache artistSourceCache,
        CancellationToken cancellationToken)
    {
        if (credit.ArtistId is not null)
        {
            Artist selectedArtist = await CreditArtistResolver.ResolveAsync(
                credit.ArtistId,
                credit.Name,
                context,
                collectionId,
                ImportReleaseCreditArtistErrors,
                cancellationToken);

            if (credit.ExternalSource is { } selectedArtistSource)
            {
                await RememberSelectedArtistSourceAsync(
                    context,
                    collectionId,
                    artistSourceCache,
                    selectedArtistSource,
                    selectedArtist,
                    cancellationToken);
            }

            return selectedArtist;
        }

        if (credit.ExternalSource is { } source)
        {
            Artist? sourcedArtist = await ResolveArtistByExternalSourceAsync(
                context,
                collectionId,
                credit,
                source,
                artistSourceCache,
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
        ImportArtistSourceResolutionCache artistSourceCache,
        CancellationToken cancellationToken)
    {
        if (!IsCompleteExternalSource(source))
        {
            return null;
        }

        if (artistSourceCache.TryGet(source, out Artist cachedArtist))
        {
            return cachedArtist;
        }

        Artist[] matches = await FindArtistsByExternalSourceAsync(
            context,
            collectionId,
            source,
            cancellationToken);

        if (matches.Length > 1)
        {
            ThrowArtistExternalSourceConflict();
        }

        if (matches.Length == 1)
        {
            artistSourceCache.Remember(source, matches[0]);
            return matches[0];
        }

        string name = CleanImportedArtistName(credit.Name, source);
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
        artistSourceCache.Remember(source, created);

        return created;
    }

    private static async Task RememberSelectedArtistSourceAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ImportArtistSourceResolutionCache artistSourceCache,
        ReleaseImportArtistCreditExternalSource source,
        Artist selectedArtist,
        CancellationToken cancellationToken)
    {
        if (!IsCompleteExternalSource(source))
        {
            return;
        }

        if (artistSourceCache.TryGet(source, out Artist cachedArtist) && cachedArtist.Id != selectedArtist.Id)
        {
            ThrowArtistExternalSourceConflict();
        }

        Artist[] sourceOwners = await FindArtistsByExternalSourceAsync(
            context,
            collectionId,
            source,
            cancellationToken);
        if (sourceOwners.Any(owner => owner.Id != selectedArtist.Id))
        {
            ThrowArtistExternalSourceConflict();
        }

        await context.Entry(selectedArtist).Collection("_externalSources").LoadAsync(cancellationToken);
        UpsertExternalSource(selectedArtist, source);
        artistSourceCache.Remember(source, selectedArtist);
    }

    private static async Task<Artist[]> FindArtistsByExternalSourceAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportArtistCreditExternalSource source,
        CancellationToken cancellationToken)
    {
        string providerName = source.ProviderName.Trim();
        string resourceType = source.ResourceType.Trim();
        string externalId = source.ExternalId.Trim();

        Artist[] persistedMatches = await context.Artists
            .Include("_externalSources")
            .Where(artist => artist.CollectionId == collectionId)
            .Where(artist => EF.Property<List<ExternalSourceReference>>(artist, "_externalSources").Any(existing =>
                EF.Functions.Collate(existing.ProviderName, SqliteNoCaseCollation) == providerName &&
                EF.Functions.Collate(existing.ResourceType, SqliteNoCaseCollation) == resourceType &&
                existing.ExternalId == externalId))
            .ToArrayAsync(cancellationToken);

        return
        [
            .. context.Artists.Local
                .Where(artist => artist.CollectionId == collectionId && HasExternalSource(artist, source))
                .Concat(persistedMatches)
                .DistinctBy(artist => artist.Id)
        ];
    }

    private static void UpsertExternalSource(Artist artist, ReleaseImportArtistCreditExternalSource source)
    {
        var importedSource = ExternalSourceReference.Create(
            source.ProviderName,
            source.ResourceType,
            source.ExternalId,
            source.SourceUrl,
            DateTimeOffset.UtcNow);

        artist.ReplaceExternalSources(
        [
            .. artist.ExternalSources.Where(existing => !HasExternalSourceIdentity(existing, source)),
            importedSource
        ]);
    }

    private static string CleanImportedArtistName(string name, ReleaseImportArtistCreditExternalSource source)
    {
        return IsDiscogsArtistSource(source)
            ? DiscogsArtistNameCleaner.Clean(name)
            : name.Trim();
    }

    private static bool IsDiscogsArtistSource(ReleaseImportArtistCreditExternalSource source)
    {
        return string.Equals(source.ProviderName, "discogs", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(source.ResourceType, "artist", StringComparison.OrdinalIgnoreCase);
    }

    private static void ThrowArtistExternalSourceConflict()
    {
        throw new DomainException(
            "release_import.artist_external_source_conflict",
            "Release import artist external source matches multiple artists");
    }

    private static bool IsCompleteExternalSource(ReleaseImportArtistCreditExternalSource source)
    {
        return !string.IsNullOrWhiteSpace(source.ProviderName) &&
            !string.IsNullOrWhiteSpace(source.ResourceType) &&
            !string.IsNullOrWhiteSpace(source.ExternalId) &&
            !string.IsNullOrWhiteSpace(source.SourceUrl);
    }

    private static bool HasExternalSource(Artist artist, ReleaseImportArtistCreditExternalSource source)
    {
        return artist.ExternalSources.Any(existing => HasExternalSourceIdentity(existing, source));
    }

    private static bool HasExternalSourceIdentity(
        ExternalSourceReference existing,
        ReleaseImportArtistCreditExternalSource source)
    {
        return string.Equals(existing.ProviderName, source.ProviderName, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(existing.ResourceType, source.ResourceType, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(existing.ExternalId, source.ExternalId, StringComparison.Ordinal);
    }

    private static string NormalizeExternalSourceKey(string value)
    {
        return value.Trim().ToUpperInvariant();
    }

    private sealed class ImportArtistSourceResolutionCache
    {
        private readonly Dictionary<ExternalSourceIdentity, Artist> _artistsBySource = [];

        public bool TryGet(ReleaseImportArtistCreditExternalSource source, out Artist artist)
        {
            return _artistsBySource.TryGetValue(ExternalSourceIdentity.From(source), out artist!);
        }

        public void Remember(ReleaseImportArtistCreditExternalSource source, Artist artist)
        {
            _artistsBySource[ExternalSourceIdentity.From(source)] = artist;
        }
    }

    private readonly record struct ExternalSourceIdentity(
        string ProviderNameKey,
        string ResourceTypeKey,
        string ExternalId)
    {
        public static ExternalSourceIdentity From(ReleaseImportArtistCreditExternalSource source)
        {
            return new ExternalSourceIdentity(
                NormalizeExternalSourceKey(source.ProviderName),
                NormalizeExternalSourceKey(source.ResourceType),
                source.ExternalId.Trim());
        }
    }
}
