using System.Text;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseBindingValidator
{
    private async Task<ExternalReleaseBindingValidationResult> ValidateDiscogsOnlyAsync(
        DiscogsReleaseRowLocator row, CancellationToken cancellationToken)
    {
        ExternalMetadataResult<IExternalMetadataProvider> provider = _providerResolver.Resolve(DiscogsProviderCode);
        if (!provider.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(ToStatus(DiscogsProviderCode, provider.Error));
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await provider.Value.GetReleaseAsync(new ExternalMetadataLookupQuery(row.ReleaseId),
            ExternalMetadataRequestFreshness.Authoritative, cancellationToken).ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(ToStatus(DiscogsProviderCode, result.Error));
        }

        if (result.Value.Source.ProviderName != DiscogsProviderCode || result.Value.Source.ResourceType != "release" ||
            result.Value.Source.ExternalId != row.ReleaseId || row.RowOrdinal >= result.Value.Tracklist.Count)
        {
            return ExternalReleaseBindingValidationResult.Stale();
        }

        ExternalMetadataReleaseTrack track = result.Value.Tracklist[row.RowOrdinal];
        IReadOnlyList<string> artists = track.Artists.Count > 0 ? track.Artists : result.Value.Artists;
        return NormalizeText(track.Position) == NormalizeText(row.Position) &&
            DiscogsReleaseRowFingerprint.Create(track.Position, track.Title, artists, track.Duration) == row.Fingerprint
            ? new ExternalReleaseBindingValidationResult.DiscogsValid(result.Value, track)
            : ExternalReleaseBindingValidationResult.Stale();
    }

    private static bool HasMusicBrainzSource(
        ExternalMetadataReleaseTrack row,
        string resourceType,
        string externalId)
    {
        return row.ExternalSources.Any(source =>
            string.Equals(source.ProviderName, MusicBrainzProviderCode, StringComparison.Ordinal) &&
            string.Equals(source.ResourceType, resourceType, StringComparison.Ordinal) &&
            string.Equals(source.ExternalId, externalId, StringComparison.OrdinalIgnoreCase));
    }

    private static bool HasDirectDiscogsRelation(
        ExternalMetadataReleaseDetail release,
        string releaseId)
    {
        return release.RelatedSources.Any(source =>
            string.Equals(source.ProviderName, DiscogsProviderCode, StringComparison.Ordinal) &&
            string.Equals(source.ResourceType, "release", StringComparison.Ordinal) &&
            string.Equals(source.ExternalId, releaseId, StringComparison.Ordinal));
    }

    private static string NormalizeText(string? value)
    {
        return string.Join(
            ' ',
            (value ?? string.Empty)
                .Normalize(NormalizationForm.FormKC)
                .ToLowerInvariant()
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
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
                ExternalMetadataErrorKind.NotFound => ExternalProviderOperationOutcome.NotFound,
                ExternalMetadataErrorKind.Disabled => ExternalProviderOperationOutcome.Disabled,
                ExternalMetadataErrorKind.NotConfigured => ExternalProviderOperationOutcome.NotConfigured,
                ExternalMetadataErrorKind.Unauthorized => ExternalProviderOperationOutcome.Unauthorized,
                ExternalMetadataErrorKind.UnknownProvider => ExternalProviderOperationOutcome.UnknownProvider,
                ExternalMetadataErrorKind.UnsupportedCapability => ExternalProviderOperationOutcome.UnsupportedCapability,
                ExternalMetadataErrorKind.RateLimited => ExternalProviderOperationOutcome.RateLimited,
                ExternalMetadataErrorKind.Timeout => ExternalProviderOperationOutcome.Timeout,
                ExternalMetadataErrorKind.Unavailable => ExternalProviderOperationOutcome.Unavailable,
                ExternalMetadataErrorKind.InvalidResponse => ExternalProviderOperationOutcome.InvalidResponse,
                _ => ExternalProviderOperationOutcome.Unavailable
            },
            ErrorCode = error.Code,
            RetryAfter = error.RetryAfter
        };
    }

    private static Guid ParseRecordingMbid(ReleaseImportProviderReference recordingSource)
    {
        return string.Equals(recordingSource.ProviderCode, MusicBrainzProviderCode, StringComparison.Ordinal) &&
            string.Equals(recordingSource.ResourceType, "recording", StringComparison.Ordinal) &&
            Guid.TryParseExact(recordingSource.ExternalId, "D", out Guid recordingMbid) &&
            recordingMbid != Guid.Empty
            ? recordingMbid
            : throw new DomainException(
                "release_import.recording_source_invalid",
                "Selected original binding requires a MusicBrainz Recording reference");
    }
}
