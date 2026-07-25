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

    public ExternalOriginalCandidateService(
        ILocalOriginalCandidateService localService,
        IExternalMetadataProviderResolver providerResolver)
    {
        _localService = localService;
        _providerResolver = providerResolver;
    }

    public async Task<ExternalOriginalCandidateResult> FindAsync(
        CollectionId collectionId,
        TrackId sourceTrackId,
        IReadOnlyCollection<string>? providerCodes,
        CancellationToken cancellationToken)
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
                    ToQuery(local),
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
            warnings.UnionWith(providerResult.Value.Warnings);
            foreach (RecordingLineageCandidate candidate
                in providerResult.Value.Candidates)
            {
                warnings.UnionWith(candidate.Warnings);
            }
        }

        return Result(
            local,
            MapCandidates(local, lineageResults),
            statuses,
            [.. warnings]);
    }

    private static ExternalOriginalCandidateResult Result(
        LocalOriginalCandidateResult local,
        IReadOnlyList<ExternalOriginalCandidate> candidates,
        IReadOnlyList<ExternalProviderOperationStatus> statuses,
        IReadOnlyList<string> warnings)
    {
        return new ExternalOriginalCandidateResult
        {
            Local = local,
            Candidates = candidates,
            ProviderStatuses = statuses,
            Warnings = warnings
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
        LocalOriginalCandidateResult local)
    {
        LocalOriginalSourceFacts source = local.Source
            ?? throw new InvalidOperationException(
                "Successful local original discovery must include source facts");
        return new RecordingLineageQuery
        {
            Title = source.Title,
            Artists = source.Artists,
            Duration = source.Duration,
            ApproximateYear = source.ApproximateYear,
            KnownRecording = TryRecordingId(
                source.RecordingSource,
                out Guid recordingId)
                ? CanonicalRecordingSource(
                    source.RecordingSource!,
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
}
