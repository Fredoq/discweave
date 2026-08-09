using DiscWeave.Application.Catalog;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private async Task ConfirmExternalMetadataAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSession session,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        CancellationToken cancellationToken)
    {
        if (tracks.Length == 0)
        {
            throw new DomainException("release_import.tracks_required", "Release import draft has no tracks to confirm");
        }

        if (draft.SelectedOriginalBinding is not PresentOptionalValue<SelectedOriginalBinding> binding)
        {
            throw new DomainException("import.external_binding_stale", "External original binding is missing");
        }

        ExternalReleaseBindingValidationResult validation = await _externalBindingValidator.RevalidateAsync(
            binding.Value,
            cancellationToken);
        if (validation is ExternalReleaseBindingValidationResult.ProviderFailed failed)
        {
            throw new ExternalReleaseProviderFailureException(failed.Status);
        }

        if (validation is not ExternalReleaseBindingValidationResult.MusicBrainzValid and
            not ExternalReleaseBindingValidationResult.DiscogsBackedValid)
        {
            throw new DomainException(validation.Code, "The reviewed external original binding is no longer valid");
        }

        ReleaseImportDraftTrack boundRow = tracks.SingleOrDefault(track => track.Id == binding.Value.DraftTrackId)
            ?? throw new DomainException("import.external_binding_stale", "External original binding row is missing");
        if (boundRow.TrackMode == ReleaseImportTrackMode.ReleaseOnly || !boundRow.IsOriginal)
        {
            throw new DomainException(
                "import.external_binding_review_invalid",
                "The bound external row must remain an original catalog track");
        }

        IReadOnlyList<Release> releaseMatches = await _externalSourceLookup.FindReleasesAsync(
            collectionId,
            ReleaseIdentities(binding.Value),
            cancellationToken);
        IReadOnlyList<Track> trackMatches = await _externalSourceLookup.FindTracksAsync(
            collectionId,
            TrackIdentities(binding.Value),
            cancellationToken);
        Release? selectedRelease = ResolveSelectedRelease(draft, releaseMatches);
        Track? selectedTrack = ResolveSelectedTrack(draft, trackMatches);
        if (selectedTrack is null && boundRow.TrackMode == ReleaseImportTrackMode.Link)
        {
            throw new DomainException(
                "import.external_provenance_selection_stale",
                "The linked external original Track selection is stale");
        }

        DateTimeOffset confirmationStartedAt = _timeProvider.GetUtcNow();
        IReadOnlyList<ReleaseImportProviderReference> releaseSources = BindingReleaseSources(binding.Value);
        IReadOnlyList<ReleaseImportProviderReference> trackSources = BindingTrackSources(binding.Value);
        IReadOnlyList<ExternalSourceReference> catalogReleaseSources =
            ReleaseImportProviderReferenceCatalogMapper.ToCatalog(releaseSources, confirmationStartedAt);
        IReadOnlyList<ExternalSourceReference> catalogTrackSources =
            ReleaseImportProviderReferenceCatalogMapper.ToCatalog(trackSources, confirmationStartedAt);

        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIds = CreateSelectedTrackMap(tracks);
        Dictionary<ReleaseImportDraftTrackId, ReleaseTrackId> resolvedReleaseTrackIds = [];
        Release release;
        if (selectedRelease is null)
        {
            release = await CreateReleaseAsync(
                context,
                collectionId,
                draft,
                tracks,
                resolvedTrackIds,
                catalogReleaseSources,
                cancellationToken);
        }
        else
        {
            release = selectedRelease;
            await ReconcileTracksAsync(
                new TrackMaterializationScope(
                    context,
                    collectionId,
                    draft,
                    new ImportArtistSourceResolutionCache()),
                release,
                tracks,
                new ResolvedTrackMaps(resolvedTrackIds, resolvedReleaseTrackIds),
                cancellationToken);
            release.UnionExternalSources(catalogReleaseSources);
        }

        if (!resolvedTrackIds.TryGetValue(boundRow.Id, out TrackId boundTrackId))
        {
            throw new DomainException("release_import.selected_track_not_found", "The bound external Track was not resolved");
        }

        Track boundTrack = context.Tracks.Local.FirstOrDefault(track => track.Id == boundTrackId) ??
            await context.Tracks.SingleAsync(
                track => track.CollectionId == collectionId && track.Id == boundTrackId,
                cancellationToken);
        boundTrack.UpdateMetadata(boundTrack.Metadata.WithOriginalMarker(true));
        boundTrack.UnionExternalSources(catalogTrackSources);
        await MaterializeExternalCollectionItemAsync(context, collectionId, release, draft, cancellationToken);

        IReadOnlyList<ImportReviewIssue> relationWarnings = await AddAcceptedTrackRelationsAsync(
            context,
            collectionId,
            session.Id,
            draft,
            resolvedTrackIds,
            cancellationToken);
        AppendDraftIssues(draft, relationWarnings);
        draft.Confirm(release.Id);
        await UpdateSessionStatusAsync(context, session, draft, cancellationToken);
        _ = selectedTrack;
    }

    private static async Task MaterializeExternalCollectionItemAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        ReleaseImportDraft draft,
        CancellationToken cancellationToken)
    {
        if (draft.CollectionItemIntent is not PresentOptionalValue<ReleaseImportCollectionItemIntent> intent)
        {
            throw new DomainException(
                "release_import.collection_item_required",
                "External imports require a collection-item intent");
        }

        switch (intent.Value)
        {
            case ReleaseImportCollectionItemIntent.NewWanted wanted:
                ReleaseImportMediumIntent mediumIntent = wanted.Medium is PresentOptionalValue<ReleaseImportMediumIntent> medium
                    ? medium.Value
                    : throw new DomainException(
                        "release_import.collection_item_medium_required",
                        "A Wanted medium must be selected before confirmation");
                IMedium catalogMedium = ToCatalogMedium(mediumIntent);
                OwnedItem[] existingItems = await context.OwnedItems
                    .Where(item => item.CollectionId == collectionId &&
                        EF.Property<ReleaseId>(item, "_releaseId") == release.Id)
                    .ToArrayAsync(cancellationToken);
                if (existingItems.Any(item => item.Holding.Medium.Code == catalogMedium.Code &&
                    item.Holding.Medium.Description == catalogMedium.Description))
                {
                    return;
                }

                _ = context.OwnedItems.Add(OwnedItem.Create(
                    collectionId,
                    OwnedItemId.New(),
                    release.Id,
                    OwnershipStatus.Wanted,
                    catalogMedium));
                return;
            case ReleaseImportCollectionItemIntent.ReuseExisting reuse:
                OwnedItem item = await context.OwnedItems.SingleOrDefaultAsync(
                    candidate => candidate.CollectionId == collectionId && candidate.Id == reuse.OwnedItemId,
                    cancellationToken) ?? throw new DomainException(
                        "release_import.reuse_owned_item_not_found",
                        "The selected collection item was not found");
                if (item.ReleaseId != release.Id || !reuse.MatchesCurrentMedium(item.Holding.Medium))
                {
                    throw new DomainException(
                        "release_import.reuse_owned_item_invalid",
                        "The selected collection item does not match the confirmed release and medium");
                }

                return;
            default:
                throw new DomainException(
                    "release_import.collection_item_required",
                    "External imports require a supported collection-item intent");
        }
    }

    private static Release? ResolveSelectedRelease(
        ReleaseImportDraft draft,
        IReadOnlyList<Release> matches)
    {
        return matches.Count == 0
            ? null
            : draft.LocalProvenanceSelection is not PresentOptionalValue<ReleaseImportLocalProvenanceSelection> selection || // NOSONAR: the selection fallback distinguishes missing and stale provenance.
            selection.Value.SelectedReleaseId is not PresentOptionalValue<ReleaseId> selected
            ? throw new DomainException(
                "import.external_provenance_ambiguous",
                "A local Release provenance selection is required before confirmation")
            : matches.SingleOrDefault(release => release.Id == selected.Value)
            ?? throw new DomainException(
                "import.external_provenance_selection_stale",
                "The selected Release provenance is stale");
    }

    private static Track? ResolveSelectedTrack(
        ReleaseImportDraft draft,
        IReadOnlyList<Track> matches)
    {
        return matches.Count == 0
            ? null
            : draft.LocalProvenanceSelection is not PresentOptionalValue<ReleaseImportLocalProvenanceSelection> selection || // NOSONAR: the selection fallback distinguishes missing and stale provenance.
            selection.Value.SelectedTrackId is not PresentOptionalValue<TrackId> selected
            ? throw new DomainException(
                "import.external_provenance_ambiguous",
                "A local Track provenance selection is required before confirmation")
            : matches.SingleOrDefault(track => track.Id == selected.Value)
            ?? throw new DomainException(
                "import.external_provenance_selection_stale",
                "The selected Track provenance is stale");
    }

    private static List<ExternalSourceLookupIdentity> ReleaseIdentities(SelectedOriginalBinding binding)
    {
        List<ExternalSourceLookupIdentity> identities =
        [
            ExternalSourceLookupIdentity.Create(
                binding.ReleaseRoute.MusicBrainzRelease.ProviderCode,
                binding.ReleaseRoute.MusicBrainzRelease.ResourceType,
                binding.ReleaseRoute.MusicBrainzRelease.ExternalId)
        ];
        _ = binding.ReleaseRoute.DiscogsRelease.Match(
            source =>
            {
                identities.Add(ExternalSourceLookupIdentity.Create(source.ProviderCode, source.ResourceType, source.ExternalId));
                return true;
            },
            () => true);
        return identities;
    }

    private static IReadOnlyCollection<ExternalSourceLookupIdentity> TrackIdentities(SelectedOriginalBinding binding)
    {
        return
        [
            ExternalSourceLookupIdentity.Create(binding.RecordingSource.ProviderCode, binding.RecordingSource.ResourceType, binding.RecordingSource.ExternalId),
            ExternalSourceLookupIdentity.Create("musicbrainz", "track", binding.MusicBrainzRow.TrackMbid)
        ];
    }

    private static List<ReleaseImportProviderReference> BindingReleaseSources(SelectedOriginalBinding binding)
    {
        List<ReleaseImportProviderReference> sources = [binding.ReleaseRoute.MusicBrainzRelease];
        _ = binding.ReleaseRoute.DiscogsRelease.Match(source => { sources.Add(source); return true; }, () => true);
        return sources;
    }

    private static IReadOnlyList<ReleaseImportProviderReference> BindingTrackSources(SelectedOriginalBinding binding)
    {
        return
        [
            binding.RecordingSource,
            ExternalReleaseProviderReferenceFactory.MusicBrainzTrack(Guid.Parse(binding.MusicBrainzRow.TrackMbid))
        ];
    }

    private static IMedium ToCatalogMedium(ReleaseImportMediumIntent intent)
    {
        return intent switch
        {
            ReleaseImportMediumIntent.Digital => DigitalFile.Create(),
            ReleaseImportMediumIntent.Vinyl vinyl => VinylRecord.Create(vinyl.FormatDescription),
            ReleaseImportMediumIntent.CompactDisc compactDisc => CompactDisc.Create(compactDisc.DiscCount),
            ReleaseImportMediumIntent.Cassette cassette => CassetteTape.Create(cassette.TapeType),
            ReleaseImportMediumIntent.Other other => OtherMedium.Create(other.Name),
            _ => throw new DomainException("release_import.medium_invalid", "External collection-item medium is invalid")
        };
    }
}
