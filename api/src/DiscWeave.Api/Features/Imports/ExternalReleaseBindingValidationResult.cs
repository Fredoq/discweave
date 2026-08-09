using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

public abstract class ExternalReleaseBindingValidationResult
{
    private ExternalReleaseBindingValidationResult(
        ExternalReleaseBindingValidationOutcome outcome,
        string code)
    {
        Outcome = outcome;
        Code = code;
    }

    public ExternalReleaseBindingValidationOutcome Outcome { get; }

    public string Code { get; }

    public sealed class MusicBrainzValid : ExternalReleaseBindingValidationResult
    {
        internal MusicBrainzValid(
            ExternalMetadataReleaseDetail release,
            ExternalMetadataReleaseTrack row)
            : base(ExternalReleaseBindingValidationOutcome.Valid, "valid")
        {
            Release = release;
            Row = row;
        }

        public ExternalMetadataReleaseDetail Release { get; }

        public ExternalMetadataReleaseTrack Row { get; }
    }

    public sealed class DiscogsBackedValid : ExternalReleaseBindingValidationResult
    {
        internal DiscogsBackedValid(
            ExternalMetadataReleaseDetail musicBrainzRelease,
            ExternalMetadataReleaseTrack musicBrainzRow,
            ExternalMetadataReleaseDetail discogsRelease,
            ExternalMetadataReleaseTrack discogsRow,
            DiscogsReleaseRowLocator locator)
            : base(ExternalReleaseBindingValidationOutcome.Valid, "valid")
        {
            MusicBrainzRelease = musicBrainzRelease;
            MusicBrainzRow = musicBrainzRow;
            DiscogsRelease = discogsRelease;
            DiscogsRow = discogsRow;
            Locator = locator;
        }

        public ExternalMetadataReleaseDetail MusicBrainzRelease { get; }

        public ExternalMetadataReleaseTrack MusicBrainzRow { get; }

        public ExternalMetadataReleaseDetail DiscogsRelease { get; }

        public ExternalMetadataReleaseTrack DiscogsRow { get; }

        public DiscogsReleaseRowLocator Locator { get; }
    }

    public sealed class StaleBinding : ExternalReleaseBindingValidationResult
    {
        internal StaleBinding()
            : base(
                ExternalReleaseBindingValidationOutcome.Stale,
                "import.external_binding_stale")
        {
        }
    }

    public sealed class AmbiguousBinding : ExternalReleaseBindingValidationResult
    {
        internal AmbiguousBinding()
            : base(
                ExternalReleaseBindingValidationOutcome.Ambiguous,
                "import.external_binding_ambiguous")
        {
        }
    }

    public sealed class ProviderFailed : ExternalReleaseBindingValidationResult
    {
        internal ProviderFailed(ExternalProviderOperationStatus status)
            : base(
                ExternalReleaseBindingValidationOutcome.ProviderFailure,
                string.IsNullOrWhiteSpace(status.ErrorCode)
                    ? $"external_metadata.{status.Outcome.ToString().ToLowerInvariant()}"
                    : status.ErrorCode)
        {
            Status = status;
        }

        public ExternalProviderOperationStatus Status { get; }
    }

    public static MusicBrainzValid ValidMusicBrainz(
        ExternalMetadataReleaseDetail release,
        ExternalMetadataReleaseTrack row)
    {
        ArgumentNullException.ThrowIfNull(release);
        ArgumentNullException.ThrowIfNull(row);
        return new MusicBrainzValid(release, row);
    }

    public static DiscogsBackedValid ValidDiscogsBacked(
        ExternalMetadataReleaseDetail musicBrainzRelease,
        ExternalMetadataReleaseTrack musicBrainzRow,
        ExternalMetadataReleaseDetail discogsRelease,
        ExternalMetadataReleaseTrack discogsRow,
        DiscogsReleaseRowLocator locator)
    {
        ArgumentNullException.ThrowIfNull(musicBrainzRelease);
        ArgumentNullException.ThrowIfNull(musicBrainzRow);
        ArgumentNullException.ThrowIfNull(discogsRelease);
        ArgumentNullException.ThrowIfNull(discogsRow);
        ArgumentNullException.ThrowIfNull(locator);
        return new DiscogsBackedValid(
            musicBrainzRelease,
            musicBrainzRow,
            discogsRelease,
            discogsRow,
            locator);
    }

    public static StaleBinding Stale()
    {
        return new();
    }

    public static AmbiguousBinding Ambiguous()
    {
        return new();
    }

    public static ProviderFailed ProviderFailure(ExternalProviderOperationStatus status)
    {
        ArgumentNullException.ThrowIfNull(status);
        return new ProviderFailed(status);
    }
}
