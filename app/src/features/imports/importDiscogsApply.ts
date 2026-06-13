import type { ArtistRecord } from '../artists/artistsData'
import type {
  CatalogDictionaries,
  ExternalMetadataReleaseDetailDto,
  ExternalMetadataReleaseDraftArtistCreditDto,
  ReleaseImportArtistCredit,
  ReleaseImportDraft,
} from '../catalog/catalogApi'
import type { DiscogsApplyGroups } from '../releases/DiscogsReleaseLookupPanel'
import {
  discogsTracklistNeedsVariousArtists,
  splitDiscogsRoleLabels,
} from '../releases/discogsRoleUtils'
import {
  withDraftArtistCredits,
  withDraftLabels,
  withTrackArtistCredits,
} from './importHelpers'

export function applyDiscogsReleaseToImportDraft({
  artists,
  detail,
  dictionaries,
  draft,
  groups,
}: {
  artists: ArtistRecord[]
  detail: ExternalMetadataReleaseDetailDto
  dictionaries: CatalogDictionaries
  draft: ReleaseImportDraft
  groups: DiscogsApplyGroups
}): ReleaseImportDraft {
  const discogsDraft = detail.draft
  let nextDraft = { ...draft }

  if (groups.core) {
    nextDraft = {
      ...nextDraft,
      title: discogsDraft.title,
      type: discogsDraft.type
        ? releaseTypeCodeForDiscogsValue(discogsDraft.type, dictionaries)
        : nextDraft.type,
      year: discogsDraft.year ?? null,
      releaseDate: discogsDraft.releaseDate ?? null,
    }
  }

  if (groups.artists) {
    nextDraft = withDraftArtistCredits(
      { ...nextDraft, isVariousArtists: false },
      importCreditsFromDiscogsCredits(
        discogsDraft.artistCredits,
        artists,
        dictionaries,
      ),
    )
  }

  if (groups.labels) {
    nextDraft = withDraftLabels(
      { ...nextDraft, notOnLabel: false },
      discogsDraft.labels.map((label) => ({
        labelId: null,
        name: label.name,
        catalogNumber: label.catalogNumber ?? null,
        hasNoCatalogNumber: label.hasNoCatalogNumber,
      })),
    )
  }

  if (groups.classification) {
    nextDraft = {
      ...nextDraft,
      genres: [...(discogsDraft.genres ?? [])],
      tags: [...nextDraft.tags],
    }
  }

  if (groups.tracklist) {
    const discogsTracks = discogsDraft.tracklist
    nextDraft = {
      ...nextDraft,
      isVariousArtists: discogsTracklistNeedsVariousArtists(
        discogsTracks,
        discogsDraft,
      )
        ? true
        : nextDraft.isVariousArtists,
      tracks: nextDraft.tracks.map((track, index) => {
        const discogsTrack = discogsTracks[index]
        if (!discogsTrack) {
          return track
        }

        return withTrackArtistCredits(
          {
            ...track,
            position: discogsTrack.position || track.position,
            disc: discogsTrack.disc ?? null,
            side: discogsTrack.side ?? null,
            title: discogsTrack.title,
            durationSeconds: discogsTrack.durationSeconds ?? null,
          },
          importCreditsFromDiscogsCredits(
            discogsTrack.artistCredits,
            artists,
            dictionaries,
          ),
        )
      }),
    }
  }

  return {
    ...nextDraft,
    externalSources: discogsDraft.externalSources.map((source) => ({
      ...source,
      appliedAt: new Date().toISOString(),
    })),
  }
}

function importCreditsFromDiscogsCredits(
  credits: ExternalMetadataReleaseDraftArtistCreditDto[],
  artists: ArtistRecord[],
  dictionaries: CatalogDictionaries,
): ReleaseImportArtistCredit[] {
  return credits.flatMap((credit) => {
    const artistName = credit.name.trim()
    if (!artistName) {
      return []
    }

    const existingArtist = artists.find(
      (artist) => artist.name.toLowerCase() === artistName.toLowerCase(),
    )
    const roles = roleCodesForDiscogsRole(credit.role, dictionaries)
    const effectiveRoles = roles.length > 0 ? roles : ['mainArtist']

    return effectiveRoles.map((role) => ({
      artistId: existingArtist?.id ?? null,
      name: existingArtist?.name ?? artistName,
      role,
    }))
  })
}

function roleCodesForDiscogsRole(
  role: string,
  dictionaries: CatalogDictionaries,
) {
  return splitDiscogsRoleLabels(role).map((part) => {
    const trimmed = part.trim()
    const normalized = normalizeDictionaryValue(trimmed)
    const alias = discogsRoleAlias(normalized)
    return (
      dictionaries.creditRole.find(
        (entry) =>
          normalizeDictionaryValue(entry.code) === normalized ||
          normalizeDictionaryValue(entry.name) === normalized ||
          (alias && normalizeDictionaryValue(entry.code) === alias),
      )?.code ?? trimmed
    )
  })
}

function discogsRoleAlias(normalizedRole: string) {
  if (normalizedRole === 'remix' || normalizedRole === 'remixedby') {
    return 'remixer'
  }

  if (normalizedRole === 'writtenby' || normalizedRole === 'written') {
    return 'composer'
  }

  return ''
}

function releaseTypeCodeForDiscogsValue(
  value: string,
  dictionaries: CatalogDictionaries,
) {
  const trimmed = value.trim()
  const normalized = normalizeDictionaryValue(trimmed)
  return (
    dictionaries.releaseType.find(
      (entry) =>
        normalizeDictionaryValue(entry.code) === normalized ||
        normalizeDictionaryValue(entry.name) === normalized,
    )?.code ?? trimmed
  )
}

function normalizeDictionaryValue(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}
