using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseBindingValidator
{
    public async Task<ExternalReleaseBindingValidationResult> ValidateDiscogsReleaseAttachAsync(
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        string discogsReleaseId,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(recordingSource);
        ArgumentNullException.ThrowIfNull(musicBrainzRow);
        string releaseId = discogsReleaseId?.Trim() ?? string.Empty;
        if (!long.TryParse(releaseId, out long numericReleaseId) || numericReleaseId <= 0)
        {
            return ExternalReleaseBindingValidationResult.Stale();
        }

        ExternalMetadataResult<IExternalMetadataProvider> musicBrainzProvider =
            _providerResolver.Resolve("musicbrainz");
        if (!musicBrainzProvider.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(
                ToStatus("musicbrainz", musicBrainzProvider.Error));
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> musicBrainzResult =
            await musicBrainzProvider.Value.GetReleaseAsync(
                new ExternalMetadataLookupQuery(musicBrainzRow.ReleaseMbid),
                ExternalMetadataRequestFreshness.Authoritative,
                cancellationToken).ConfigureAwait(false);
        if (!musicBrainzResult.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(
                ToStatus("musicbrainz", musicBrainzResult.Error));
        }

        string recordingMbid = ParseRecordingMbid(recordingSource).ToString("D");
        ExternalMetadataReleaseTrack[] musicBrainzRows =
        [
            .. musicBrainzResult.Value.Tracklist.Where(row =>
                string.Equals(row.Disc, musicBrainzRow.MediumPosition, StringComparison.Ordinal) &&
                HasMusicBrainzSource(row, "track", musicBrainzRow.TrackMbid) &&
                HasMusicBrainzSource(row, "recording", recordingMbid))
        ];
        if (musicBrainzRows.Length != 1)
        {
            return musicBrainzRows.Length == 0
                ? ExternalReleaseBindingValidationResult.Stale()
                : ExternalReleaseBindingValidationResult.Ambiguous();
        }

        ExternalMetadataResult<IExternalMetadataProvider> discogsProvider =
            _providerResolver.Resolve("discogs");
        if (!discogsProvider.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(
                ToStatus("discogs", discogsProvider.Error));
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> discogsResult =
            await discogsProvider.Value.GetReleaseAsync(
                new ExternalMetadataLookupQuery(releaseId),
                ExternalMetadataRequestFreshness.Authoritative,
                cancellationToken).ConfigureAwait(false);
        if (!discogsResult.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(
                ToStatus("discogs", discogsResult.Error));
        }

        ExternalReleaseRouteMatchResult match = _routeMatcher.Match(
            new ExternalReleaseRouteMatchInput
            {
                MusicBrainzRelease = musicBrainzResult.Value,
                MusicBrainzMediumPosition = musicBrainzRow.MediumPosition,
                MusicBrainzTrackMbid = musicBrainzRow.TrackMbid,
                MusicBrainzRecordingMbid = recordingMbid,
                DiscogsRelease = discogsResult.Value,
                Authority = HasDirectDiscogsRelation(musicBrainzResult.Value, releaseId)
                    ? ExternalReleaseRouteMatchAuthority.DirectRelationship
                    : ExternalReleaseRouteMatchAuthority.DeterministicEvidence
            });
        if (match.Outcome == ExternalReleaseRouteMatchOutcome.AmbiguousRows)
        {
            return ExternalReleaseBindingValidationResult.Ambiguous();
        }

        DiscogsReleaseRouteBinding? compatible = match.Outcome == ExternalReleaseRouteMatchOutcome.Matched
            ? match.CompatibleRows.SingleOrDefault()
            : null;
        if (compatible is null)
        {
            return ExternalReleaseBindingValidationResult.Stale();
        }

        var locator = DiscogsReleaseRowLocator.Create(
            releaseId,
            compatible.RowOrdinal,
            compatible.Position,
            compatible.Fingerprint);
        return ExternalReleaseBindingValidationResult.ValidDiscogsBacked(
            musicBrainzResult.Value,
            musicBrainzRows[0],
            discogsResult.Value,
            discogsResult.Value.Tracklist[compatible.RowOrdinal],
            locator);
    }
}
