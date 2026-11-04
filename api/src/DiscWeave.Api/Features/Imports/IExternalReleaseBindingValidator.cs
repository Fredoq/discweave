using DiscWeave.Domain.Imports;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Imports;

public interface IExternalReleaseBindingValidator
{
    Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetRecommendedReleaseAsync(
        string discogsReleaseId,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
            new ExternalMetadataError(ExternalMetadataErrorKind.UnsupportedCapability,
                "import.recommended_release_unavailable", "Recommended release review is unavailable")));
    }

    Task<ExternalReleaseBindingValidationResult> ValidateRequestAsync(
        ExternalReleaseDraftRequest request,
        CancellationToken cancellationToken);

    Task<ExternalReleaseBindingValidationResult> RevalidateAsync(
        SelectedOriginalBinding binding,
        CancellationToken cancellationToken);

    Task<ExternalReleaseBindingValidationResult> ValidateMusicBrainzRebindAsync(
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        CancellationToken cancellationToken);

    Task<ExternalReleaseBindingValidationResult> ValidateDiscogsRebindAsync(
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        DiscogsReleaseRowLocator discogsRow,
        CancellationToken cancellationToken);

    Task<ExternalReleaseBindingValidationResult> ValidateDiscogsReleaseAttachAsync(
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        string discogsReleaseId,
        CancellationToken cancellationToken);
}
