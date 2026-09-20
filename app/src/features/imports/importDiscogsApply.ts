import type { ArtistRecord } from '../artists/artistsData'
import type {
  CatalogDictionaries,
  ExternalMetadataReleaseDetailDto,
  ExternalMetadataReleaseDraftArtistCreditDto,
  ReleaseImportArtistCredit,
  ReleaseImportDraft,
  ReleaseImportProviderReference,
} from '../catalog/catalogApi'
import type { DiscogsApplyGroups } from '../releases/DiscogsReleaseLookupPanel'
import type { DiscogsTrackMappingRow } from '../releases/discogsTrackMapping'
import {
  discogsTracklistNeedsVariousArtists,
  splitDiscogsRoleLabels,
} from '../releases/discogsRoleUtils'
import {
  withDraftArtistCredits,
  withDraftLabels,
  withTrackArtistCredits,
  effectiveDraftArtistCredits,
  effectiveTrackArtistCredits,
} from './importHelpers'
import { isCompleteDiscogsTrackMapping } from '../releases/discogsTrackMapping'

export function applyDiscogsReleaseToImportDraft({
  artists,
  detail,
  dictionaries,
  draft,
  groups,
  includeExternalSources = true,
  keptTrackIds = [],
  confirmedMappingKeys = [],
  trackMapping,
}: {
  artists: ArtistRecord[]
  detail: ExternalMetadataReleaseDetailDto
  dictionaries: CatalogDictionaries
  draft: ReleaseImportDraft
  groups: DiscogsApplyGroups
  includeExternalSources?: boolean
  keptTrackIds?: readonly string[]
  confirmedMappingKeys?: readonly string[]
  trackMapping?: readonly DiscogsTrackMappingRow[]
}): ReleaseImportDraft {
  const discogsDraft = detail.draft
  const applicableTracks = draft.tracks.filter((track) => !track.isSkipped)
  if (groups.tracklist && trackMapping) {
    validateDiscogsTrackMapping(
      applicableTracks,
      discogsDraft.tracklist,
      trackMapping,
      keptTrackIds,
      confirmedMappingKeys,
    )
  }
  const partialTracklist = Boolean(
    groups.tracklist &&
    trackMapping &&
    (keptTrackIds.length > 0 ||
      trackMapping.some((row) => row.matchKind === 'skipped') ||
      draft.tracks.some((track) => track.isSkipped)),
  )
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

  if (partialTracklist && keptTrackIds.length > 0) {
    const keptIds = new Set(keptTrackIds)
    nextDraft = {
      ...nextDraft,
      tracks: nextDraft.tracks.map((track) =>
        keptIds.has(track.id)
          ? withTrackArtistCredits(
              {
                ...track,
                hasExplicitVersionYear: true,
                inheritReleaseArtistCredits: false,
                versionYear: track.hasExplicitVersionYear
                  ? (track.versionYear ?? null)
                  : (track.versionYear ?? draft.year ?? null),
              },
              effectiveTrackCreditsBeforeApply(track, draft),
            )
          : track,
      ),
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
      genres: [...(discogsDraft.genres ?? []).map(normalizeDiscogsGenre)],
      tags: [...nextDraft.tags],
    }
  }

  if (groups.tracklist) {
    nextDraft = applyDiscogsTracklist(
      nextDraft,
      discogsDraft,
      artists,
      dictionaries,
      trackMapping,
      partialTracklist,
      includeExternalSources,
    )
  }

  return {
    ...nextDraft,
    externalSources: includeExternalSources
      ? unionDraftSources(
          nextDraft.externalSources ?? [],
          discogsDraft.externalSources,
        )
      : nextDraft.externalSources,
  }
}

