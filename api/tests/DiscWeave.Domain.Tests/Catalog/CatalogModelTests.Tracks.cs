using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Catalog;

public sealed partial class CatalogModelTests
{
    [Fact]
    public void Track_duration_must_be_positive_when_present()
    {
        var track = Track.Create(CollectionId.New(), TrackId.New(), "Dreams Never End");

        DomainException exception = Assert.Throws<DomainException>(() => track.WithDuration(TimeSpan.Zero));

        Assert.Equal("track.duration_required", exception.Code);
    }

    [Fact]
    public void Track_can_store_duration_genres_and_tags()
    {
        Track track = Track.Create(CollectionId.New(), TrackId.New(), "Dreams Never End")
            .WithDuration(TimeSpan.FromMinutes(3))
            .WithCataloging(
                Cataloging.Empty
                    .WithGenre(Genre.FromName("Post-punk"))
                    .WithTag(Tag.FromName("opener")));

        Assert.Equal(TimeSpan.FromMinutes(3), Assert.IsType<PresentOptionalValue<TimeSpan>>(track.Details.Duration).Value);
        Assert.Contains(track.Cataloging.Genres, genre => genre.Name == "Post-punk");
        Assert.Contains(track.Cataloging.Tags, tag => tag.Name == "opener");
    }
}
