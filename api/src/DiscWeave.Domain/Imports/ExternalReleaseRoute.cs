using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public sealed class ExternalReleaseRoute
{
    private ExternalReleaseRoute()
    {
    }

    private ExternalReleaseRoute(
        ReleaseImportProviderReference musicBrainzRelease,
        IOptionalValue<ReleaseImportProviderReference> discogsRelease)
    {
        MusicBrainzRelease = musicBrainzRelease;
        DiscogsRelease = discogsRelease;
    }

    public ReleaseImportProviderReference MusicBrainzRelease { get; private init; } = null!;

    public IOptionalValue<ReleaseImportProviderReference> DiscogsRelease { get; private init; } =
        Optional.Missing<ReleaseImportProviderReference>();

    public static ExternalReleaseRoute CreateMusicBrainz(
        ReleaseImportProviderReference musicBrainzRelease)
    {
        ValidateReleaseReference(musicBrainzRelease, "musicbrainz");
        return new ExternalReleaseRoute(
            musicBrainzRelease,
            Optional.Missing<ReleaseImportProviderReference>());
    }

    public static ExternalReleaseRoute CreateDiscogsBacked(
        ReleaseImportProviderReference musicBrainzRelease,
        ReleaseImportProviderReference discogsRelease)
    {
        ValidateReleaseReference(musicBrainzRelease, "musicbrainz");
        ValidateReleaseReference(discogsRelease, "discogs");
        return new ExternalReleaseRoute(musicBrainzRelease, Optional.From(discogsRelease));
    }

    internal bool HasSameValueAs(ExternalReleaseRoute other)
    {
        return other is not null &&
            MusicBrainzRelease.HasSameValueAs(other.MusicBrainzRelease) &&
            DiscogsRelease.Match(
                left => other.DiscogsRelease.Match(left.HasSameValueAs, () => false),
                () => !other.DiscogsRelease.HasValue);
    }

    private static void ValidateReleaseReference(
        ReleaseImportProviderReference reference,
        string expectedProviderCode)
    {
        ArgumentNullException.ThrowIfNull(reference);
        if (!string.Equals(reference.ProviderCode, expectedProviderCode, StringComparison.Ordinal) ||
            !string.Equals(reference.ResourceType, "release", StringComparison.Ordinal))
        {
            throw new DomainException(
                "release_import.release_route_invalid",
                $"Release route requires a canonical {expectedProviderCode} release reference");
        }
    }
}
