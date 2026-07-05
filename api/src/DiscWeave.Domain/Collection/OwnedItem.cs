using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Collection;

public sealed class OwnedItem : IEntity<OwnedItemId>
{
    private const string DigitalMediumCode = "digital";
    private const string VinylMediumCode = "vinyl";
    private const string CompactDiscMediumCode = "cd";
    private const string CassetteMediumCode = "cassette";
    private const string OtherMediumCode = "other";

#pragma warning disable IDE0032
    private ReleaseId _releaseId;
#pragma warning restore IDE0032
    private OwnershipStatus _status;
    private string _mediumType = string.Empty;
    private string? _vinylFormatDescription;
    private int? _compactDiscCount;
    private string? _cassetteTapeType;
    private string? _otherMediumName;
    private ItemCondition? _condition;
    private string? _storageLocation;
    private string _note = string.Empty;

    private OwnedItem()
    {
    }

    private OwnedItem(
        CollectionId collectionId,
        OwnedItemId id,
        ReleaseId releaseId,
        OwnedItemHolding holding)
    {
        CollectionId = collectionId;
        Id = id;
        _releaseId = releaseId;
        SetHolding(holding);
    }

    public CollectionId CollectionId { get; private set; }

    public OwnedItemId Id { get; private set; }

    public ReleaseId ReleaseId => _releaseId;

    public OwnedItemHolding Holding => CreateHolding();

    public static OwnedItem Create(CollectionId collectionId, OwnedItemId id, ReleaseId releaseId, OwnershipStatus status, IMedium medium)
    {
        return new OwnedItem(collectionId, id, releaseId, OwnedItemHolding.Create(status, medium));
    }

    public OwnedItem WithCondition(ItemCondition condition)
    {
        return new OwnedItem(CollectionId, Id, ReleaseId, Holding.WithDetails(Holding.Details.WithCondition(condition)));
    }

    public OwnedItem WithStorageLocation(StorageLocation storageLocation)
    {
        return new OwnedItem(CollectionId, Id, ReleaseId, Holding.WithDetails(Holding.Details.WithStorageLocation(storageLocation)));
    }

    public void UpdateHolding(OwnedItemHolding holding)
    {
        SetHolding(holding);
    }

    public void UpdateRelease(ReleaseId releaseId)
    {
        _releaseId = releaseId;
    }

    private void SetHolding(OwnedItemHolding holding)
    {
        ArgumentNullException.ThrowIfNull(holding);

        _status = holding.Status;
        SetMedium(holding.Medium);
        _condition = holding.Details.Condition is PresentOptionalValue<ItemCondition> presentCondition
            ? presentCondition.Value
            : null;
        _storageLocation = holding.Details.StorageLocation is PresentOptionalValue<StorageLocation> presentStorageLocation
            ? presentStorageLocation.Value.Name
            : null;
        _note = holding.Details.Note;
    }

    private OwnedItemHolding CreateHolding()
    {
        var holding = OwnedItemHolding.Create(_status, CreateMedium());
        OwnedItemDetails details = OwnedItemDetails.Empty;

        if (_condition is { } itemCondition)
        {
            details = details.WithCondition(itemCondition);
        }

        if (_storageLocation is { } location)
        {
            details = details.WithStorageLocation(StorageLocation.FromName(location));
        }

        if (_note.Length > 0)
        {
            details = details.WithNote(_note);
        }

        return holding.WithDetails(details);
    }

    private void SetMedium(IMedium medium)
    {
        switch (medium)
        {
            case DigitalFile:
                SetDigitalFile();
                break;
            case VinylRecord vinylRecord:
                ClearMediumDetails();
                _mediumType = VinylMediumCode;
                _vinylFormatDescription = vinylRecord.FormatDescription;
                break;
            case CompactDisc compactDisc:
                ClearMediumDetails();
                _mediumType = CompactDiscMediumCode;
                _compactDiscCount = compactDisc.DiscCount;
                break;
            case CassetteTape cassetteTape:
                ClearMediumDetails();
                _mediumType = CassetteMediumCode;
                _cassetteTapeType = cassetteTape.TapeType;
                break;
            case OtherMedium otherMedium:
                ClearMediumDetails();
                _mediumType = OtherMediumCode;
                _otherMediumName = otherMedium.Name;
                break;
            default:
                throw new InvalidOperationException("Medium type is not supported");
        }
    }

    private void SetDigitalFile()
    {
        ClearMediumDetails();
        _mediumType = DigitalMediumCode;
    }

    private IMedium CreateMedium()
    {
        return _mediumType switch
        {
            DigitalMediumCode => DigitalFile.Create(),
            VinylMediumCode when _vinylFormatDescription is not null => VinylRecord.Create(_vinylFormatDescription),
            CompactDiscMediumCode when _compactDiscCount is { } discCount => CompactDisc.Create(discCount),
            CassetteMediumCode when _cassetteTapeType is not null => CassetteTape.Create(_cassetteTapeType),
            OtherMediumCode when _otherMediumName is not null => OtherMedium.Create(_otherMediumName),
            _ => throw new InvalidOperationException("Medium payload is not valid")
        };
    }

    private void ClearMediumDetails()
    {
        _vinylFormatDescription = null;
        _compactDiscCount = null;
        _cassetteTapeType = null;
        _otherMediumName = null;
    }
}
