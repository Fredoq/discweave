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
    private string? _digitalFilePath;
    private AudioFileFormat? _digitalFileFormat;
    private string? _importIdentityPath;
    private long? _importIdentitySizeBytes;
    private DateTimeOffset? _importIdentityLastModifiedAt;
    private string? _importIdentityContentHash;
    private string? _vinylFormatDescription;
    private int? _compactDiscCount;
    private string? _cassetteTapeType;
    private string? _otherMediumName;
    private ItemCondition? _condition;
    private string? _storageLocation;

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

        return holding.WithDetails(details);
    }

    private void SetMedium(IMedium medium)
    {
        switch (medium)
        {
            case DigitalFile digitalFile:
                SetDigitalFile(digitalFile);
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

    private void SetDigitalFile(DigitalFile digitalFile)
    {
        ClearMediumDetails();
        _mediumType = DigitalMediumCode;
        _digitalFilePath = digitalFile.Path.Value;
        _digitalFileFormat = digitalFile.Format;

        if (digitalFile.ImportIdentity is PresentOptionalValue<FileImportIdentity> presentImportIdentity)
        {
            FileImportIdentity importIdentity = presentImportIdentity.Value;
            _importIdentityPath = importIdentity.Path.Value;
            _importIdentitySizeBytes = importIdentity.SizeBytes;
            _importIdentityLastModifiedAt = importIdentity.LastModifiedAt;
            _importIdentityContentHash = importIdentity.ContentHash is PresentOptionalValue<string> presentContentHash
                ? presentContentHash.Value
                : null;
        }
    }

    private IMedium CreateMedium()
    {
        return _mediumType switch
        {
            DigitalMediumCode when _digitalFilePath is not null && _digitalFileFormat is { } format => CreateDigitalFile(format),
            VinylMediumCode when _vinylFormatDescription is not null => VinylRecord.Create(_vinylFormatDescription),
            CompactDiscMediumCode when _compactDiscCount is { } discCount => CompactDisc.Create(discCount),
            CassetteMediumCode when _cassetteTapeType is not null => CassetteTape.Create(_cassetteTapeType),
            OtherMediumCode when _otherMediumName is not null => OtherMedium.Create(_otherMediumName),
            _ => throw new InvalidOperationException("Medium payload is not valid")
        };
    }

    private DigitalFile CreateDigitalFile(AudioFileFormat format)
    {
        var path = FilePath.FromAbsolutePath(_digitalFilePath ?? throw new InvalidOperationException("Digital file path is required"));

        bool hasAnyImportIdentityField =
            _importIdentityPath is not null ||
            _importIdentitySizeBytes is not null ||
            _importIdentityLastModifiedAt is not null ||
            _importIdentityContentHash is not null;

        if (!hasAnyImportIdentityField)
        {
            return DigitalFile.Create(path, format);
        }

        if (_importIdentityPath is null || _importIdentitySizeBytes is null || _importIdentityLastModifiedAt is null)
        {
            throw new InvalidOperationException("Digital file import identity payload is not valid");
        }

        var identityPath = FilePath.FromAbsolutePath(_importIdentityPath);
        FileImportIdentity identity = _importIdentityContentHash is null
            ? FileImportIdentity.Create(identityPath, _importIdentitySizeBytes.Value, _importIdentityLastModifiedAt.Value)
            : FileImportIdentity.Create(identityPath, _importIdentitySizeBytes.Value, _importIdentityLastModifiedAt.Value, _importIdentityContentHash);

        return DigitalFile.Create(path, format, identity);
    }

    private void ClearMediumDetails()
    {
        _digitalFilePath = null;
        _digitalFileFormat = null;
        _importIdentityPath = null;
        _importIdentitySizeBytes = null;
        _importIdentityLastModifiedAt = null;
        _importIdentityContentHash = null;
        _vinylFormatDescription = null;
        _compactDiscCount = null;
        _cassetteTapeType = null;
        _otherMediumName = null;
    }
}
