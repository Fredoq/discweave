using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Collection;

public sealed record OwnedItemHolding
{
    private OwnedItemHolding(OwnershipStatus status, IMedium medium, OwnedItemDetails details)
    {
        Status = status;
        Medium = medium;
        Details = details;
    }

    public OwnershipStatus Status { get; }

    public IMedium Medium { get; }

    public OwnedItemDetails Details { get; }

    public static OwnedItemHolding Create(OwnershipStatus status, IMedium medium)
    {
        ArgumentNullException.ThrowIfNull(medium);

        return new OwnedItemHolding(
            Guard.DefinedEnum(status, nameof(status), "owned_item.status_invalid"),
            medium,
            OwnedItemDetails.Empty);
    }

    public OwnedItemHolding WithStatus(OwnershipStatus status)
    {
        return new OwnedItemHolding(Guard.DefinedEnum(status, nameof(status), "owned_item.status_invalid"), Medium, Details);
    }

    public OwnedItemHolding WithDetails(OwnedItemDetails details)
    {
        ArgumentNullException.ThrowIfNull(details);
        EnsureDetailsAllowed(Medium, details);

        return new OwnedItemHolding(Status, Medium, details);
    }

    private static void EnsureDetailsAllowed(IMedium medium, OwnedItemDetails details)
    {
        if (medium.Type != OwnedItemType.Digital || (!details.Condition.HasValue && !details.StorageLocation.HasValue))
        {
            return;
        }

        throw new DomainException(
            "owned_item.physical_details_invalid",
            "Digital owned items cannot carry physical condition or storage location");
    }
}
