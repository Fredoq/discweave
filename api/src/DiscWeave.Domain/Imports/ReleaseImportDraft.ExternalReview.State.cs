using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    public IOptionalValue<SelectedOriginalBinding> SelectedOriginalBinding
    {
        get
        {
            HydrateExternalReviewState();
            return _selectedOriginalBinding is null
                ? Optional.Missing<SelectedOriginalBinding>()
                : Optional.From(_selectedOriginalBinding);
        }
    }

    public IOptionalValue<ReleaseImportCollectionItemIntent> CollectionItemIntent
    {
        get
        {
            HydrateExternalReviewState();
            return _collectionItemIntent is null
                ? Optional.Missing<ReleaseImportCollectionItemIntent>()
                : Optional.From(_collectionItemIntent);
        }
    }

    public IOptionalValue<ReleaseImportLocalProvenanceSelection> LocalProvenanceSelection
    {
        get
        {
            HydrateExternalReviewState();
            return _localProvenanceSelection is null
                ? Optional.Missing<ReleaseImportLocalProvenanceSelection>()
                : Optional.From(_localProvenanceSelection);
        }
    }
}
