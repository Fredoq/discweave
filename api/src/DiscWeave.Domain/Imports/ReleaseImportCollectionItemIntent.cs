using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public abstract class ReleaseImportCollectionItemIntent
{
    private ReleaseImportCollectionItemIntent()
    {
    }

    public sealed class NewWanted : ReleaseImportCollectionItemIntent
    {
        private NewWanted(IOptionalValue<ReleaseImportMediumIntent> medium)
        {
            Medium = medium;
        }

        public IOptionalValue<ReleaseImportMediumIntent> Medium { get; }

        public static NewWanted WithoutMedium()
        {
            return new NewWanted(Optional.Missing<ReleaseImportMediumIntent>());
        }

        public static NewWanted WithMedium(ReleaseImportMediumIntent medium)
        {
            ArgumentNullException.ThrowIfNull(medium);
            return new NewWanted(Optional.From(medium));
        }
    }

    public sealed class ReuseExisting : ReleaseImportCollectionItemIntent
    {
        private ReuseExisting(OwnedItemId ownedItemId, ReleaseImportMediumIntent expectedMedium)
        {
            OwnedItemId = ownedItemId;
            ExpectedMedium = expectedMedium;
        }

        public OwnedItemId OwnedItemId { get; }

        public ReleaseImportMediumIntent ExpectedMedium { get; }

        public static ReuseExisting Create(
            OwnedItemId ownedItemId,
            ReleaseImportMediumIntent expectedMedium)
        {
            if (ownedItemId.Value == Guid.Empty)
            {
                throw new DomainException(
                    "release_import.reuse_owned_item_required",
                    "Reused collection item ID is required");
            }

            ArgumentNullException.ThrowIfNull(expectedMedium);
            return new ReuseExisting(ownedItemId, expectedMedium);
        }

        public bool MatchesCurrentMedium(IMedium currentMedium)
        {
            return ExpectedMedium.Matches(currentMedium);
        }
    }
}
