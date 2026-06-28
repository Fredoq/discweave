using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Catalog;

public sealed partial class CatalogModelTests
{
    [Fact]
    public void Track_metadata_stores_the_version_year_and_original_marker()
    {
        var track = Track.Create(CollectionId.New(), TrackId.New(), "Blue Monday");

        track.UpdateMetadata(TrackMetadata.Empty
            .WithVersionYear(1983)
            .WithOriginalMarker(true));

        Assert.Equal(1983, Assert.IsType<PresentOptionalValue<int>>(track.Metadata.VersionYear).Value);
        Assert.True(track.Metadata.IsOriginal);

        track.UpdateMetadata(track.Metadata
            .WithoutVersionYear()
            .WithOriginalMarker(false));

        Assert.False(track.Metadata.VersionYear.HasValue);
        Assert.False(track.Metadata.IsOriginal);
    }

    [Theory]
    [InlineData(999)]
    [InlineData(10000)]
    public void Track_metadata_rejects_non_four_digit_version_years(int year)
    {
        DomainException exception = Assert.Throws<DomainException>(() =>
            TrackMetadata.Empty.WithVersionYear(year));

        Assert.Equal("track.version_year_invalid", exception.Code);
    }

    [Fact]
    public void Release_tracklist_rows_can_be_release_only_without_catalog_tracks()
    {
        var collectionId = CollectionId.New();
        var releaseTrackId = ReleaseTrackId.New();
        var releaseTrack = ReleaseTrack.CreateReleaseOnly(
            releaseTrackId,
            TrackPosition.FromNumber(2, "1", "A"),
            "  DJ transition  ");

        Release release = Release.Create(collectionId, ReleaseId.New(), "Live at the Hacienda")
            .WithTrack(releaseTrack);

        ReleaseTrack actualTrack = release.Tracklist.Single();

        Assert.Equal(releaseTrackId, actualTrack.Id);
        Assert.Null(actualTrack.TrackId);
        Assert.True(actualTrack.IsReleaseOnly);
        Assert.Equal("DJ transition", Assert.IsType<PresentOptionalValue<string>>(actualTrack.TitleOverride).Value);
        Assert.Equal(collectionId, actualTrack.CollectionId);
        Assert.Equal(release.Id, actualTrack.ReleaseId);
    }
}
