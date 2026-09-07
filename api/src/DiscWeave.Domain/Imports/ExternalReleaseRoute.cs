using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public abstract class ExternalReleaseRoute
{
    private ExternalReleaseRoute()
    {
    }

    public abstract IOptionalValue<ReleaseImportProviderReference> DiscogsRelease { get; }

    public abstract IReadOnlyList<ReleaseImportProviderReference> Sources { get; }

    public abstract TResult Match<TResult>(Func<MusicBrainz, TResult> musicBrainz, Func<Discogs, TResult> discogs);

    public sealed class MusicBrainz : ExternalReleaseRoute
    {
        internal MusicBrainz(ReleaseImportProviderReference release, IOptionalValue<ReleaseImportProviderReference> discogsRelease)
        {
            ValidateReleaseReference(release, "musicbrainz");
            ArgumentNullException.ThrowIfNull(discogsRelease);
            _ = discogsRelease.Match(value => { ValidateReleaseReference(value, "discogs"); return true; }, () => true);
            MusicBrainzRelease = release;
            DiscogsRelease = discogsRelease;
        }

        public ReleaseImportProviderReference MusicBrainzRelease { get; }

        public override IOptionalValue<ReleaseImportProviderReference> DiscogsRelease { get; }

        public override IReadOnlyList<ReleaseImportProviderReference> Sources =>
            [MusicBrainzRelease, .. DiscogsRelease.Match(value => new[] { value }, () => [])];

        public override TResult Match<TResult>(Func<MusicBrainz, TResult> musicBrainz, Func<Discogs, TResult> discogs)
        {
            ArgumentNullException.ThrowIfNull(musicBrainz);
            ArgumentNullException.ThrowIfNull(discogs);
            return musicBrainz(this);
        }
    }

    public sealed class Discogs : ExternalReleaseRoute
    {
        internal Discogs(ReleaseImportProviderReference release)
        {
            ValidateReleaseReference(release, "discogs");
            Release = release;
        }

        public ReleaseImportProviderReference Release { get; }

        public override IOptionalValue<ReleaseImportProviderReference> DiscogsRelease => Optional.From(Release);

        public override IReadOnlyList<ReleaseImportProviderReference> Sources => [Release];

        public override TResult Match<TResult>(Func<MusicBrainz, TResult> musicBrainz, Func<Discogs, TResult> discogs)
        {
            ArgumentNullException.ThrowIfNull(musicBrainz);
            ArgumentNullException.ThrowIfNull(discogs);
            return discogs(this);
        }
    }

    public static ExternalReleaseRoute CreateMusicBrainz(ReleaseImportProviderReference musicBrainzRelease)
    {
        return new MusicBrainz(musicBrainzRelease, Optional.Missing<ReleaseImportProviderReference>());
    }

    public static ExternalReleaseRoute CreateDiscogsBacked(
        ReleaseImportProviderReference musicBrainzRelease,
        ReleaseImportProviderReference discogsRelease)
    {
        return new MusicBrainz(musicBrainzRelease, Optional.From(discogsRelease));
    }

    public static ExternalReleaseRoute CreateDiscogs(ReleaseImportProviderReference discogsRelease)
    {
        return new Discogs(discogsRelease);
    }

    internal bool HasSameValueAs(ExternalReleaseRoute other)
    {
        return other is not null && Sources.Count == other.Sources.Count &&
            Sources.Zip(other.Sources).All(pair => pair.First.HasSameValueAs(pair.Second));
    }

    private static void ValidateReleaseReference(ReleaseImportProviderReference reference, string expectedProviderCode)
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
