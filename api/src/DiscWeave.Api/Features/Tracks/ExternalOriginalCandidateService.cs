using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Tracks;

public sealed partial class ExternalOriginalCandidateService
    : IExternalOriginalCandidateService
{
    private const string DefaultProviderCode = "musicbrainz";
    private readonly ILocalOriginalCandidateService _localService;
    private readonly IExternalMetadataProviderResolver _providerResolver;
    private readonly IExternalReleaseRouteResolver _routeResolver;

    public ExternalOriginalCandidateService(
        ILocalOriginalCandidateService localService,
        IExternalMetadataProviderResolver providerResolver,
        IExternalReleaseRouteResolver routeResolver)
    {
        _localService = localService;
        _providerResolver = providerResolver;
        _routeResolver = routeResolver;
    }

    public async Task<ExternalOriginalCandidateResult> FindAsync(
        CollectionId collectionId,
        TrackId sourceTrackId,
        IReadOnlyCollection<string>? providerCodes,
        CancellationToken cancellationToken,
        OriginalDiscoverySearchMode searchMode = OriginalDiscoverySearchMode.Deep)
    {
        LocalOriginalCandidateResult local = await _localService.FindAsync(
            collectionId,
            sourceTrackId,
            cancellationToken);
        if (local.Status != LocalOriginalCandidateStatus.Success
            || local.HasReliableCandidate)
        {
            return Result(local, [], []);
        }

        var statuses = new List<ExternalProviderOperationStatus>();
        var warnings = new SortedSet<string>(StringComparer.Ordinal);
        var lineageResults = new List<RecordingLineageResult>();
        var searchDiagnostics = new List<ExternalProviderSearchDiagnostic>();
        foreach (string providerCode in NormalizeProviderCodes(providerCodes))
        {
            ExternalMetadataResult<IRecordingLineageProvider> resolution =
                _providerResolver.ResolveCapability<IRecordingLineageProvider>(
                    providerCode);
            if (!resolution.IsSuccess)
            {
                statuses.Add(ToStatus(providerCode, resolution.Error));
                continue;
            }

            ExternalMetadataResult<RecordingLineageResult> providerResult =
                await resolution.Value.FindOriginalsAsync(
                    ToQuery(local, searchMode),
                    cancellationToken);
            if (!providerResult.IsSuccess)
            {
                statuses.Add(ToStatus(providerCode, providerResult.Error));
                continue;
            }

            statuses.Add(new ExternalProviderOperationStatus
            {
                ProviderCode = providerCode,
                Outcome = ExternalProviderOperationOutcome.Succeeded
            });
            lineageResults.Add(providerResult.Value);
            searchDiagnostics.AddRange(providerResult.Value.SearchDiagnostics);
            warnings.UnionWith(providerResult.Value.Warnings);
            foreach (RecordingLineageCandidate candidate
                in providerResult.Value.Candidates)
            {
                warnings.UnionWith(candidate.Warnings);
            }
        }

        IReadOnlyList<ExternalOriginalCandidate> mapped =
            MapCandidates(local, lineageResults);
        ExternalOriginalCandidate[] prepared =
        [
            .. mapped
                .Select(candidate =>
                {
                    ExternalReleaseRouteCandidate[] validRoutes =
                    [
                        .. candidate.ReleaseRoutes.Where(route =>
                            IsActionableRoute(
                                candidate.RecordingSource,
                                route.MusicBrainzRoute))
                    ];
                    if (validRoutes.Length != candidate.ReleaseRoutes.Count)
                    {
                        _ = warnings.Add(
                            "musicbrainz.release_route_invalid");
                    }

                    return candidate with { ReleaseRoutes = validRoutes };
                })
                .Where(candidate =>
                    candidate.LocalTrackId is not null ||
                    candidate.ReleaseRoutes.Count > 0)
        ];
        ExternalOriginalCandidate[] enriched =
            await EnrichDiscogsRoutesAsync(
                prepared,
                statuses,
                warnings,
                cancellationToken);

        return Result(local, enriched, statuses, [.. warnings], searchDiagnostics);
    }

    private static ExternalOriginalCandidateResult Result(
        LocalOriginalCandidateResult local,
        IReadOnlyList<ExternalOriginalCandidate> candidates,
        IReadOnlyList<ExternalProviderOperationStatus> statuses,
        IReadOnlyList<string> warnings,
        IReadOnlyList<ExternalProviderSearchDiagnostic>? searchDiagnostics = null)
    {
        return new ExternalOriginalCandidateResult
        {
            Local = local,
            Candidates = candidates,
            ProviderStatuses = statuses,
            Warnings = warnings,
            SearchDiagnostics = searchDiagnostics ?? []
        };
    }

    private static ExternalOriginalCandidateResult Result(
        LocalOriginalCandidateResult local,
        IReadOnlyList<ExternalProviderOperationStatus> statuses,
        IReadOnlyList<string> warnings)
    {
        return Result(local, [], statuses, warnings);
    }

    private static IReadOnlyList<string> NormalizeProviderCodes(
        IReadOnlyCollection<string>? providerCodes)
    {
        return providerCodes is null || providerCodes.Count == 0
            ? [DefaultProviderCode]
            :
            [
                .. providerCodes
                    .Select(code =>
                        code?.Trim().ToLowerInvariant() ?? string.Empty)
                    .Distinct(StringComparer.Ordinal)
                    .OrderBy(code => code, StringComparer.Ordinal)
            ];
    }

    private static RecordingLineageQuery ToQuery(
        LocalOriginalCandidateResult local,
        OriginalDiscoverySearchMode searchMode)
    {
        LocalOriginalSourceFacts source = local.Source
            ?? throw new InvalidOperationException(
                "Successful local original discovery must include source facts");
        return new RecordingLineageQuery
        {
            Title = source.Title,
            BaseTitle = source.BaseTitle,
            Artists = source.Artists,
            Duration = source.Duration,
            ApproximateYear = source.ApproximateYear,
            SearchMode = searchMode,
            KnownRecording = TryRecordingId(
                source.RecordingSource,
                out Guid recordingId)
                ? CanonicalRecordingSource(
                    source.RecordingSource!, // NOSONAR: a canonical recording source is required by this candidate.
                    recordingId)
                : null
        };
    }

    private static ExternalProviderOperationStatus ToStatus(
        string providerCode,
        ExternalMetadataError error)
    {
        return new ExternalProviderOperationStatus
        {
            ProviderCode = providerCode,
            Outcome = error.Kind switch
            {
                ExternalMetadataErrorKind.NotFound =>
                    ExternalProviderOperationOutcome.NotFound,
                ExternalMetadataErrorKind.Disabled =>
                    ExternalProviderOperationOutcome.Disabled,
                ExternalMetadataErrorKind.NotConfigured =>
                    ExternalProviderOperationOutcome.NotConfigured,
                ExternalMetadataErrorKind.Unauthorized =>
                    ExternalProviderOperationOutcome.Unauthorized,
                ExternalMetadataErrorKind.UnknownProvider =>
                    ExternalProviderOperationOutcome.UnknownProvider,
                ExternalMetadataErrorKind.UnsupportedCapability =>
                    ExternalProviderOperationOutcome.UnsupportedCapability,
                ExternalMetadataErrorKind.RateLimited =>
                    ExternalProviderOperationOutcome.RateLimited,
                ExternalMetadataErrorKind.Timeout =>
                    ExternalProviderOperationOutcome.Timeout,
                ExternalMetadataErrorKind.Unavailable =>
                    ExternalProviderOperationOutcome.Unavailable,
                ExternalMetadataErrorKind.InvalidResponse =>
                    ExternalProviderOperationOutcome.InvalidResponse,
                _ => throw new InvalidOperationException(
                    $"Unknown external metadata error kind: {error.Kind}")
            },
            ErrorCode = error.Code,
            RetryAfter = error.RetryAfter
        };
    }

    private static bool IsActionableRoute(
        ExternalMetadataSource recordingSource,
        RecordingReleaseRoute route)
    {
        return IsCanonicalMusicBrainzSource(
                recordingSource,
                "recording") &&
            IsCanonicalMusicBrainzSource(
                route.ReleaseSource,
                "release") &&
            IsCanonicalMusicBrainzSource(
                route.ReleaseGroupSource,
                "release-group") &&
            IsCanonicalMbid(route.MusicBrainzTrackMbid) &&
            int.TryParse(
                route.MediumPosition,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out int medium) &&
            medium > 0 &&
            string.Equals(
                route.MediumPosition,
                medium.ToString(CultureInfo.InvariantCulture),
                StringComparison.Ordinal);
    }

    private static bool IsCanonicalMusicBrainzSource(
        ExternalMetadataSource source,
        string resourceType)
    {
        return IsCanonicalMbid(source.ExternalId) &&
            string.Equals(
                source.ProviderName,
                "musicbrainz",
                StringComparison.Ordinal) &&
            string.Equals(
                source.ResourceType,
                resourceType,
                StringComparison.Ordinal) &&
            string.Equals(
                source.SourceUrl,
                $"https://musicbrainz.org/{resourceType}/{source.ExternalId}",
                StringComparison.Ordinal);
    }

    private static bool IsCanonicalMbid(string value)
    {
        return Guid.TryParseExact(value, "D", out Guid parsed) &&
            string.Equals(
                value,
                parsed.ToString("D").ToLowerInvariant(),
                StringComparison.Ordinal);
    }
}
