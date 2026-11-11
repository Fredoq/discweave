using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Fact]
    public async Task Label_search_uses_the_label_endpoint_and_preserves_disambiguation()
    {
        RecordingHttpMessageHandler handler = JsonHandler("""{"pagination":{"items":1},"results":[{"type":"label","id":12,"title":"Factory (2)"}]}""");
        ExternalMetadataResult<ExternalMetadataSearchResult<DiscogsLabelCandidate>> result = await CreateProvider(handler).SearchLabelsAsync(" Factory ", CancellationToken.None);
        Assert.True(result.IsSuccess);
        Assert.Equal("Factory (2)", Assert.Single(result.Value.Items).Name);
        Assert.Contains("type=label", Assert.Single(handler.Requests).RequestUri!.Query, StringComparison.Ordinal);
        Assert.Contains("q=Factory", handler.Requests[0].RequestUri!.Query, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Label_selection_rejects_a_different_provider_identity()
    {
        RecordingHttpMessageHandler handler = JsonHandler("""{"id":13,"name":"Factory"}""");
        ExternalMetadataResult<DiscogsLabelCandidate> result = await CreateProvider(handler).GetLabelAsync("12", CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.InvalidResponse, result.Error.Kind);
    }

    [Fact]
    public async Task Label_selection_preserves_the_verified_provider_name()
    {
        RecordingHttpMessageHandler handler = JsonHandler("""{"id":12,"name":"Factory (2)"}""");
        ExternalMetadataResult<DiscogsLabelCandidate> result = await CreateProvider(handler).GetLabelAsync("12", CancellationToken.None);
        Assert.True(result.IsSuccess);
        Assert.Equal(new DiscogsLabelCandidate("12", "Factory (2)"), result.Value);
    }

    [Fact]
    public async Task Label_catalog_preserves_catalog_numbers_and_requests_only_one_page()
    {
        RecordingHttpMessageHandler handler = JsonHandler("""
            {"pagination":{"page":2,"pages":2,"items":101,"per_page":100},"releases":[
             {"id":7,"catno":"ABC 001 / A","artist":"Artist","title":"Record","year":2020,"format":"LP"}]}
            """);
        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await CreateProvider(handler).GetLabelReleasesAsync("12", 2, CancellationToken.None);
        Assert.True(result.IsSuccess);
        Assert.Equal("ABC 001 / A", Assert.Single(result.Value.Items).CatalogNumber);
        Assert.Equal(101, result.Value.Total);
        Assert.Equal(2, result.Value.Pages);
        Assert.Equal("/labels/12/releases", Assert.Single(handler.Requests).RequestUri!.AbsolutePath);
        Assert.Contains("page=2", handler.Requests[0].RequestUri!.Query, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("../12", 1)]
    [InlineData("0", 1)]
    [InlineData("12", 0)]
    [InlineData("12", 100001)]
    [InlineData("0012", 1)]
    public async Task Label_catalog_rejects_invalid_identity_or_pagination_before_http(string id, int page)
    {
        RecordingHttpMessageHandler handler = JsonHandler("{}");
        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await CreateProvider(handler).GetLabelReleasesAsync(id, page, CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Empty(handler.Requests);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"pagination\":{\"page\":2,\"pages\":2,\"items\":101,\"per_page\":100},\"releases\":[]}")]
    [InlineData("{\"pagination\":{\"page\":1,\"pages\":1,\"items\":1,\"per_page\":100},\"releases\":[null]}")]
    public async Task Label_catalog_rejects_malformed_or_wrong_page_responses(string json)
    {
        RecordingHttpMessageHandler handler = JsonHandler(json);
        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await CreateProvider(handler).GetLabelReleasesAsync("12", 1, CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.InvalidResponse, result.Error.Kind);
    }

    [Fact]
    public async Task Label_catalog_requires_configured_credentials()
    {
        RecordingHttpMessageHandler handler = JsonHandler("{}");
        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await CreateProvider(handler, accessToken: " ").GetLabelReleasesAsync("12", 1, CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.NotConfigured, result.Error.Kind);
        Assert.Empty(handler.Requests);
    }
    [Fact]
    public async Task Label_catalog_rejects_oversized_provider_payloads()
    {
        RecordingHttpMessageHandler handler = JsonHandler(new string(' ', 2097153));
        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await CreateProvider(handler).GetLabelReleasesAsync("12", 1, CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.InvalidResponse, result.Error.Kind);
        _ = Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task Label_search_rejects_non_label_results()
    {
        RecordingHttpMessageHandler handler = JsonHandler("""{"results":[{"type":"artist","id":12,"title":"Factory"}]}""");
        ExternalMetadataResult<ExternalMetadataSearchResult<DiscogsLabelCandidate>> result = await CreateProvider(handler).SearchLabelsAsync("Factory", CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.InvalidResponse, result.Error.Kind);
    }

    [Fact]
    public async Task Label_catalog_honors_caller_cancellation_before_http()
    {
        RecordingHttpMessageHandler handler = JsonHandler("{}");
        using CancellationTokenSource cancellation = new();
        await cancellation.CancelAsync();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => CreateProvider(handler).GetLabelReleasesAsync("12", 1, cancellation.Token));
        Assert.Empty(handler.Requests);
    }

}
