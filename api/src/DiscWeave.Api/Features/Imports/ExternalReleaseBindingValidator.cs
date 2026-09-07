using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseBindingValidator : IExternalReleaseBindingValidator
{
    private const string MusicBrainzProviderCode = "musicbrainz";
    private const string DiscogsProviderCode = "discogs";

    private readonly IExternalMetadataProviderResolver _providerResolver;
    private readonly IExternalReleaseRouteMatcher _routeMatcher;

    public ExternalReleaseBindingValidator(
        IExternalMetadataProviderResolver providerResolver,
        IExternalReleaseRouteMatcher routeMatcher)
    {
        ArgumentNullException.ThrowIfNull(providerResolver);
        ArgumentNullException.ThrowIfNull(routeMatcher);
        _providerResolver = providerResolver;
        _routeMatcher = routeMatcher;
    }

    public Task<ExternalReleaseBindingValidationResult> ValidateRequestAsync(
        ExternalReleaseDraftRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.MusicBrainzRow is null && request.DiscogsRoute is { } route)
        {
            return ValidateDiscogsOnlyAsync(DiscogsReleaseRowLocator.Create(
                route.ReleaseId, route.RowOrdinal, route.Position, route.Fingerprint), cancellationToken);
        }
        ArgumentNullException.ThrowIfNull(request.MusicBrainzRow);

        var musicBrainzRow = MusicBrainzReleaseRowLocator.Create(
            request.MusicBrainzRow.ReleaseMbid.ToString("D"),
            request.MusicBrainzRow.MediumPosition,
            request.MusicBrainzRow.TrackMbid.ToString("D"));
        DiscogsReleaseRowLocator? discogsRow = request.DiscogsRoute is null
            ? null
            : DiscogsReleaseRowLocator.Create(
                request.DiscogsRoute.ReleaseId,
                request.DiscogsRoute.RowOrdinal,
                request.DiscogsRoute.Position,
                request.DiscogsRoute.Fingerprint);

        return ValidateAsync(
            request.RecordingMbid,
            musicBrainzRow,
            discogsRow,
            cancellationToken);
    }

    public Task<ExternalReleaseBindingValidationResult> RevalidateAsync(
        SelectedOriginalBinding binding,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(binding);
        if (binding.RecordingSource is null || binding.MusicBrainzRow is null)
        {
            return binding.DiscogsRow.Match(row => ValidateDiscogsOnlyAsync(row, cancellationToken),
                () => Task.FromResult<ExternalReleaseBindingValidationResult>(ExternalReleaseBindingValidationResult.Stale()));
        }
        var recordingMbid = Guid.Parse(binding.RecordingSource.ExternalId);
        DiscogsReleaseRowLocator? discogsRow = binding.DiscogsRow is PresentOptionalValue<DiscogsReleaseRowLocator> present
            ? present.Value
            : null;
        return ValidateAsync(
            recordingMbid,
            binding.MusicBrainzRow,
            discogsRow,
            cancellationToken);
    }

    public Task<ExternalReleaseBindingValidationResult> ValidateMusicBrainzRebindAsync(
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(recordingSource);
        ArgumentNullException.ThrowIfNull(musicBrainzRow);
        return ValidateAsync(
            ParseRecordingMbid(recordingSource),
            musicBrainzRow,
            null,
            cancellationToken);
    }

    public Task<ExternalReleaseBindingValidationResult> ValidateDiscogsRebindAsync(
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        DiscogsReleaseRowLocator discogsRow,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(recordingSource);
        ArgumentNullException.ThrowIfNull(musicBrainzRow);
        ArgumentNullException.ThrowIfNull(discogsRow);
        return ValidateAsync(
            ParseRecordingMbid(recordingSource),
            musicBrainzRow,
            discogsRow,
            cancellationToken);
    }

    private async Task<ExternalReleaseBindingValidationResult> ValidateAsync( // NOSONAR: validation intentionally coordinates all provider checks.
        Guid recordingMbid,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        DiscogsReleaseRowLocator? discogsRow,
        CancellationToken cancellationToken)
    {
        ExternalMetadataResult<IExternalMetadataProvider> musicBrainzProvider =
            _providerResolver.Resolve(MusicBrainzProviderCode);
        if (!musicBrainzProvider.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(
                ToStatus(MusicBrainzProviderCode, musicBrainzProvider.Error));
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> musicBrainzResult =
            await musicBrainzProvider.Value.GetReleaseAsync(
                new ExternalMetadataLookupQuery(musicBrainzRow.ReleaseMbid),
                ExternalMetadataRequestFreshness.Authoritative,
                cancellationToken).ConfigureAwait(false);
        if (!musicBrainzResult.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(
                ToStatus(MusicBrainzProviderCode, musicBrainzResult.Error));
        }

        ExternalMetadataReleaseTrack[] musicBrainzRows =
        [
            .. musicBrainzResult.Value.Tracklist.Where(row =>
                string.Equals(row.Disc, musicBrainzRow.MediumPosition, StringComparison.Ordinal) &&
                HasMusicBrainzSource(row, "track", musicBrainzRow.TrackMbid) &&
                HasMusicBrainzSource(row, "recording", recordingMbid.ToString("D")))
        ];
        if (musicBrainzRows.Length == 0)
        {
            return ExternalReleaseBindingValidationResult.Stale();
        }

        if (musicBrainzRows.Length > 1)
        {
            return ExternalReleaseBindingValidationResult.Ambiguous();
        }

        ExternalMetadataReleaseTrack musicBrainzTrack = musicBrainzRows[0];
        if (discogsRow is null)
        {
            return ExternalReleaseBindingValidationResult.ValidMusicBrainz(
                musicBrainzResult.Value,
                musicBrainzTrack);
        }

        ExternalMetadataResult<IExternalMetadataProvider> discogsProvider =
            _providerResolver.Resolve(DiscogsProviderCode);
        if (!discogsProvider.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(
                ToStatus(DiscogsProviderCode, discogsProvider.Error));
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> discogsResult =
            await discogsProvider.Value.GetReleaseAsync(
                new ExternalMetadataLookupQuery(discogsRow.ReleaseId),
                ExternalMetadataRequestFreshness.Authoritative,
                cancellationToken).ConfigureAwait(false);
        if (!discogsResult.IsSuccess)
        {
            return ExternalReleaseBindingValidationResult.ProviderFailure(
                ToStatus(DiscogsProviderCode, discogsResult.Error));
        }

        if (discogsRow.RowOrdinal < 0 || discogsRow.RowOrdinal >= discogsResult.Value.Tracklist.Count)
        {
            return ExternalReleaseBindingValidationResult.Stale();
        }

        ExternalMetadataReleaseTrack selectedDiscogsRow = discogsResult.Value.Tracklist[discogsRow.RowOrdinal];
        string fingerprint = DiscogsReleaseRowFingerprint.Create(
            selectedDiscogsRow.Position,
            selectedDiscogsRow.Title,
            selectedDiscogsRow.Artists,
            selectedDiscogsRow.Duration);
        if (!string.Equals(
                NormalizeText(selectedDiscogsRow.Position),
                NormalizeText(discogsRow.Position),
                StringComparison.Ordinal) ||
            !string.Equals(fingerprint, discogsRow.Fingerprint, StringComparison.OrdinalIgnoreCase))
        {
            return ExternalReleaseBindingValidationResult.Stale();
        }

        ExternalReleaseRouteMatchAuthority authority = HasDirectDiscogsRelation(
                musicBrainzResult.Value,
                discogsRow.ReleaseId)
            ? ExternalReleaseRouteMatchAuthority.DirectRelationship
            : ExternalReleaseRouteMatchAuthority.DeterministicEvidence;
        ExternalReleaseRouteMatchResult match = _routeMatcher.Match(
            new ExternalReleaseRouteMatchInput
            {
                MusicBrainzRelease = musicBrainzResult.Value,
                MusicBrainzMediumPosition = musicBrainzRow.MediumPosition,
                MusicBrainzTrackMbid = musicBrainzRow.TrackMbid,
                MusicBrainzRecordingMbid = recordingMbid.ToString("D"),
                DiscogsRelease = discogsResult.Value,
                Authority = authority
            });
        DiscogsReleaseRouteBinding? binding = match.CompatibleRows.FirstOrDefault(row =>
            row.RowOrdinal == discogsRow.RowOrdinal &&
            string.Equals(
                NormalizeText(row.Position),
                NormalizeText(discogsRow.Position),
                StringComparison.Ordinal) &&
            string.Equals(row.Fingerprint, discogsRow.Fingerprint, StringComparison.OrdinalIgnoreCase));
        return match.Outcome is ExternalReleaseRouteMatchOutcome.Matched
                or ExternalReleaseRouteMatchOutcome.AmbiguousRows
            && binding is not null
            ? ExternalReleaseBindingValidationResult.ValidDiscogsBacked(
                musicBrainzResult.Value,
                musicBrainzTrack,
                discogsResult.Value,
                selectedDiscogsRow,
                discogsRow)
            : ExternalReleaseBindingValidationResult.Stale();
    }

}
