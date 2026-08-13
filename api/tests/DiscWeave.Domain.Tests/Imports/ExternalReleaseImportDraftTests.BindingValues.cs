using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    [Fact(DisplayName = "Provider references and row locators normalize canonical identities")]
    public void Provider_references_and_row_locators_normalize_canonical_identities()
    {
        var releaseMbid = Guid.NewGuid();
        var trackMbid = Guid.NewGuid();
        var source = ReleaseImportProviderReference.Create(
            " MusicBrainz ",
            " Recording ",
            $" {Guid.NewGuid():D} ",
            " https://musicbrainz.org/recording/example ");
        var musicBrainzRow = MusicBrainzReleaseRowLocator.Create(
            releaseMbid.ToString("B").ToUpperInvariant(),
            " 1 ",
            trackMbid.ToString("B").ToUpperInvariant());
        var discogsRow = DiscogsReleaseRowLocator.Create(
            " 00042 ",
            0,
            " A1 ",
            $" {new string('A', 64)} ");

        Assert.Equal("musicbrainz", source.ProviderCode);
        Assert.Equal("recording", source.ResourceType);
        Assert.Equal(releaseMbid.ToString("D"), musicBrainzRow.ReleaseMbid);
        Assert.Equal("1", musicBrainzRow.MediumPosition);
        Assert.Equal(trackMbid.ToString("D"), musicBrainzRow.TrackMbid);
        Assert.Equal("42", discogsRow.ReleaseId);
        Assert.Equal("a1", discogsRow.Position);
        Assert.Equal(new string('a', 64), discogsRow.Fingerprint);
    }

    [Theory(DisplayName = "MusicBrainz medium position is a positive invariant decimal")]
    [InlineData("01", "1")]
    [InlineData(" 2 ", "2")]
    [InlineData("999", "999")]
    public void MusicBrainz_medium_position_is_a_positive_invariant_decimal(
        string value,
        string expected)
    {
        var locator = MusicBrainzReleaseRowLocator.Create(
            Guid.NewGuid().ToString("D"),
            value,
            Guid.NewGuid().ToString("D"));

        Assert.Equal(expected, locator.MediumPosition);
    }

    [Theory(DisplayName = "MusicBrainz medium position rejects non-positive and non-decimal values")]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("+1")]
    [InlineData("1.0")]
    [InlineData("side-a")]
    public void MusicBrainz_medium_position_rejects_non_positive_and_non_decimal_values(string value)
    {
        DomainException exception = Assert.Throws<DomainException>(() => MusicBrainzReleaseRowLocator.Create(
            Guid.NewGuid().ToString("D"),
            value,
            Guid.NewGuid().ToString("D")));

        Assert.Equal("release_import.musicbrainz_medium_position_invalid", exception.Code);
    }

    [Theory(DisplayName = "Provider references reject noncanonical provider codes and source URLs")]
    [InlineData("bad code", "https://example.test/resource", "release_import.provider_code_invalid")]
    [InlineData("bad_code", "https://example.test/resource", "release_import.provider_code_invalid")]
    [InlineData("1discogs", "https://example.test/resource", "release_import.provider_code_invalid")]
    [InlineData("abcdefghijklmnopqrstuvwxyzabcdefg", "https://example.test/resource", "release_import.provider_code_invalid")]
    [InlineData("musicbrainz", "http://musicbrainz.org/release/id", "release_import.provider_source_url_invalid")]
    [InlineData("musicbrainz", "not-a-url", "release_import.provider_source_url_invalid")]
    public void Provider_references_reject_noncanonical_provider_codes_and_source_urls(
        string providerCode,
        string sourceUrl,
        string expectedCode)
    {
        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportProviderReference.Create(
            providerCode,
            "release",
            Guid.NewGuid().ToString("D"),
            sourceUrl));

        Assert.Equal(expectedCode, exception.Code);
    }

    [Fact(DisplayName = "MusicBrainz binding requires release medium track and Recording identities")]
    public void MusicBrainz_binding_requires_release_medium_track_and_recording_identities()
    {
        ReleaseImportProviderReference release = MusicBrainzRelease();
        var route = ExternalReleaseRoute.CreateMusicBrainz(release);

        DomainException mediumException = Assert.Throws<DomainException>(() => SelectedOriginalBinding.CreateMusicBrainz(
            TrackId.New(),
            ReleaseImportDraftTrackId.New(),
            MusicBrainzRecording(),
            route,
            MusicBrainzReleaseRowLocator.Create(release.ExternalId, " ", Guid.NewGuid().ToString("D")),
            false));
        DomainException recordingException = Assert.Throws<DomainException>(() => SelectedOriginalBinding.CreateMusicBrainz(
            TrackId.New(),
            ReleaseImportDraftTrackId.New(),
            release,
            route,
            MusicBrainzReleaseRowLocator.Create(release.ExternalId, "1", Guid.NewGuid().ToString("D")),
            false));

        Assert.Equal("release_import.musicbrainz_medium_position_required", mediumException.Code);
        Assert.Equal("release_import.recording_source_invalid", recordingException.Code);
    }

    [Fact(DisplayName = "MusicBrainz Recording source requires a non-empty MBID")]
    public void MusicBrainz_recording_source_requires_a_non_empty_mbid()
    {
        ReleaseImportProviderReference release = MusicBrainzRelease();
        var recording = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "recording",
            "not-an-mbid",
            "https://musicbrainz.org/recording/not-an-mbid");

        DomainException exception = Assert.Throws<DomainException>(() => SelectedOriginalBinding.CreateMusicBrainz(
            TrackId.New(),
            ReleaseImportDraftTrackId.New(),
            recording,
            ExternalReleaseRoute.CreateMusicBrainz(release),
            MusicBrainzReleaseRowLocator.Create(release.ExternalId, "1", Guid.NewGuid().ToString("D")),
            false));

        Assert.Equal("release_import.recording_source_invalid", exception.Code);
    }

    [Fact(DisplayName = "Discogs binding requires a consistent Discogs release row")]
    public void Discogs_binding_requires_a_consistent_discogs_release_row()
    {
        ReleaseImportProviderReference musicBrainzRelease = MusicBrainzRelease();
        ReleaseImportProviderReference discogsRelease = DiscogsRelease("42");
        var route = ExternalReleaseRoute.CreateDiscogsBacked(musicBrainzRelease, discogsRelease);
        var musicBrainzRow = MusicBrainzReleaseRowLocator.Create(
            musicBrainzRelease.ExternalId,
            "1",
            Guid.NewGuid().ToString("D"));

        DomainException ordinalException = Assert.Throws<DomainException>(() => DiscogsReleaseRowLocator.Create(
            "42", -1, "A1", new string('a', 64)));
        DomainException releaseException = Assert.Throws<DomainException>(() => SelectedOriginalBinding.CreateDiscogsBacked(
            TrackId.New(),
            ReleaseImportDraftTrackId.New(),
            MusicBrainzRecording(),
            route,
            musicBrainzRow,
            DiscogsReleaseRowLocator.Create("43", 0, "A1", new string('a', 64)),
            false));

        Assert.Equal("release_import.discogs_row_ordinal_invalid", ordinalException.Code);
        Assert.Equal("release_import.discogs_row_release_mismatch", releaseException.Code);
    }

    [Theory(DisplayName = "Discogs row locator requires release ID position and fingerprint")]
    [InlineData("0", "A1", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "release_import.discogs_release_id_invalid")]
    [InlineData("42", " ", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "release_import.discogs_row_position_required")]
    [InlineData("42", "A1", " ", "release_import.discogs_row_fingerprint_required")]
    [InlineData("42", "A1", "not-a-fingerprint", "release_import.discogs_row_fingerprint_invalid")]
    public void Discogs_row_locator_requires_release_id_position_and_fingerprint(
        string releaseId,
        string position,
        string fingerprint,
        string expectedCode)
    {
        DomainException exception = Assert.Throws<DomainException>(() =>
            DiscogsReleaseRowLocator.Create(releaseId, 0, position, fingerprint));

        Assert.Equal(expectedCode, exception.Code);
    }

    [Fact(DisplayName = "Discogs row position uses Task1 Unicode text normalization")]
    public void Discogs_row_position_uses_task1_unicode_text_normalization()
    {
        var normalized = DiscogsReleaseRowLocator.Create(
            "42",
            0,
            "  A\u00A0\u212A   1\t",
            new string('a', 64));
        var equivalent = DiscogsReleaseRowLocator.Create(
            "42",
            0,
            "a k 1",
            new string('a', 64));

        Assert.Equal("a k 1", normalized.Position);
        Assert.Equal(equivalent.Position, normalized.Position);
    }

    [Fact(DisplayName = "MusicBrainz and Discogs route shapes cannot be mixed")]
    public void MusicBrainz_and_discogs_route_shapes_cannot_be_mixed()
    {
        ReleaseImportProviderReference musicBrainzRelease = MusicBrainzRelease();
        var route = ExternalReleaseRoute.CreateDiscogsBacked(
            musicBrainzRelease,
            DiscogsRelease("42"));

        DomainException exception = Assert.Throws<DomainException>(() => SelectedOriginalBinding.CreateMusicBrainz(
            TrackId.New(),
            ReleaseImportDraftTrackId.New(),
            MusicBrainzRecording(),
            route,
            MusicBrainzReleaseRowLocator.Create(musicBrainzRelease.ExternalId, "1", Guid.NewGuid().ToString("D")),
            false));

        Assert.Equal("release_import.discogs_row_required", exception.Code);
    }
}
