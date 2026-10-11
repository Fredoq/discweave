using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Ratings;

public sealed class FivePointRatingTests
{
    [Theory]
    [InlineData(1, 1, false)]
    [InlineData(5, 1, false)]
    [InlineData(6, 2, false)]
    [InlineData(7, 3, false)]
    [InlineData(8, 4, false)]
    [InlineData(9, 5, false)]
    [InlineData(10, 5, true)]
    public void Legacy_scale_maps_ten_point_values_to_five_points(int legacy, int expected, bool expectedStandout)
    {
        (int value, bool isStandout) = LegacyRatingScale.Convert(legacy);

        Assert.Equal(expected, value);
        Assert.Equal(expectedStandout, isStandout);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(11)]
    public void Legacy_scale_rejects_values_outside_one_to_ten(int legacy)
    {
        DomainException exception = Assert.Throws<DomainException>(() => LegacyRatingScale.Convert(legacy));

        Assert.Equal("rating.out_of_range", exception.Code);
    }

    [Fact]
    public void Standout_requires_the_maximum_rating()
    {
        RatingValue value = CreateTrackRating(Rating.FromValue(5), isStandout: true);

        DomainException exception = Assert.Throws<DomainException>(() => value.UpdateRating(Rating.FromValue(4), true));
        value.UpdateRating(Rating.FromValue(4));

        Assert.Equal("rating.standout_requires_maximum", exception.Code);
        Assert.False(value.IsStandout);
    }

    [Fact]
    public void Criterion_counts_main_artists_and_remixers_toward_artist_averages_by_default()
    {
        var criterion = RatingCriterion.Create(RatingCriterionId.New(), CollectionId.New(), "energy", "Energy", [RatingTargetType.Track], 20);

        Assert.Equal(["mainArtist", "remixer"], criterion.ArtistAverageRoles);

        criterion.UpdateArtistAverageRoles([" producer ", "producer", ""]);

        Assert.Equal(["producer"], criterion.ArtistAverageRoles);

        DomainException exception = Assert.Throws<DomainException>(() => criterion.UpdateArtistAverageRoles(["mainArtist\nproducer"]));

        Assert.Equal("rating_criterion.artist_role_invalid", exception.Code);
        Assert.Equal(["producer"], criterion.ArtistAverageRoles);
    }

    [Fact]
    public void Averages_count_each_rated_track_once_per_release_and_label()
    {
        var criterionId = RatingCriterionId.New();
        var labelId = LabelId.New();
        var album = ReleaseId.New();
        var single = ReleaseId.New();
        TrackId[] tracks = [TrackId.New(), TrackId.New(), TrackId.New()];
        var source = new RatingAverageSource(
            [new RatingAverageCriterion(criterionId, ["mainArtist"])],
            [new RatingAverageTrackRating(criterionId, tracks[0], 5), new RatingAverageTrackRating(criterionId, tracks[1], 2)],
            [new RatingAverageRelease(album, tracks, [labelId]), new RatingAverageRelease(single, [tracks[0]], [labelId])],
            [],
            []);

        IReadOnlyList<RatingAverage> averages = RatingAverageCalculator.Calculate(source);

        RatingAverage albumAverage = Assert.Single(averages, average => average.TargetId == album.Value);
        RatingAverage labelAverage = Assert.Single(averages, average => average.TargetType == RatingTargetType.Label);
        Assert.Equal(3.5m, albumAverage.Average);
        Assert.Equal(2, albumAverage.RatedTrackCount);
        Assert.Equal(3, albumAverage.TrackCount);
        Assert.Equal(5m, Assert.Single(averages, average => average.TargetId == single.Value).Average);
        Assert.Equal(3.5m, labelAverage.Average);
        Assert.Equal(3, labelAverage.TrackCount);
    }

    [Fact]
    public void Artist_average_follows_aliases_and_groups_for_the_configured_roles()
    {
        var criterionId = RatingCriterionId.New();
        var person = ArtistId.New();
        var alias = ArtistId.New();
        var group = ArtistId.New();
        var soloTrack = TrackId.New();
        var aliasTrack = TrackId.New();
        var groupTrack = TrackId.New();
        var producedTrack = TrackId.New();
        var source = new RatingAverageSource(
            [new RatingAverageCriterion(criterionId, ["mainArtist", "remixer"])],
            [
                new RatingAverageTrackRating(criterionId, soloTrack, 5),
                new RatingAverageTrackRating(criterionId, aliasTrack, 4),
                new RatingAverageTrackRating(criterionId, groupTrack, 3),
                new RatingAverageTrackRating(criterionId, producedTrack, 1)
            ],
            [],
            [
                new RatingAverageTrackArtist(soloTrack, person, "mainArtist"),
                new RatingAverageTrackArtist(aliasTrack, alias, "remixer"),
                new RatingAverageTrackArtist(groupTrack, group, "mainArtist"),
                new RatingAverageTrackArtist(producedTrack, person, "producer")
            ],
            [
                new RatingAverageArtistLink(alias, person, RatingAverageCalculator.AliasOfRelationType),
                new RatingAverageArtistLink(alias, group, RatingAverageCalculator.MemberOfRelationType)
            ]);

        IReadOnlyList<RatingAverage> averages = RatingAverageCalculator.Calculate(source);

        Assert.Equal(4m, Assert.Single(averages, average => average.TargetId == person.Value).Average);
        Assert.Equal(3, Assert.Single(averages, average => average.TargetId == person.Value).RatedTrackCount);
        Assert.Equal(4m, Assert.Single(averages, average => average.TargetId == alias.Value).Average);
        Assert.Equal(3m, Assert.Single(averages, average => average.TargetId == group.Value).Average);
        Assert.Equal(3, Assert.Single(averages, average => average.TargetId == person.Value).TrackCount);
    }

    [Fact]
    public void Targets_with_tracks_but_no_ratings_report_their_track_count()
    {
        var criterionId = RatingCriterionId.New();
        var artist = ArtistId.New();
        var track = TrackId.New();
        var source = new RatingAverageSource(
            [new RatingAverageCriterion(criterionId, ["mainArtist"])],
            [],
            [],
            [new RatingAverageTrackArtist(track, artist, "mainArtist")],
            []);

        RatingAverage average = Assert.Single(RatingAverageCalculator.Calculate(source));

        Assert.Equal(1, average.TrackCount);
        Assert.Equal(0, average.RatedTrackCount);
    }

    private static RatingValue CreateTrackRating(Rating rating, bool isStandout)
    {
        return RatingValue.Create(
            CollectionId.New(),
            RatingValueId.New(),
            RatingCriterionId.New(),
            RatingTarget.ForTrack(TrackId.New()),
            rating,
            isStandout);
    }
}
