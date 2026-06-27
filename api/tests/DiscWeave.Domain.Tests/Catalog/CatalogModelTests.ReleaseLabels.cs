using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Catalog;

public sealed partial class CatalogModelTests
{
    [Fact]
    public void Release_allows_one_label_with_multiple_catalog_numbers()
    {
        var labelId = LabelId.New();
        var release = Release.Create(CollectionId.New(), ReleaseId.New(), "Adventures Beyond The Ultraworld");

        release.UpdateLabels(
            false,
            [
                ReleaseLabel.Create(labelId, Optional.From("BLRDCD 5"), false),
                ReleaseLabel.Create(labelId, Optional.From("847963. 2"), false)
            ]);

        Assert.Equal(2, release.Labels.Count);
    }

    [Fact]
    public void Release_rejects_duplicate_label_catalog_number_rows()
    {
        var labelId = LabelId.New();
        var release = Release.Create(CollectionId.New(), ReleaseId.New(), "Adventures Beyond The Ultraworld");

        DomainException exception = Assert.Throws<DomainException>(() =>
            release.UpdateLabels(
                false,
                [
                    ReleaseLabel.Create(labelId, Optional.From(" BLRDCD 5 "), false),
                    ReleaseLabel.Create(labelId, Optional.From("BLRDCD 5"), false)
                ]));

        Assert.Equal("release_label.duplicate", exception.Code);
    }
}
