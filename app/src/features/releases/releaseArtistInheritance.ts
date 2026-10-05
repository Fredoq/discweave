import type { ReleaseRecord } from './releasesData'

type ArtistCreditLike = {
  artistId?: string | null
  artist: string
  role: string
  roles?: string[]
}

// The inherit flag is not stored; a track inherits when its main artists are
// exactly the release main artists.
export function inheritsReleaseMainArtists(
  release: ReleaseRecord,
  trackCredits: readonly ArtistCreditLike[],
) {
  if (release.isVariousArtists) {
    return false
  }

  const releaseKeys = mainArtistKeys(release.artistCredits ?? [])
  const trackKeys = mainArtistKeys(trackCredits)

  return (
    releaseKeys.size > 0 &&
    releaseKeys.size === trackKeys.size &&
    [...releaseKeys].every((key) => trackKeys.has(key))
  )
}

function mainArtistKeys(credits: readonly ArtistCreditLike[]) {
  return new Set(
    credits
      .filter((credit) =>
        (credit.roles?.length ? credit.roles : [credit.role]).includes(
          'Main artist',
        ),
      )
      .map((credit) => credit.artistId || credit.artist.trim().toLowerCase()),
  )
}
