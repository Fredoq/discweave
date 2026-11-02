using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Api.Features.Discover;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Imports;

internal static class RecommendedReleaseImport
{
    private const string DiscogsProvider = "discogs";
    private const string ReleaseResource = "release";

    internal static string Fingerprint(string releaseId)
    {
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes($"recommended-release:discogs:{releaseId}")));
    }

    // This is a persisted workflow discriminator, not an authorization token.
    // Both the fingerprint and immutable source are established by the server.
    internal static bool IsRecommendedRelease(ReleaseImportSession session, ReleaseImportDraft draft)
    {
        return session.CollectionId == draft.CollectionId && session.Id == draft.SessionId &&
            draft.SourceKind == ReleaseImportSourceKind.ExternalMetadata &&
            !draft.SelectedOriginalBinding.HasValue &&
            draft.ExternalSources.Count(source => source.ProviderCode == DiscogsProvider && source.ResourceType == ReleaseResource) == 1 &&
            draft.ExternalSources.All(source => source.ProviderCode == DiscogsProvider && source.ResourceType is ReleaseResource or "master") &&
            session.IdempotencyRequestFingerprint is PresentOptionalValue<string> fingerprint &&
            fingerprint.Value == Fingerprint(ReleaseSource(draft).ExternalId);
    }

    private static ReleaseImportProviderReference ReleaseSource(ReleaseImportDraft draft)
    {
        return draft.ExternalSources.Single(source => source.ResourceType == ReleaseResource);
    }

    internal static IReadOnlyList<ReleaseImportProviderReference> Sources(ExternalMetadataReleaseDetail release)
    {
        List<ReleaseImportProviderReference> sources = [ExternalReleaseProviderReferenceFactory.DiscogsRelease(release.Source.ExternalId)];
        foreach (string externalId in release.RelatedSources.Where(source =>
            source.ProviderName == DiscogsProvider && source.ResourceType == "master" &&
            long.TryParse(source.ExternalId, out long id) && id > 0).Select(source => source.ExternalId))
        {
            sources.Add(ReleaseImportProviderReference.Create(DiscogsProvider, "master", externalId,
                $"https://www.discogs.com/master/{externalId}"));
        }

        return [.. sources.DistinctBy(source => (source.ResourceType, source.ExternalId))
            .OrderBy(source => source.ResourceType, StringComparer.Ordinal)
            .ThenBy(source => source.ExternalId, StringComparer.Ordinal)];
    }

    internal static async Task ValidateAsync(
        ReleaseImportSession session,
        ReleaseImportDraft draft,
        IReadOnlyList<ReleaseImportDraftTrack> tracks,
        IExternalReleaseBindingValidator validator,
        DiscWeaveDbContext context,
        CancellationToken cancellationToken)
    {
        if (!IsRecommendedRelease(session, draft))
        {
            throw new DomainException("import.external_binding_stale", "The recommended release provenance is invalid");
        }

        string releaseId = ReleaseSource(draft).ExternalId;
        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await validator.GetRecommendedReleaseAsync(releaseId, cancellationToken);
        if (!result.IsSuccess)
        {
            throw new DomainException(result.Error.Code, "The provider release could not be revalidated");
        }

        ExternalMetadataReleaseDetail release = result.Value;
        if (!Sources(release).Select(source => (source.ResourceType, source.ExternalId))
                .SequenceEqual(draft.ExternalSources.Select(source => (source.ResourceType, source.ExternalId))) ||
            release.Title != draft.Title || !release.Artists.SequenceEqual(draft.ArtistNames) ||
            release.Tracklist.Count != tracks.Count || tracks.Any(track => track.IsSkipped ||
                track.TrackMode != ReleaseImportTrackMode.ReleaseOnly || track.IsOriginal) ||
            !MatchesTracklist(release.Tracklist, tracks))
        {
            throw new DomainException("import.recommended_release_changed", "The release metadata changed; start a new recommendation review");
        }

        if (draft.CollectionItemIntent is not PresentOptionalValue<ReleaseImportCollectionItemIntent> intent ||
            intent.Value is not ReleaseImportCollectionItemIntent.NewWanted wanted || !wanted.Medium.HasValue)
        {
            throw new DomainException("release_import.collection_item_medium_required", "Select a Wanted medium before confirmation");
        }

        foreach (ReleaseImportProviderReference source in Sources(release))
        {
            Guid[] existingIds = await context.Database.SqlQuery<Guid>($"""
                SELECT release_id AS "Value" FROM release_external_sources
                WHERE collection_id = {draft.CollectionId.Value} AND provider_name = 'discogs'
                  AND resource_type = {source.ResourceType} AND external_id = {source.ExternalId}
                """).ToArrayAsync(cancellationToken);
            bool exists = existingIds.Length > 0 && (source.ResourceType == ReleaseResource ||
                await HasMatchingMasterAsync(context, draft.CollectionId, source.ExternalId, release, existingIds, cancellationToken));
            if (exists)
            {
                throw new DomainException("import.recommended_release_already_cataloged", "This release is already in the collection; review the existing release instead");
            }
        }
    }
    private static async Task<bool> HasMatchingMasterAsync(
        DiscWeaveDbContext context, CollectionId collectionId, string masterId,
        ExternalMetadataReleaseDetail candidate, Guid[] existingIds, CancellationToken cancellationToken)
    {
        ReleaseId[] ids = [.. existingIds.Select(id => new ReleaseId(id))];
        Release[] releases = await context.Releases.Where(release => release.CollectionId == collectionId && ids.Contains(release.Id))
            .ToArrayAsync(cancellationToken);
        string candidateKey = DiscoverIdentity.MasterKey(masterId, candidate.Title, candidate.Tracklist.Select(track => track.Title));
        TrackId[] trackIds = [.. releases.SelectMany(release => release.Tracklist)
            .Where(row => row.TrackId.HasValue).Select(row => row.TrackId.GetValueOrDefault()).Distinct()];
        Dictionary<TrackId, string> titles = await context.Tracks
            .Where(track => track.CollectionId == collectionId && trackIds.Contains(track.Id))
            .ToDictionaryAsync(track => track.Id, track => track.Title, cancellationToken);
        return DiscoverResolver.LocalKeys(releases, titles).Contains(candidateKey);
    }

    private static bool MatchesTracklist(
        IReadOnlyList<ExternalMetadataReleaseTrack> providerTracks,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks)
    {
        string[] expected = [.. providerTracks.Select((track, index) => RowIdentity(
            track.Disc, track.Side,
            int.TryParse(track.Position, NumberStyles.Integer, CultureInfo.InvariantCulture, out int position) && position > 0
                ? position : index + 1,
            track.Title, track.Duration, track.Artists)).Order(StringComparer.Ordinal)];
        string[] actual = [.. draftTracks.Select(track => RowIdentity(track.Disc, track.Side,
            track.Position, track.Title, track.Duration, track.ArtistNames)).Order(StringComparer.Ordinal)];
        return expected.SequenceEqual(actual);
    }

    private static string RowIdentity(string? disc, string? side, int? position, string title,
        TimeSpan? duration, IReadOnlyList<string> artists)
    {
        return JsonSerializer.Serialize(new { disc, side, position, title, duration, artists });
    }
}
