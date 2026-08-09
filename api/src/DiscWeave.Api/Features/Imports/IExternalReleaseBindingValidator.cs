using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

public interface IExternalReleaseBindingValidator
{
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
