using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    private TrackId? _bindingSourceTrackId;
    private ReleaseImportDraftTrackId? _bindingDraftTrackId;
    private string? _bindingRecordingExternalId;
    private string? _bindingRecordingSourceUrl;
    private string? _bindingMusicBrainzReleaseExternalId;
    private string? _bindingMusicBrainzReleaseSourceUrl;
    private string? _bindingDiscogsReleaseExternalId;
    private string? _bindingDiscogsReleaseSourceUrl;
    private string? _bindingMusicBrainzReleaseMbid;
    private string? _bindingMusicBrainzMediumPosition;
    private string? _bindingMusicBrainzTrackMbid;
    private string? _bindingDiscogsRowReleaseId;
    private int? _bindingDiscogsRowOrdinal;
    private string? _bindingDiscogsRowPosition;
    private string? _bindingDiscogsRowFingerprint;
    private bool _bindingPromoteLinkedTargetConfirmed;
    private string? _collectionItemIntentKind;
    private OwnedItemId? _reuseOwnedItemId;
    private string? _intentMediumKind;
    private string? _intentMediumText;
    private int? _intentMediumDiscCount;
    private ReleaseId? _selectedReleaseId;
    private TrackId? _selectedTrackId;

    private void HydrateExternalReviewState()
    {
        if (SourceKind != ReleaseImportSourceKind.ExternalMetadata)
        {
            return;
        }

        _selectedOriginalBinding ??= RehydrateBinding();
        _collectionItemIntent ??= RehydrateCollectionItemIntent();
        _localProvenanceSelection ??= RehydrateLocalProvenanceSelection();
    }

    private ReleaseImportCollectionItemIntent? RehydrateCollectionItemIntent()
    {
        return _collectionItemIntentKind switch
        {
            null => null,
            "newWanted" => _intentMediumKind is null
                ? ReleaseImportCollectionItemIntent.NewWanted.WithoutMedium()
                : ReleaseImportCollectionItemIntent.NewWanted.WithMedium(RehydrateMedium()),
            "reuseExisting" => ReleaseImportCollectionItemIntent.ReuseExisting.Create(
                _reuseOwnedItemId ?? throw CorruptExternalReviewState(),
                RehydrateMedium()),
            _ => throw CorruptExternalReviewState()
        };
    }

    private ReleaseImportMediumIntent RehydrateMedium()
    {
        return _intentMediumKind switch
        {
            "digital" => ReleaseImportMediumIntent.Digital.Create(),
            "vinyl" => ReleaseImportMediumIntent.Vinyl.Create(Required(_intentMediumText)),
            "cd" => ReleaseImportMediumIntent.CompactDisc.Create(
                _intentMediumDiscCount ?? throw CorruptExternalReviewState()),
            "cassette" => ReleaseImportMediumIntent.Cassette.Create(Required(_intentMediumText)),
            "other" => ReleaseImportMediumIntent.Other.Create(Required(_intentMediumText)),
            _ => throw CorruptExternalReviewState()
        };
    }

    private ReleaseImportLocalProvenanceSelection RehydrateLocalProvenanceSelection()
    {
        var selection = ReleaseImportLocalProvenanceSelection.Empty();
        if (_selectedReleaseId.HasValue)
        {
            selection = selection.WithRelease(_selectedReleaseId.Value);
        }

        return _selectedTrackId.HasValue ? selection.WithTrack(_selectedTrackId.Value) : selection;
    }

    private void PersistCollectionItemIntent(ReleaseImportCollectionItemIntent intent)
    {
        ArgumentNullException.ThrowIfNull(intent);
        _collectionItemIntent = intent;
        ClearMediumFields();
        switch (intent)
        {
            case ReleaseImportCollectionItemIntent.NewWanted wanted:
                _collectionItemIntentKind = "newWanted";
                _reuseOwnedItemId = null;
                _ = wanted.Medium.Match(PersistMedium, () => true);
                break;
            case ReleaseImportCollectionItemIntent.ReuseExisting reuse:
                _collectionItemIntentKind = "reuseExisting";
                _reuseOwnedItemId = reuse.OwnedItemId;
                _ = PersistMedium(reuse.ExpectedMedium);
                break;
            default:
                throw new InvalidOperationException("External collection item intent is not supported");
        }
    }

    private bool PersistMedium(ReleaseImportMediumIntent medium)
    {
        switch (medium)
        {
            case ReleaseImportMediumIntent.Digital:
                _intentMediumKind = "digital";
                break;
            case ReleaseImportMediumIntent.Vinyl vinyl:
                _intentMediumKind = "vinyl";
                _intentMediumText = vinyl.FormatDescription;
                break;
            case ReleaseImportMediumIntent.CompactDisc compactDisc:
                _intentMediumKind = "cd";
                _intentMediumDiscCount = compactDisc.DiscCount;
                break;
            case ReleaseImportMediumIntent.Cassette cassette:
                _intentMediumKind = "cassette";
                _intentMediumText = cassette.TapeType;
                break;
            case ReleaseImportMediumIntent.Other other:
                _intentMediumKind = "other";
                _intentMediumText = other.Name;
                break;
            default:
                throw new InvalidOperationException("External collection item medium is not supported");
        }

        return true;
    }

    private void PersistLocalProvenanceSelection(ReleaseImportLocalProvenanceSelection selection)
    {
        ArgumentNullException.ThrowIfNull(selection);
        _localProvenanceSelection = selection;
        _selectedReleaseId = selection.SelectedReleaseId.HasValue
            ? ((PresentOptionalValue<ReleaseId>)selection.SelectedReleaseId).Value
            : null;
        _selectedTrackId = selection.SelectedTrackId.HasValue
            ? ((PresentOptionalValue<TrackId>)selection.SelectedTrackId).Value
            : null;
    }

    private void ClearMediumFields()
    {
        _intentMediumKind = null;
        _intentMediumText = null;
        _intentMediumDiscCount = null;
    }

    private static string Required(string? value)
    {
        return value ?? throw CorruptExternalReviewState();
    }

    private static InvalidOperationException CorruptExternalReviewState()
    {
        return new InvalidOperationException("Persisted external review state is incomplete");
    }
}
