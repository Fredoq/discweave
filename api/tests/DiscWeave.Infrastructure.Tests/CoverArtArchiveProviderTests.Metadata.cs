using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class CoverArtArchiveProviderTests
{
    [Fact]
    public async Task Legacy_manifest_metadata_is_accepted_without_making_an_insecure_request()
    {
        string legacyMetadata = new UriBuilder(Uri.UriSchemeHttp, "musicbrainz.org")
        {
            Path = $"/release/{Edition}"
        }.Uri.AbsoluteUri;
        var handler = new FakeHandler(_ => Json(Manifest().Replace(
            $"https://musicbrainz.org/release/{Edition}", legacyMetadata, StringComparison.Ordinal)));
        using var client = new HttpClient(handler);
        _ = Assert.Single(await Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
        Assert.All(handler.Requests, request => Assert.Equal(Uri.UriSchemeHttps, new Uri(request).Scheme));
    }

    [Theory]
    [InlineData("https://musicbrainz.org.evil.test/release/")]
    [InlineData("https://user@musicbrainz.org/release/")]
    [InlineData("https://musicbrainz.org:8443/release/")]
    [InlineData("https://musicbrainz.org/recording/")]
    public async Task Manifest_metadata_must_identify_the_exact_release_at_the_expected_host(string prefix)
    {
        using var client = new HttpClient(new FakeHandler(_ => Json(Manifest().Replace(
            $"https://musicbrainz.org/release/{Edition}", $"{prefix}{Edition}", StringComparison.Ordinal))));
        DomainException exception = await Assert.ThrowsAsync<DomainException>(
            () => Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
        Assert.Equal("external_cover.invalid_response", exception.Code);
    }

    [Theory]
    [InlineData("?edition=another")]
    [InlineData("#another-edition")]
    public async Task Manifest_metadata_rejects_queries_and_fragments(string suffix)
    {
        using var client = new HttpClient(new FakeHandler(_ => Json(Manifest().Replace(
            $"https://musicbrainz.org/release/{Edition}", $"https://musicbrainz.org/release/{Edition}{suffix}", StringComparison.Ordinal))));
        DomainException exception = await Assert.ThrowsAsync<DomainException>(
            () => Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
        Assert.Equal("external_cover.invalid_response", exception.Code);
    }

}
