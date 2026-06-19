using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.OwnedItems;

internal static class OwnedItemMapper
{
    private const string OtherTypeCode = "other";

    public static ReleaseId CreateReleaseId(string? targetType, Guid targetId)
    {
        return Required(targetType, "owned_item.target_type_required").Trim() switch
        {
            "release" => new ReleaseId(targetId),
            "track" => throw new DomainException("owned_item.track_target_unsupported", "Owned items must target releases"),
            _ => throw new DomainException("owned_item.target_type_invalid", "Owned item target type is invalid")
        };
    }

    public static OwnedItemHolding CreateHolding(IMedium medium, string status, string? condition, string? storageLocation)
    {
        var holding = OwnedItemHolding.Create(ParseOwnershipStatus(status), medium);
        OwnedItemDetails details = OwnedItemDetails.Empty;

        if (!string.IsNullOrWhiteSpace(condition))
        {
            details = details.WithCondition(ParseItemCondition(condition));
        }

        if (!string.IsNullOrWhiteSpace(storageLocation))
        {
            details = details.WithStorageLocation(StorageLocation.FromName(storageLocation));
        }

        return holding.WithDetails(details);
    }

    public static IMedium CreateMedium(MediumRequest request)
    {
        return Required(request.Type, "medium.type_required").Trim() switch
        {
            "digital" => DigitalFile.Create(),
            "vinyl" => VinylRecord.Create(Required(request.Description, "medium.description_required")),
            "cd" => CompactDisc.Create(request.DiscCount ?? 1),
            "cassette" => CassetteTape.Create(Required(request.Description, "medium.description_required")),
            OtherTypeCode => OtherMedium.Create(Required(request.Description, "medium.description_required")),
            _ => throw new DomainException("medium.type_invalid", "Medium type is invalid")
        };
    }

    public static OwnedItemResponse ToResponse(
        OwnedItem item,
        OwnedItemTargetResponse? targetResponse,
        IReadOnlyList<string> inventorySignals)
    {
        OwnedItemHolding holding = item.Holding;

        return new OwnedItemResponse(
            item.Id.Value,
            "release",
            item.ReleaseId.Value,
            targetResponse,
            ToOwnershipStatusCode(holding.Status),
            ToMediumResponse(holding.Medium),
            holding.Details.Condition.HasValue ? holding.Details.Condition.Match(ToItemConditionCode, () => string.Empty) : null,
            holding.Details.StorageLocation.HasValue ? holding.Details.StorageLocation.Match(location => location.Name, () => string.Empty) : null,
            inventorySignals);
    }

    public static bool TryParseOwnershipStatus(string status, out OwnershipStatus ownershipStatus)
    {
        switch (status.Trim())
        {
            case "owned":
                ownershipStatus = OwnershipStatus.Owned;
                return true;
            case "wanted":
                ownershipStatus = OwnershipStatus.Wanted;
                return true;
            case "sold":
                ownershipStatus = OwnershipStatus.Sold;
                return true;
            case "needsDigitization":
                ownershipStatus = OwnershipStatus.NeedsDigitization;
                return true;
            default:
                ownershipStatus = default;
                return false;
        }
    }

    public static OwnershipStatus ParseOwnershipStatus(string status)
    {
        return Required(status, "owned_item.status_required").Trim() switch
        {
            "owned" => OwnershipStatus.Owned,
            "wanted" => OwnershipStatus.Wanted,
            "sold" => OwnershipStatus.Sold,
            "needsDigitization" => OwnershipStatus.NeedsDigitization,
            _ => throw new DomainException("owned_item.status_invalid", "Owned item status is invalid")
        };
    }

    public static bool TryParseItemCondition(string condition, out ItemCondition itemCondition)
    {
        switch (condition.Trim())
        {
            case "mint":
                itemCondition = ItemCondition.Mint;
                return true;
            case "nearMint":
                itemCondition = ItemCondition.NearMint;
                return true;
            case "veryGoodPlus":
                itemCondition = ItemCondition.VeryGoodPlus;
                return true;
            case "veryGood":
                itemCondition = ItemCondition.VeryGood;
                return true;
            case "good":
                itemCondition = ItemCondition.Good;
                return true;
            case "fair":
                itemCondition = ItemCondition.Fair;
                return true;
            case "poor":
                itemCondition = ItemCondition.Poor;
                return true;
            default:
                itemCondition = default;
                return false;
        }
    }

    private static MediumResponse ToMediumResponse(IMedium medium)
    {
        return medium switch
        {
            DigitalFile digitalFile => new MediumResponse(digitalFile.Code, digitalFile.Description, null, null, null, null, null, null),
            VinylRecord vinylRecord => new MediumResponse(vinylRecord.Code, vinylRecord.FormatDescription, null, null, null, null, null, null),
            CompactDisc compactDisc => new MediumResponse(compactDisc.Code, compactDisc.Description, null, null, compactDisc.DiscCount, null, null, null),
            CassetteTape cassetteTape => new MediumResponse(cassetteTape.Code, cassetteTape.TapeType, null, null, null, null, null, null),
            OtherMedium otherMedium => new MediumResponse(otherMedium.Code, otherMedium.Name, null, null, null, null, null, null),
            _ => throw new InvalidOperationException("Medium type is not supported")
        };
    }

    private static ItemCondition ParseItemCondition(string condition)
    {
        return TryParseItemCondition(Required(condition, "owned_item.condition_required"), out ItemCondition itemCondition)
            ? itemCondition
            : throw new DomainException("owned_item.condition_invalid", "Owned item condition is invalid");
    }

    public static string ToOwnershipStatusCode(OwnershipStatus status)
    {
        return status switch
        {
            OwnershipStatus.Owned => "owned",
            OwnershipStatus.Wanted => "wanted",
            OwnershipStatus.Sold => "sold",
            OwnershipStatus.NeedsDigitization => "needsDigitization",
            _ => throw new InvalidOperationException("Ownership status is not supported")
        };
    }

    private static string ToItemConditionCode(ItemCondition condition)
    {
        return condition switch
        {
            ItemCondition.Mint => "mint",
            ItemCondition.NearMint => "nearMint",
            ItemCondition.VeryGoodPlus => "veryGoodPlus",
            ItemCondition.VeryGood => "veryGood",
            ItemCondition.Good => "good",
            ItemCondition.Fair => "fair",
            ItemCondition.Poor => "poor",
            _ => throw new InvalidOperationException("Item condition is not supported")
        };
    }

    private static string Required(string? value, string code)
    {
        return string.IsNullOrWhiteSpace(value)
            ? throw new DomainException(code, "Required value is missing")
            : value;
    }
}
