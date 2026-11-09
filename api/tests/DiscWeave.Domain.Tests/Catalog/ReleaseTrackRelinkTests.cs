using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Catalog;

public sealed class ReleaseTrackRelinkTests
{
    [Fact]
    public void Relinking_a_track_preserves_the_release_row_identity_and_edition_metadata()
    {
        var rowId = ReleaseTrackId.New();
        var replacementId = TrackId.New();
        var artistId = ArtistId.New();
        var position = TrackPosition.FromNumber(2, "CD 2", "A");
        ReleaseTrack row = ReleaseTrack.Create(rowId, TrackId.New(), position, "Edition title")
            .WithArtistCredits([ReleaseTrackArtistCredit.Create(artistId, ["mainArtist", "producer"])]);
        var release = Release.Create(CollectionId.New(), ReleaseId.New(), "Compilation");
        release.ReplaceTracklist([row]);
        TrackDetails details = row.Details;

        row.RelinkTrack(replacementId);

        Assert.Equal(replacementId, row.TrackId);
        Assert.Equal(rowId, row.Id);
        Assert.Equal(release.CollectionId, row.CollectionId);
        Assert.Equal(release.Id, row.ReleaseId);
        Assert.Same(row, Assert.Single(release.Tracklist));
        Assert.Same(position, row.Position);
        Assert.Same(details, row.Details);
        Assert.Equal("Edition title", Assert.IsType<PresentOptionalValue<string>>(row.TitleOverride).Value);
        ReleaseTrackArtistCredit credit = Assert.Single(row.ArtistCredits);
        Assert.Equal(artistId, credit.ArtistId);
        Assert.Equal(["mainArtist", "producer"], credit.Roles);
        Assert.False(row.IsReleaseOnly);
    }

    [Fact]
    public void Relinking_to_an_empty_track_id_rejects_the_change_and_keeps_the_existing_link()
    {
        var trackId = TrackId.New();
        var row = ReleaseTrack.Create(trackId, TrackPosition.FromNumber(1));

        _ = Assert.Throws<ArgumentException>(() => row.RelinkTrack(default));

        Assert.Equal(trackId, row.TrackId);
    }

    [Fact]
    public void Relinking_a_release_only_row_rejects_the_change_and_keeps_its_local_details()
    {
        TrackDetails details = TrackDetails.Empty.WithDuration(TimeSpan.FromSeconds(30));
        var row = ReleaseTrack.CreateReleaseOnly(ReleaseTrackId.New(), TrackPosition.FromNumber(1), "Interlude", details);

        _ = Assert.Throws<ArgumentException>(() => row.RelinkTrack(TrackId.New()));

        Assert.Null(row.TrackId);
        Assert.True(row.IsReleaseOnly);
        Assert.Same(details, row.Details);
        Assert.Equal("Interlude", Assert.IsType<PresentOptionalValue<string>>(row.TitleOverride).Value);
    }
}
