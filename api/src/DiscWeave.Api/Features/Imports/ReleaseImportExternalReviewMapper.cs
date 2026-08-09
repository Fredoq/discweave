using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Imports;

internal static class ReleaseImportExternalReviewMapper
{
    internal static ReleaseImportSelectedOriginalBindingDto? ToBindingDto(ReleaseImportDraft draft)
    {
        return draft.SelectedOriginalBinding is PresentOptionalValue<SelectedOriginalBinding> present
            ? ToBindingDto(present.Value)
            : null;
    }

    internal static ReleaseImportCollectionItemIntentDto? ToIntentDto(ReleaseImportDraft draft)
    {
        return draft.CollectionItemIntent is PresentOptionalValue<ReleaseImportCollectionItemIntent> present
            ? ToIntentDto(present.Value)
            : null;
    }

    internal static ReleaseImportLocalProvenanceSelectionDto? ToLocalSelectionDto(ReleaseImportDraft draft)
    {
        if (draft.LocalProvenanceSelection is not PresentOptionalValue<ReleaseImportLocalProvenanceSelection> present)
        {
            return null;
        }

        Guid? releaseId = present.Value.SelectedReleaseId is PresentOptionalValue<ReleaseId> release
            ? release.Value.Value
            : null;
        Guid? trackId = present.Value.SelectedTrackId is PresentOptionalValue<TrackId> track
            ? track.Value.Value
            : null;
        return new ReleaseImportLocalProvenanceSelectionDto(releaseId, trackId);
    }

    internal static void ApplyEditableReviewState(
        ReleaseImportDraftUpdateRequest request,
        ReleaseImportDraft draft)
    {
        try
        {
            if (request.ExternalReviewRevision != draft.ExternalReviewRevision ||
                CanonicalBinding(request.SelectedOriginalBinding) != ToBindingDto(draft) ||
                request.LocalProvenanceSelection != ToLocalSelectionDto(draft))
            {
                throw ReadOnlyException();
            }

            ReleaseImportCollectionItemIntentDto requestedIntent = CanonicalIntent(
                request.CollectionItemIntent) ?? throw ReadOnlyException();

            if (requestedIntent != ToIntentDto(draft))
            {
                draft.SetExternalCollectionItemIntent(ToIntentDomain(requestedIntent));
            }
        }
        catch (DomainException exception) when (exception.Code != "import.external_binding_read_only")
        {
            throw ReadOnlyException();
        }
    }

