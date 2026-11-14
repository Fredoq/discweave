using System.Net;
using System.Text;
using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed class CoverArtArchiveProviderTests
{
    private static readonly Guid Edition = Guid.Parse("12345678-1234-1234-1234-123456789abc");

    [Fact]
    public async Task Download_revalidates_exact_edition_and_uses_the_CAA_identity_instead_of_json_urls()
    {
        var handler = new FakeHandler(request => request.RequestUri!.AbsolutePath.EndsWith('/') ? Json(Manifest()) : Bytes(Png()));
        using var client = new HttpClient(handler);
        CoverArtArchiveProvider provider = Create(client);
        DownloadedCoverArtwork result = await provider.DownloadFrontCoverAsync(Edition, "123", false, CancellationToken.None);
        Assert.Equal("image/png", result.ContentType);
        Assert.Equal(Edition, result.Provenance.ReleaseId);
        Assert.Equal("coverArtArchive", result.Provenance.Provider);
        Assert.Equal(64, result.Provenance.Sha256.Length);
        Assert.Equal($"https://coverartarchive.org/release/{Edition}/123", handler.Requests[1]);
        Assert.DoesNotContain(handler.Requests, url => url.Contains("evil", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Download_rejects_a_manifest_for_a_different_edition()
    {
        var handler = new FakeHandler(_ => Json(Manifest().Replace(Edition.ToString(), "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", StringComparison.Ordinal)));
        using var client = new HttpClient(handler);
        DomainException exception = await Assert.ThrowsAsync<DomainException>(() => Create(client).DownloadFrontCoverAsync(Edition, "123", false, CancellationToken.None));
        Assert.Equal("external_cover.invalid_response", exception.Code);
        _ = Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task Download_rejects_back_only_and_unknown_images_before_downloading()
    {
        var handler = new FakeHandler(_ => Json(Manifest()));
        using var client = new HttpClient(handler);
        DomainException exception = await Assert.ThrowsAsync<DomainException>(() => Create(client).DownloadFrontCoverAsync(Edition, "456", false, CancellationToken.None));
        Assert.Equal("external_cover.not_found", exception.Code);
        _ = Assert.Single(handler.Requests);
    }

    [Theory]
    [InlineData("http://archive.org/file")]
    [InlineData("https://localhost/file")]
    [InlineData("https://127.0.0.1/file")]
    [InlineData("https://archive.org.evil.test/file")]
    [InlineData("https://user@archive.org/file")]
    [InlineData("https://archive.org:8443/file")]
    public async Task Redirects_to_untrusted_destinations_are_rejected_before_a_second_request(string address)
    {
        var handler = new FakeHandler(_ => Redirect(address));
        using var client = new HttpClient(handler);
        DomainException exception = await Assert.ThrowsAsync<DomainException>(() => Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
        Assert.Equal("external_cover.unsafe_redirect", exception.Code);
        _ = Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task A_manifest_can_follow_a_bounded_HTTPS_archive_redirect()
    {
        var handler = new FakeHandler(request => request.RequestUri!.Host == "coverartarchive.org" ? Redirect("https://archive.org/download/mbid-test/index.json") : Json(Manifest()));
        using var client = new HttpClient(handler);
        IReadOnlyList<CoverArtworkCandidate> results = await Create(client).GetFrontCoversAsync(Edition, CancellationToken.None);
        Assert.Equal("123", Assert.Single(results).ImageId);
        Assert.Equal(2, handler.Requests.Count);
    }

    [Fact]
    public async Task Redirect_loops_are_bounded()
    {
        var handler = new FakeHandler(_ => Redirect("https://archive.org/loop"));
        using var client = new HttpClient(handler);
        DomainException exception = await Assert.ThrowsAsync<DomainException>(() => Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
        Assert.Equal("external_cover.unsafe_redirect", exception.Code);
        Assert.Equal(5, handler.Requests.Count);
    }

    [Theory]
    [InlineData("<html>not json</html>", "external_cover.invalid_response")]
    [InlineData("{}", "external_cover.invalid_response")]
    public async Task Malformed_manifest_responses_have_structured_errors(string body, string code)
    {
        using var client = new HttpClient(new FakeHandler(_ => Json(body)));
        DomainException exception = await Assert.ThrowsAsync<DomainException>(() => Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
        Assert.Equal(code, exception.Code);
    }

    [Fact]
    public async Task Oversized_manifest_responses_are_rejected()
    {
        using var client = new HttpClient(new FakeHandler(_ => Bytes(new byte[(1024 * 1024) + 1])));
        DomainException exception = await Assert.ThrowsAsync<DomainException>(() => Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
        Assert.Equal("external_cover.too_large", exception.Code);
    }

    [Fact]
    public async Task Preview_downloads_use_the_thumbnail_endpoint_and_smaller_size_limit()
    {
        var handler = new FakeHandler(request => request.RequestUri!.AbsolutePath.EndsWith('/') ? Json(Manifest()) : Bytes(new byte[(2 * 1024 * 1024) + 1]));
        using var client = new HttpClient(handler);
        DomainException exception = await Assert.ThrowsAsync<DomainException>(() => Create(client).DownloadFrontCoverAsync(Edition, "123", true, CancellationToken.None));
        Assert.Equal("external_cover.too_large", exception.Code);
        Assert.EndsWith("/123-250", handler.Requests[1], StringComparison.Ordinal);
    }

    [Fact]
    public async Task Html_disguised_as_an_image_is_rejected()
    {
        using var client = new HttpClient(new FakeHandler(request => request.RequestUri!.AbsolutePath.EndsWith('/') ? Json(Manifest()) : Bytes(Encoding.UTF8.GetBytes("<svg onload='alert(1)'/>"))));
        DomainException exception = await Assert.ThrowsAsync<DomainException>(() => Create(client).DownloadFrontCoverAsync(Edition, "123", false, CancellationToken.None));
        Assert.Equal("external_cover.invalid_image", exception.Code);
    }

    [Fact]
    public void Huge_dimensions_and_truncated_images_are_rejected()
    {
        byte[] huge = Png();
        huge[16] = 0x7f;
        Assert.Equal("external_cover.invalid_image", Assert.Throws<DomainException>(() => CoverImageValidation.Validate(huge)).Code);
        _ = Assert.Throws<DomainException>(() => CoverImageValidation.Validate(Png().AsSpan(0, 30)));
    }

    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("10.1.2.3")]
    [InlineData("169.254.169.254")]
    [InlineData("172.20.0.1")]
    [InlineData("192.168.1.1")]
    [InlineData("100.64.0.1")]
    [InlineData("::1")]
    [InlineData("fd00::1")]
    [InlineData("::ffff:127.0.0.1")]
    [InlineData("2002:7f00:1::")]
    [InlineData("2001:0000::1")]
    public void Private_and_local_network_addresses_are_rejected(string address)
    {
        Assert.False(CoverArtworkTransport.IsPublicAddress(IPAddress.Parse(address)));
    }

    [Fact]
    public async Task Disabled_provider_makes_no_network_requests()
    {
        var handler = new FakeHandler(_ => throw new InvalidOperationException());
        using var client = new HttpClient(handler);
        IOptions<MusicBrainzOptions> options = Options.Create(new MusicBrainzOptions { Enabled = false });
        using var gate = new MusicBrainzRequestGate(options, TimeProvider.System);
        var provider = new CoverArtArchiveProvider(client, options, gate, TimeProvider.System);
        Assert.Equal("external_cover.disabled", (await Assert.ThrowsAsync<DomainException>(() => provider.GetFrontCoversAsync(Edition, CancellationToken.None))).Code);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task Search_shares_the_existing_MusicBrainz_gate_and_escapes_queries()
    {
        var time = new FakeTimeProvider();
        IOptions<MusicBrainzOptions> options = Options.Create(new MusicBrainzOptions { Enabled = true, ApplicationVersion = "1", Contact = "https://example.com", MinimumRequestIntervalMilliseconds = 1000 });
        using var gate = new MusicBrainzRequestGate(options, time);
        await gate.WaitAsync(CancellationToken.None);
        var handler = new FakeHandler(_ => Json("{\"releases\":[]}"));
        using var client = new HttpClient(handler);
        var provider = new CoverArtArchiveProvider(client, options, gate, time);
        Task<IReadOnlyList<CoverReleaseCandidate>> pending = provider.SearchReleasesAsync(new CoverReleaseSearchQuery("A\" OR *", "Title"), CancellationToken.None);
        Assert.Empty(handler.Requests);
        time.Advance(TimeSpan.FromSeconds(1));
        Assert.Empty(await pending);
        Assert.Contains("artist:\"A\\\" OR \\*\"", Uri.UnescapeDataString(Assert.Single(handler.Requests)), StringComparison.Ordinal);
        Assert.Contains("DiscWeave/1", handler.UserAgent, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Archive_mirror_redirects_are_supported()
    {
        var handler = new FakeHandler(request => request.RequestUri!.Host == "coverartarchive.org"
            ? Redirect("https://dn711103.ca.archive.org/0/items/mbid-test/index.json")
            : Json(Manifest()));
        using var client = new HttpClient(handler);
        _ = Assert.Single(await Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
        Assert.Equal(2, handler.Requests.Count);
    }

    [Fact]
    public async Task An_edition_without_artwork_returns_an_empty_list()
    {
        using var client = new HttpClient(new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound)));
        Assert.Empty(await Create(client).GetFrontCoversAsync(Edition, CancellationToken.None));
    }

    [Fact]
    public async Task Identifier_only_search_is_supported()
    {
        var handler = new FakeHandler(_ => Json("{\"releases\":[]}"));
        using var client = new HttpClient(handler);
        Assert.Empty(await Create(client).SearchReleasesAsync(new CoverReleaseSearchQuery("", "", barcode: "12345"), CancellationToken.None));
        Assert.Contains("barcode", Assert.Single(handler.Requests), StringComparison.Ordinal);
    }

    [Fact]
    public async Task String_image_ids_and_secondary_front_images_are_supported()
    {
        using var client = new HttpClient(new FakeHandler(_ => Json(Manifest()
            .Replace("\"id\":123", "\"id\":\"123\"", StringComparison.Ordinal)
            .Replace("\"front\":true", "\"front\":false", StringComparison.Ordinal))));
        Assert.Equal("123", Assert.Single(await Create(client).GetFrontCoversAsync(Edition, CancellationToken.None)).ImageId);
    }

    private static CoverArtArchiveProvider Create(HttpClient client)
    {
        IOptions<MusicBrainzOptions> options = Options.Create(new MusicBrainzOptions { Enabled = true, ApplicationVersion = "1", Contact = "https://example.com" });
        return new CoverArtArchiveProvider(client, options, new MusicBrainzRequestGate(options, TimeProvider.System), TimeProvider.System);
    }

    private static string Manifest() => $$"""
        {"release":"https://musicbrainz.org/release/{{Edition}}","images":[
          {"id":123,"front":true,"approved":true,"types":["Front"],"image":"https://evil.test/x"},
          {"id":456,"front":false,"types":["Back"]}
        ]}
        """;
    private static byte[] Png() => Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=");
    private static HttpResponseMessage Json(string json) => new(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    private static HttpResponseMessage Bytes(byte[] bytes) => new(HttpStatusCode.OK) { Content = new ByteArrayContent(bytes) };
    private static HttpResponseMessage Redirect(string uri)
    {
        var response = new HttpResponseMessage(HttpStatusCode.TemporaryRedirect);
        response.Headers.Location = new Uri(uri);
        return response;
    }
    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _respond;
        public List<string> Requests { get; } = [];
        public string UserAgent { get; private set; } = "";
        public FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) { _respond = respond; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request.RequestUri!.AbsoluteUri);
            UserAgent = request.Headers.UserAgent.ToString();
            return Task.FromResult(_respond(request));
        }
    }
}