function applyDiscogsTracklist(
  draft: ReleaseImportDraft,
  discogsDraft: ExternalMetadataReleaseDetailDto['draft'],
  artists: ArtistRecord[],
  dictionaries: CatalogDictionaries,
  trackMapping: readonly DiscogsTrackMappingRow[] | undefined,
  partialTracklist: boolean,
  includeExternalSources: boolean,
): ReleaseImportDraft {
  const discogsTracks = discogsDraft.tracklist
  const appliedDiscogsTracks = trackMapping
    ? trackMapping
        .filter((row) => row.matchKind !== 'skipped')
        .map((row) => discogsTracks[row.discogsTrackIndex])
        .filter((track): track is (typeof discogsTracks)[number] =>
          Boolean(track),
        )
    : discogsTracks
  const needsVariousArtists = discogsTracklistNeedsVariousArtists(
    appliedDiscogsTracks,
    {
      ...discogsDraft,
      artistCredits: effectiveDraftArtistCredits(draft),
      tracklist: appliedDiscogsTracks,
    },
  )
  const releaseMainArtistKeys = new Set(
    effectiveDraftArtistCredits(draft)
      .filter((credit) => isMainArtistRole(credit.role))
      .flatMap((credit) => artistCreditKeys(credit)),
  )

  return {
    ...draft,
    isVariousArtists: needsVariousArtists ? true : draft.isVariousArtists,
    tracks: applyTracklist(
      draft.tracks,
      discogsTracks,
      trackMapping,
      partialTracklist,
      (track, discogsTrack) => {
        const discogsCredits = importCreditsFromDiscogsCredits(
          discogsTrack.artistCredits,
          artists,
          dictionaries,
        )
        const splitCredits = needsVariousArtists
          ? {
              artistCredits: discogsCredits,
              inheritReleaseArtistCredits: false,
            }
          : splitTrackCreditsForInheritance(
              discogsCredits,
              releaseMainArtistKeys,
            )

        return withTrackArtistCredits(
          {
            ...track,
            position: partialTracklist
              ? track.position
              : discogsTrack.position || track.position,
            disc: partialTracklist ? track.disc : (discogsTrack.disc ?? null),
            side: partialTracklist ? track.side : (discogsTrack.side ?? null),
            title: discogsTrack.title,
            durationSeconds:
              discogsTrack.durationSeconds ?? track.durationSeconds ?? null,
            inheritReleaseArtistCredits:
              splitCredits.inheritReleaseArtistCredits,
            externalSources: includeExternalSources
              ? unionDraftSources(
                  track.externalSources ?? [],
                  discogsTrack.externalSources ?? [],
                )
              : track.externalSources,
          },
          splitCredits.artistCredits,
        )
      },
    ),
  }
}

function applyTracklist<T extends ReleaseImportDraft['tracks'][number]>(
  currentTracks: readonly T[],
  discogsTracks: readonly ExternalMetadataReleaseDetailDto['draft']['tracklist'][number][],
  trackMapping: readonly DiscogsTrackMappingRow[] | undefined,
  partialTracklist: boolean,
  mergeTrack: (track: T, discogsTrack: (typeof discogsTracks)[number]) => T,
) {
  if (!trackMapping) {
    return currentTracks.map((track, index) => {
      const discogsTrack = discogsTracks[index]
      return discogsTrack ? mergeTrack(track, discogsTrack) : track
    })
  }

  if (partialTracklist) {
    const mappedTracksById = new Map(
      trackMapping.map((mapping) => [mapping.currentTrackId, mapping]),
    )
    return currentTracks.map((track) => {
      const mapping = mappedTracksById.get(track.id)
      const discogsTrack = mapping
        ? discogsTracks[mapping.discogsTrackIndex]
        : undefined
      return discogsTrack ? mergeTrack(track, discogsTrack) : track
    })
  }

  const mappedTrackIds = new Set<string>()
  const mappedTracks = [...trackMapping]
    .sort((left, right) => left.discogsTrackIndex - right.discogsTrackIndex)
    .flatMap((mapping) => {
      if (!mapping.currentTrackId) {
        return []
      }

      const currentTrack = currentTracks.find(
        (track) => track.id === mapping.currentTrackId,
      )
      const discogsTrack = discogsTracks[mapping.discogsTrackIndex]
      if (
        !currentTrack ||
        !discogsTrack ||
        mappedTrackIds.has(currentTrack.id)
      ) {
        return []
      }

      mappedTrackIds.add(currentTrack.id)
      return [mergeTrack(currentTrack, discogsTrack)]
    })

  return [
    ...mappedTracks,
    ...currentTracks.filter((track) => !mappedTrackIds.has(track.id)),
  ]
}

function validateDiscogsTrackMapping<
  T extends ReleaseImportDraft['tracks'][number],
>(
  currentTracks: readonly T[],
  discogsTracks: readonly ExternalMetadataReleaseDetailDto['draft']['tracklist'][number][],
  trackMapping: readonly DiscogsTrackMappingRow[],
  keptTrackIds: readonly string[],
  confirmedMappingKeys: readonly string[],
) {
  const currentTracksForMapping = currentTracks.map((track) => ({
    id: track.id,
    title: track.title,
    fileName: track.relativePath ?? track.title,
    position: track.position ?? 0,
    durationSeconds: track.durationSeconds,
  }))
  if (
    !isCompleteDiscogsTrackMapping(
      currentTracksForMapping,
      discogsTracks,
      trackMapping,
      keptTrackIds,
      confirmedMappingKeys,
    )
  ) {
    throw new Error('Discogs track mapping must be complete and one-to-one.')
  }
}

