import type { ExternalMetadataReleaseDraftTrackDto } from '../catalog/catalogApi'

export type DiscogsCurrentTrackForMapping = {
  id: string
  title: string
  fileName: string
  position: number
  durationSeconds?: number | null
}

export type DiscogsTrackMappingRow = {
  currentTrackId: string | null
  currentTrackIndex: number | null
  discogsTrackIndex: number
  matchKind: 'exact' | 'review' | 'unmatched'
  reason: string
}

export function buildDiscogsTrackMapping(
  currentTracks: readonly DiscogsCurrentTrackForMapping[],
  discogsTracks: readonly ExternalMetadataReleaseDraftTrackDto[],
): DiscogsTrackMappingRow[] {
  const remainingCurrentIndexes = new Set(
    currentTracks.map((_, index) => index),
  )
  const remainingDiscogsIndexes = new Set(
    discogsTracks.map((_, index) => index),
  )
  const rows = new Map<number, DiscogsTrackMappingRow>()

  for (const discogsTrackIndex of [...remainingDiscogsIndexes]) {
    const discogsTitle = normalizeTrackTitle(
      discogsTracks[discogsTrackIndex].title,
    )
    if (!discogsTitle) {
      continue
    }

    const matchingDiscogsIndexes = [...remainingDiscogsIndexes].filter(
      (index) =>
        normalizeTrackTitle(discogsTracks[index].title) === discogsTitle,
    )
    const matchingCurrentIndexes = [...remainingCurrentIndexes].filter(
      (index) =>
        normalizeTrackTitle(currentTracks[index].title) === discogsTitle,
    )

    if (
      matchingDiscogsIndexes.length !== 1 ||
      matchingCurrentIndexes.length !== 1
    ) {
      continue
    }

    const currentTrackIndex = matchingCurrentIndexes[0]
    rows.set(discogsTrackIndex, {
      currentTrackId: currentTracks[currentTrackIndex].id,
      currentTrackIndex,
      discogsTrackIndex,
      matchKind: 'exact',
      reason: 'Titles match',
    })
    remainingCurrentIndexes.delete(currentTrackIndex)
    remainingDiscogsIndexes.delete(discogsTrackIndex)
  }

  const remainingCurrent = [...remainingCurrentIndexes]
  const remainingDiscogs = [...remainingDiscogsIndexes]
  if (remainingCurrent.length === 1 && remainingDiscogs.length === 1) {
    const discogsTrackIndex = remainingDiscogs[0]
    const currentTrackIndex = remainingCurrent[0]
    rows.set(discogsTrackIndex, {
      currentTrackId: currentTracks[currentTrackIndex].id,
      currentTrackIndex,
      discogsTrackIndex,
      matchKind: 'review',
      reason: 'Version labels differ',
    })
  } else {
    for (const discogsTrackIndex of remainingDiscogs) {
      rows.set(discogsTrackIndex, {
        currentTrackId: null,
        currentTrackIndex: null,
        discogsTrackIndex,
        matchKind: 'unmatched',
        reason: 'No safe automatic match',
      })
    }
  }

  return discogsTracks.map((_, index) => rows.get(index)!)
}

function normalizeTrackTitle(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
