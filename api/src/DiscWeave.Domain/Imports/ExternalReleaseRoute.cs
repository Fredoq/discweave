using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

#pragma warning disable CS8618
public sealed class ExternalReleaseRoute
{
    private ExternalReleaseRoute()
    {
    }

    private ExternalReleaseRoute(
        ReleaseImportProviderReference? musicBrainzRelease,
        IOptionalValue<ReleaseImportProviderReference> discogsRelease)
    {
        MusicBrainzRelease = musicBrainzRelease;
        DiscogsRelease = discogsRelease;
    }

    public ReleaseImportProviderReference? MusicBrainzRelease { get; private init; }

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

    public static ExternalReleaseRoute CreateDiscogs(ReleaseImportProviderReference discogsRelease)
    {
        ValidateReleaseReference(discogsRelease, "discogs");
        return new ExternalReleaseRoute(null, Optional.From(discogsRelease));
    }

    public IReadOnlyList<ReleaseImportProviderReference> Sources =>
        [.. MusicBrainzRelease is { } source ? new[] { source } : [],
         .. DiscogsRelease.Match(value => new[] { value }, () => [])];

    internal bool HasSameValueAs(ExternalReleaseRoute other)
    {
        return other is not null &&
            (MusicBrainzRelease is null ? other.MusicBrainzRelease is null : other.MusicBrainzRelease is not null && MusicBrainzRelease.HasSameValueAs(other.MusicBrainzRelease)) &&
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
#pragma warning restore CS8618
