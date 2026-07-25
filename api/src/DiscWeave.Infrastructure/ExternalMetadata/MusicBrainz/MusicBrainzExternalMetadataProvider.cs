using System.Globalization;
using System.Runtime.CompilerServices;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using Microsoft.Extensions.Options;

[assembly: InternalsVisibleTo("DiscWeave.Infrastructure.Tests")]

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider : IExternalMetadataProvider
{
    private const string ProviderCodeValue = "musicbrainz";
    private const string Attribution = "Data provided by MusicBrainz.";
    private static readonly TimeSpan SearchTtl = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan DetailTtl = TimeSpan.FromHours(24);
    private static readonly TimeSpan NotFoundTtl = TimeSpan.FromMinutes(3);
    private readonly HttpClient _httpClient;
    private readonly MusicBrainzOptions _options;
    private readonly IMusicBrainzRequestGate _requestGate;
    private readonly IExternalMetadataRequestCache _cache;
    private readonly TimeProvider _timeProvider;

    public MusicBrainzExternalMetadataProvider(
        HttpClient httpClient,
        IOptions<MusicBrainzOptions> options,
        MusicBrainzRequestGate requestGate,
        IExternalMetadataRequestCache cache,
        TimeProvider timeProvider)
        : this(httpClient, options, (IMusicBrainzRequestGate)requestGate, cache, timeProvider)
    {
    }

    internal MusicBrainzExternalMetadataProvider(
        HttpClient httpClient,
        IOptions<MusicBrainzOptions> options,
        IMusicBrainzRequestGate requestGate,
        IExternalMetadataRequestCache cache,
        TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(httpClient);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(requestGate);
        ArgumentNullException.ThrowIfNull(cache);
        ArgumentNullException.ThrowIfNull(timeProvider);

        _httpClient = httpClient;
        _options = options.Value;
        _requestGate = requestGate;
        _cache = cache;
        _timeProvider = timeProvider;
    }

    public string ProviderCode => ProviderCodeValue;

    public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>> SearchReleasesAsync(
        ExternalMetadataReleaseSearchQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return UnsupportedAsync<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(cancellationToken);
    }

    public Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return !_options.Enabled
            ? Task.FromResult(Failure<ExternalMetadataReleaseDetail>(Disabled()))
            : TryNormalizeMbid(query.ExternalId, out string releaseMbid)
            ? ExecuteOwnedAsync(
                context => GetReleaseDetailCoreAsync(releaseMbid, context, CancellationToken.None),
                cancellationToken)
            : Task.FromResult(Failure<ExternalMetadataReleaseDetail>(InvalidResponse()));
    }

    public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>>> SearchArtistsAsync(
        ExternalMetadataArtistSearchQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return UnsupportedAsync<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>>(cancellationToken);
    }

    public Task<ExternalMetadataResult<ExternalMetadataArtistDetail>> GetArtistAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return UnsupportedAsync<ExternalMetadataArtistDetail>(cancellationToken);
    }

    public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>>> SearchTracksAsync(
        ExternalMetadataTrackSearchQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return UnsupportedAsync<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>>(cancellationToken);
    }

    public Task<ExternalMetadataResult<ExternalMetadataTrackDetail>> GetTrackAsync(
        ExternalMetadataLookupQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return UnsupportedAsync<ExternalMetadataTrackDetail>(cancellationToken);
    }

    internal Task<ExternalMetadataResult<RecordingSearchOutcome>> SearchRecordingsAsync(
        string title,
        IReadOnlyList<string> artists,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(artists);
        return !_options.Enabled
            ? Task.FromResult(Failure<RecordingSearchOutcome>(Disabled()))
            : string.IsNullOrWhiteSpace(title)
            ? Task.FromResult(Failure<RecordingSearchOutcome>(InvalidResponse()))
            : ExecuteOwnedAsync(
                context => SearchRecordingsCoreAsync(title, artists, context, CancellationToken.None),
                cancellationToken);
    }

    internal Task<ExternalMetadataResult<RecordingSearchOutcome>> SearchRecordingsAsync(
        string title,
        IReadOnlyList<string> artists,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return SearchRecordingsCoreAsync(title, artists, context, cancellationToken);
    }

    internal Task<ExternalMetadataResult<RecordingDetailOutcome>> GetRecordingDetailAsync(
        string recordingMbid,
        CancellationToken cancellationToken)
    {
        return !_options.Enabled
            ? Task.FromResult(Failure<RecordingDetailOutcome>(Disabled()))
            : TryNormalizeMbid(recordingMbid, out string normalized)
            ? ExecuteOwnedAsync(
                context => GetRecordingDetailCoreAsync(normalized, context, CancellationToken.None),
                cancellationToken)
            : Task.FromResult(Failure<RecordingDetailOutcome>(InvalidResponse()));
    }

    internal Task<ExternalMetadataResult<RecordingDetailOutcome>> GetRecordingDetailAsync(
        string recordingMbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return TryNormalizeMbid(recordingMbid, out string normalized)
            ? GetRecordingDetailCoreAsync(normalized, context, cancellationToken)
            : Task.FromResult(Failure<RecordingDetailOutcome>(InvalidResponse()));
    }

    internal Task<ExternalMetadataResult<ReleaseGroupDetailOutcome>> GetReleaseGroupDetailAsync(
        string releaseGroupMbid,
        CancellationToken cancellationToken)
    {
        return !_options.Enabled
            ? Task.FromResult(Failure<ReleaseGroupDetailOutcome>(Disabled()))
            : TryNormalizeMbid(releaseGroupMbid, out string normalized)
            ? ExecuteOwnedAsync(
                context => GetReleaseGroupDetailCoreAsync(normalized, context, CancellationToken.None),
                cancellationToken)
            : Task.FromResult(Failure<ReleaseGroupDetailOutcome>(InvalidResponse()));
    }

    internal Task<ExternalMetadataResult<ReleaseGroupDetailOutcome>> GetReleaseGroupDetailAsync(
        string releaseGroupMbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return TryNormalizeMbid(releaseGroupMbid, out string normalized)
            ? GetReleaseGroupDetailCoreAsync(normalized, context, cancellationToken)
            : Task.FromResult(Failure<ReleaseGroupDetailOutcome>(InvalidResponse()));
    }

    internal MusicBrainzOperationContext CreateOperationContext()
    {
        return new MusicBrainzOperationContext(
            _options.OperationTimeoutSeconds,
            _options.MaxRequestsPerOperation,
            _timeProvider);
    }

    private async Task<ExternalMetadataResult<RecordingSearchOutcome>> SearchRecordingsCoreAsync(
        string title,
        IReadOnlyList<string> artists,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        string query = BuildRecordingQuery(title, artists);
        var key = ExternalMetadataCacheKey.Create(
            ProviderCodeValue,
            "recording-search",
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["query"] = query,
                ["limit"] = _options.MaxRecordingCandidates.ToString(CultureInfo.InvariantCulture),
                ["offset"] = "0"
            });
        ExternalMetadataResult<RecordingSearchResponse> response = await GetOrCreateWithOperationAsync(
            key,
            SearchTtl,
            NotFoundTtl,
            _ => SendAsync<RecordingSearchResponse>(
                RecordingSearchPath(query, _options.MaxRecordingCandidates),
                context),
            context,
            cancellationToken).ConfigureAwait(false);

        return response.IsSuccess &&
            TryMapRecordingSearch(response.Value, _options.MaxRecordingCandidates, out RecordingSearchOutcome outcome)
                ? new ExternalMetadataResult<RecordingSearchOutcome>(outcome)
                : response.IsSuccess
                    ? Failure<RecordingSearchOutcome>(InvalidResponse())
                    : Failure<RecordingSearchOutcome>(response.Error);
    }

    private async Task<ExternalMetadataResult<RecordingDetailOutcome>> GetRecordingDetailCoreAsync(
        string mbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        ExternalMetadataCacheKey key = MbidKey("recording-detail", mbid);
        ExternalMetadataResult<RecordingDetailOutcome> response = await GetOrCreateWithOperationAsync(
            key,
            DetailTtl,
            NotFoundTtl,
            async _ =>
            {
                ExternalMetadataResult<RecordingDto> raw = await SendAsync<RecordingDto>(
                    RecordingDetailPath(mbid),
                    context).ConfigureAwait(false);
                return raw.IsSuccess && TryMapRecordingDetail(raw.Value, mbid, out RecordingDetailOutcome mapped)
                    ? new ExternalMetadataResult<RecordingDetailOutcome>(mapped)
                    : raw.IsSuccess
                        ? Failure<RecordingDetailOutcome>(InvalidResponse())
                        : Failure<RecordingDetailOutcome>(raw.Error);
            },
            context,
            cancellationToken).ConfigureAwait(false);
        return response;
    }
}
