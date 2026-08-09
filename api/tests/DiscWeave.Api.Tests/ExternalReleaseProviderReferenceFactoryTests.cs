using DiscWeave.Api.Features.Imports;
using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Tests;

public sealed class ExternalReleaseProviderReferenceFactoryTests
{
    [Fact]
    public void MusicBrainz_references_use_lowercase_canonical_urls()
    {
        var releaseId = Guid.Parse("A4C0B0E0-5D6A-4BA6-9EE0-1234567890AB");
        var recordingId = Guid.Parse("B4C0B0E0-5D6A-4BA6-9EE0-1234567890AB");
        var trackId = Guid.Parse("C4C0B0E0-5D6A-4BA6-9EE0-1234567890AB");

        ReleaseImportProviderReference release = ExternalReleaseProviderReferenceFactory.MusicBrainzRelease(releaseId);
        Assert.Equal("musicbrainz", release.ProviderCode);
        Assert.Equal("release", release.ResourceType);
        Assert.Equal(releaseId.ToString("D").ToLowerInvariant(), release.ExternalId);
        Assert.Equal($"https://musicbrainz.org/release/{releaseId:D}".ToLowerInvariant(), release.SourceUrl);

        ReleaseImportProviderReference recording = ExternalReleaseProviderReferenceFactory.MusicBrainzRecording(recordingId);
        Assert.Equal("musicbrainz", recording.ProviderCode);
        Assert.Equal("recording", recording.ResourceType);
        Assert.Equal(recordingId.ToString("D").ToLowerInvariant(), recording.ExternalId);
        Assert.Equal($"https://musicbrainz.org/recording/{recordingId:D}".ToLowerInvariant(), recording.SourceUrl);

        ReleaseImportProviderReference track = ExternalReleaseProviderReferenceFactory.MusicBrainzTrack(trackId);
        Assert.Equal("musicbrainz", track.ProviderCode);
        Assert.Equal("track", track.ResourceType);
        Assert.Equal(trackId.ToString("D").ToLowerInvariant(), track.ExternalId);
        Assert.Equal($"https://musicbrainz.org/track/{trackId:D}".ToLowerInvariant(), track.SourceUrl);
    }

    [Theory]
    [InlineData("42", "42", "https://www.discogs.com/release/42")]
    [InlineData(" 00042 ", "42", "https://www.discogs.com/release/42")]
    public void Discogs_reference_uses_positive_invariant_release_id(
        string input,
        string expectedId,
        string expectedUrl)
    {
        ReleaseImportProviderReference reference = ExternalReleaseProviderReferenceFactory.DiscogsRelease(input);

        Assert.Equal("discogs", reference.ProviderCode);
        Assert.Equal("release", reference.ResourceType);
        Assert.Equal(expectedId, reference.ExternalId);
        Assert.Equal(expectedUrl, reference.SourceUrl);
    }

    [Theory]
    [InlineData("")]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("release-42")]
    public void Discogs_reference_rejects_invalid_release_id(string input)
    {
        _ = Assert.Throws<ArgumentException>(() =>
            ExternalReleaseProviderReferenceFactory.DiscogsRelease(input));
    }
}
