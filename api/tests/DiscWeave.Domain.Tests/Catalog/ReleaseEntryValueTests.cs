using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Catalog;

public sealed class ReleaseEntryValueTests
{
    [Fact]
    public void Release_track_normalizes_optional_title_override()
    {
        var trimmedTrack = ReleaseTrack.Create(
            TrackId.New(),
            TrackPosition.FromNumber(1),
            Optional.From("  Extended mix  "));
        var blankTrack = ReleaseTrack.Create(
            TrackId.New(),
            TrackPosition.FromNumber(2),
            Optional.From("   "));

        Assert.Equal("Extended mix", Assert.IsType<PresentOptionalValue<string>>(trimmedTrack.TitleOverride).Value);
        Assert.False(blankTrack.TitleOverride.HasValue);
    }

    [Fact]
    public void Release_label_normalizes_catalog_number_and_rejects_blank_values()
    {
        var releaseLabel = ReleaseLabel.Create(LabelId.New(), Optional.From("  FAC 73  "), false);

        DomainException exception = Assert.Throws<DomainException>(() =>
            ReleaseLabel.Create(LabelId.New(), Optional.From("   "), false));

        Assert.Equal("FAC 73", Assert.IsType<PresentOptionalValue<string>>(releaseLabel.CatalogNumber).Value);
        Assert.Equal("release_label.catalog_number_required", exception.Code);
    }
}