function effectiveTrackCreditsBeforeApply(
  track: ReleaseImportDraft['tracks'][number],
  draft: ReleaseImportDraft,
) {
  const explicitCredits = effectiveTrackArtistCredits(track)
  if (!track.inheritReleaseArtistCredits || draft.isVariousArtists) {
    return explicitCredits
  }

  const releaseCredits = effectiveDraftArtistCredits(draft)
  const mainCredits = releaseCredits.filter((credit) =>
    isMainArtistRole(credit.role),
  )
  const inheritedCredits = (
    mainCredits.length > 0 ? mainCredits : releaseCredits
  ).map((credit) => ({ ...credit, role: 'mainArtist' }))
  return [...inheritedCredits, ...explicitCredits]
}

function unionDraftSources(
  current: ReleaseImportProviderReference[],
  authoritative: ReleaseImportProviderReference[],
) {
  const byIdentity = new Map<string, ReleaseImportProviderReference>()
  for (const source of [...current, ...authoritative]) {
    const canonical = {
      providerCode: source.providerCode.trim().toLowerCase(),
      resourceType: source.resourceType.trim().toLowerCase(),
      externalId: source.externalId.trim(),
      sourceUrl: source.sourceUrl,
    }
    byIdentity.set(
      `${canonical.providerCode}\u0000${canonical.resourceType}\u0000${canonical.externalId}`,
      canonical,
    )
  }

  return [...byIdentity.values()].sort((left, right) =>
    `${left.providerCode}\u0000${left.resourceType}\u0000${left.externalId}\u0000${left.sourceUrl}`.localeCompare(
      `${right.providerCode}\u0000${right.resourceType}\u0000${right.externalId}\u0000${right.sourceUrl}`,
    ),
  )
}

function splitTrackCreditsForInheritance(
  credits: ReleaseImportArtistCredit[],
  releaseMainArtistKeys: Set<string>,
) {
  const inheritReleaseArtistCredits = true
  const artistCredits: ReleaseImportArtistCredit[] = []

  for (const credit of credits) {
    if (
      isMainArtistRole(credit.role) &&
      artistCreditKeys(credit).some((key) => releaseMainArtistKeys.has(key))
    ) {
      continue
    }

    artistCredits.push(credit)
  }

  return { artistCredits, inheritReleaseArtistCredits }
}

function artistCreditKeys(credit: ReleaseImportArtistCredit) {
  const keys: string[] = []
  if (credit.artistId) {
    keys.push(`id:${credit.artistId}`)
  }

  const name = credit.name.trim()
  if (name) {
    keys.push(`name:${normalizeDictionaryValue(name)}`)
  }

  if (credit.externalSource) {
    keys.push(
      `source:${credit.externalSource.providerName.toLowerCase()}:${credit.externalSource.resourceType.toLowerCase()}:${credit.externalSource.externalId}`,
    )
  }

  return keys
}

function isMainArtistRole(role: string) {
  const normalized = normalizeDictionaryValue(role)
  return normalized === 'mainartist'
}

function normalizeDiscogsGenre(genre: string) {
  return genre.trim().replace(/^genre\s+/i, '')
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

    const externalSource = credit.externalSource ?? null
    const existingArtist = externalSource
      ? artists.find((artist) =>
          artist.externalSources?.some((source) =>
            hasSameExternalSourceIdentity(source, externalSource),
          ),
        )
      : artists.find(
          (artist) => artist.name.toLowerCase() === artistName.toLowerCase(),
        )
    const roles = roleCodesForDiscogsRole(credit.role, dictionaries)
    const effectiveRoles = roles.length > 0 ? roles : ['mainArtist']

    return effectiveRoles.map((role) => ({
      artistId: existingArtist?.id ?? null,
      name: existingArtist?.name ?? artistName,
      role,
      externalSource,
    }))
  })
}

function hasSameExternalSourceIdentity(
  source: NonNullable<ReleaseImportArtistCredit['externalSource']>,
  other: NonNullable<ReleaseImportArtistCredit['externalSource']>,
) {
  return (
    source.providerName.toLowerCase() === other.providerName.toLowerCase() &&
    source.resourceType.toLowerCase() === other.resourceType.toLowerCase() &&
    source.externalId === other.externalId
  )
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
