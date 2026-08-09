using DiscWeave.Application.ExternalMetadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

internal sealed class FakeExternalMetadataProvider : IExternalMetadataProvider
{
    public FakeExternalMetadataProvider(string providerCode = "discogs")
    {
        ProviderCode = providerCode;
    }

    public string ProviderCode { get; }

    public ExternalMetadataReleaseSearchQuery? LastReleaseSearchQuery { get; private set; }

    public ExternalMetadataLookupQuery? LastReleaseLookupQuery { get; private set; }

    public ExternalMetadataRequestFreshness? LastReleaseFreshness { get; private set; }

    public int ReleaseLookupCallCount { get; private set; }

    public ExternalMetadataArtistSearchQuery? LastArtistSearchQuery { get; private set; }

    public ExternalMetadataLookupQuery? LastArtistLookupQuery { get; private set; }

    public ExternalMetadataTrackSearchQuery? LastTrackSearchQuery { get; private set; }

    public ExternalMetadataLookupQuery? LastTrackLookupQuery { get; private set; }

    public ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> ReleaseSearchResult { get; set; } =
        new(new ExternalMetadataError(
            ExternalMetadataErrorKind.Unavailable,
            "external_metadata.unavailable",
            "External metadata provider is unavailable"));

    public ExternalMetadataResult<ExternalMetadataReleaseDetail> ReleaseDetailResult { get; set; } =
        new(new ExternalMetadataError(
            ExternalMetadataErrorKind.Unavailable,
            "external_metadata.unavailable",
            "External metadata provider is unavailable"));

    public ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>> ArtistSearchResult { get; set; } =
        new(new ExternalMetadataError(
            ExternalMetadataErrorKind.Unavailable,
            "external_metadata.unavailable",
            "External metadata provider is unavailable"));

    public ExternalMetadataResult<ExternalMetadataArtistDetail> ArtistDetailResult { get; set; } =
        new(new ExternalMetadataError(
            ExternalMetadataErrorKind.Unavailable,
            "external_metadata.unavailable",
            "External metadata provider is unavailable"));

    public ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>> TrackSearchResult { get; set; } =
        new(new ExternalMetadataError(
            ExternalMetadataErrorKind.Unavailable,
            "external_metadata.unavailable",
            "External metadata provider is unavailable"));

    public ExternalMetadataResult<ExternalMetadataTrackDetail> TrackDetailResult { get; set; } =
        new(new ExternalMetadataError(
            ExternalMetadataErrorKind.Unavailable,
            "external_metadata.unavailable",
            "External metadata provider is unavailable"));

    public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>> SearchReleasesAsync(
        ExternalMetadataReleaseSearchQuery query,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        LastReleaseSearchQuery = query;

        return Task.FromResult(ReleaseSearchResult);
    }

    public Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken)
    {
        return GetReleaseAsync(query, ExternalMetadataRequestFreshness.Cached, cancellationToken);
    }

    public Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseAsync(
        ExternalMetadataLookupQuery query,
        ExternalMetadataRequestFreshness freshness,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        LastReleaseLookupQuery = query;
        LastReleaseFreshness = freshness;
        ReleaseLookupCallCount++;

        return Task.FromResult(ReleaseDetailResult);
    }

    public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>>> SearchArtistsAsync(
        ExternalMetadataArtistSearchQuery query,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        LastArtistSearchQuery = query;

        return Task.FromResult(ArtistSearchResult);
    }

    public Task<ExternalMetadataResult<ExternalMetadataArtistDetail>> GetArtistAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        LastArtistLookupQuery = query;

        return Task.FromResult(ArtistDetailResult);
    }

    public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>>> SearchTracksAsync(
        ExternalMetadataTrackSearchQuery query,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        LastTrackSearchQuery = query;

        return Task.FromResult(TrackSearchResult);
    }

    public Task<ExternalMetadataResult<ExternalMetadataTrackDetail>> GetTrackAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        LastTrackLookupQuery = query;

        return Task.FromResult(TrackDetailResult);
    }

    public static void Register(
        IServiceCollection services,
        params IExternalMetadataProvider[] providers)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(providers);

        _ = services.RemoveAll<IExternalMetadataProvider>();
        foreach (IExternalMetadataProvider provider in providers)
        {
            _ = services.AddSingleton(provider);
        }
    }
}