    private static ReleaseImportCollectionItemIntent ToIntentDomain(
        ReleaseImportCollectionItemIntentDto intent)
    {
        return intent.Kind switch
        {
            "newWanted" when intent.OwnedItemId is null && intent.ExpectedMedium is null =>
                intent.Medium is null
                    ? ReleaseImportCollectionItemIntent.NewWanted.WithoutMedium()
                    : ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ToMedium(intent.Medium)),
            "reuseExisting" when intent.Medium is null && intent.OwnedItemId.HasValue && intent.ExpectedMedium is not null =>
                ReleaseImportCollectionItemIntent.ReuseExisting.Create(
                    new OwnedItemId(intent.OwnedItemId.Value),
                    ToMedium(intent.ExpectedMedium)),
            _ => throw ReadOnlyException()
        };
    }

    private static ReleaseImportSelectedOriginalBindingDto ToBindingDto(SelectedOriginalBinding binding)
    {
        ReleaseImportProviderReferenceResponse recording = ToProviderDto(binding.RecordingSource);
        ReleaseImportProviderReferenceResponse musicBrainzRelease = ToProviderDto(
            binding.ReleaseRoute.MusicBrainzRelease);
        ReleaseImportProviderReferenceResponse? discogsRelease =
            binding.ReleaseRoute.DiscogsRelease is PresentOptionalValue<ReleaseImportProviderReference> release
                ? ToProviderDto(release.Value)
                : null;
        ReleaseImportDiscogsRowDto? discogsRow =
            binding.DiscogsRow is PresentOptionalValue<DiscogsReleaseRowLocator> row
                ? new ReleaseImportDiscogsRowDto(
                    row.Value.ReleaseId,
                    row.Value.RowOrdinal,
                    row.Value.Position,
                    row.Value.Fingerprint)
                : null;
        return new ReleaseImportSelectedOriginalBindingDto(
            binding.SourceTrackId.Value,
            binding.DraftTrackId.Value,
            recording,
            new ReleaseImportExternalReleaseRouteDto(musicBrainzRelease, discogsRelease),
            new ReleaseImportMusicBrainzRowDto(
                binding.MusicBrainzRow.ReleaseMbid,
                binding.MusicBrainzRow.MediumPosition,
                binding.MusicBrainzRow.TrackMbid),
            discogsRow,
            binding.PromoteLinkedTargetConfirmed);
    }

    private static ReleaseImportSelectedOriginalBindingDto? CanonicalBinding(
        ReleaseImportSelectedOriginalBindingDto? binding)
    {
        if (binding is null)
        {
            return null;
        }

        ReleaseImportProviderReference recording = ToProviderReference(binding.RecordingSource);
        ReleaseImportProviderReference musicBrainzRelease = ToProviderReference(
            binding.ReleaseRoute.MusicBrainzRelease);
        var musicBrainzRow = MusicBrainzReleaseRowLocator.Create(
            binding.MusicBrainzRow.ReleaseMbid,
            binding.MusicBrainzRow.MediumPosition,
            binding.MusicBrainzRow.TrackMbid);
        SelectedOriginalBinding canonical = binding.ReleaseRoute.DiscogsRelease is null && binding.DiscogsRow is null
            ? SelectedOriginalBinding.CreateMusicBrainz(
                new TrackId(binding.SourceTrackId),
                new ReleaseImportDraftTrackId(binding.DraftTrackId),
                recording,
                ExternalReleaseRoute.CreateMusicBrainz(musicBrainzRelease),
                musicBrainzRow,
                binding.PromoteLinkedTargetConfirmed)
            : binding.ReleaseRoute.DiscogsRelease is not null && binding.DiscogsRow is not null
                ? SelectedOriginalBinding.CreateDiscogsBacked(
                new TrackId(binding.SourceTrackId),
                new ReleaseImportDraftTrackId(binding.DraftTrackId),
                recording,
                ExternalReleaseRoute.CreateDiscogsBacked(
                    musicBrainzRelease,
                    ToProviderReference(binding.ReleaseRoute.DiscogsRelease)),
                musicBrainzRow,
                DiscogsReleaseRowLocator.Create(
                    binding.DiscogsRow.ReleaseId,
                    binding.DiscogsRow.RowOrdinal,
                    binding.DiscogsRow.Position,
                    binding.DiscogsRow.Fingerprint),
                binding.PromoteLinkedTargetConfirmed)
                : throw ReadOnlyException();

        return ToBindingDto(canonical);
    }

    private static ReleaseImportCollectionItemIntentDto ToIntentDto(
        ReleaseImportCollectionItemIntent intent)
    {
        return intent switch
        {
            ReleaseImportCollectionItemIntent.NewWanted wanted => new ReleaseImportCollectionItemIntentDto(
                "newWanted",
                wanted.Medium is PresentOptionalValue<ReleaseImportMediumIntent> medium
                    ? ToMediumDto(medium.Value)
                    : null,
                null,
                null),
            ReleaseImportCollectionItemIntent.ReuseExisting reuse => new ReleaseImportCollectionItemIntentDto(
                "reuseExisting",
                null,
                reuse.OwnedItemId.Value,
                ToMediumDto(reuse.ExpectedMedium)),
            _ => throw new InvalidOperationException("External collection item intent is not supported")
        };
    }

    private static ReleaseImportCollectionItemIntentDto? CanonicalIntent(
        ReleaseImportCollectionItemIntentDto? intent)
    {
        return intent is null ? null : ToIntentDto(ToIntentDomain(intent));
    }

    private static ReleaseImportMediumIntentDto ToMediumDto(ReleaseImportMediumIntent medium)
    {
        return medium switch
        {
            ReleaseImportMediumIntent.Digital => new ReleaseImportMediumIntentDto("digital"),
            ReleaseImportMediumIntent.Vinyl vinyl => new ReleaseImportMediumIntentDto(
                "vinyl", FormatDescription: vinyl.FormatDescription),
            ReleaseImportMediumIntent.CompactDisc compactDisc => new ReleaseImportMediumIntentDto(
                "cd", DiscCount: compactDisc.DiscCount),
            ReleaseImportMediumIntent.Cassette cassette => new ReleaseImportMediumIntentDto(
                "cassette", TapeType: cassette.TapeType),
            ReleaseImportMediumIntent.Other other => new ReleaseImportMediumIntentDto(
                "other", Name: other.Name),
            _ => throw new InvalidOperationException("External collection item medium is not supported")
        };
    }

    private static ReleaseImportMediumIntent ToMedium(ReleaseImportMediumIntentDto medium)
    {
        return medium.Kind switch
        {
            "digital" => ReleaseImportMediumIntent.Digital.Create(),
            "vinyl" => ReleaseImportMediumIntent.Vinyl.Create(medium.FormatDescription ?? string.Empty),
            "cd" => ReleaseImportMediumIntent.CompactDisc.Create(medium.DiscCount ?? 0),
            "cassette" => ReleaseImportMediumIntent.Cassette.Create(medium.TapeType ?? string.Empty),
            "other" => ReleaseImportMediumIntent.Other.Create(medium.Name ?? string.Empty),
            _ => throw ReadOnlyException()
        };
    }

    private static ReleaseImportProviderReferenceResponse ToProviderDto(ReleaseImportProviderReference source)
    {
        return new ReleaseImportProviderReferenceResponse
        {
            ProviderCode = source.ProviderCode,
            ResourceType = source.ResourceType,
            ExternalId = source.ExternalId,
            SourceUrl = source.SourceUrl
        };
    }

    private static ReleaseImportProviderReference ToProviderReference(ReleaseImportProviderReferenceResponse source)
    {
        return ReleaseImportProviderReference.Create(
            source.ProviderCode,
            source.ResourceType,
            source.ExternalId,
            source.SourceUrl);
    }

    private static DomainException ReadOnlyException()
    {
        return new DomainException(
            "import.external_binding_read_only",
            "External import binding and intent are read-only");
    }
}
