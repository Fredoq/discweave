import { useMemo, useState } from 'react'
import type {
  CreateLooseFileDraftRequest,
  ReleaseImportLooseFileCandidate,
} from '../catalog/catalogApi'

export const looseFileFilters = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'ignored', label: 'Ignored' },
  { id: 'consumed', label: 'Consumed / converted' },
  { id: 'hasMetadata', label: 'Has metadata' },
  { id: 'missingHash', label: 'Missing hash' },
] as const

export const terminalLooseFileDecisions = new Set([
  'consumed',
  'converted',
  'convertedToDraft',
  'attachedToRelease',
])

export type LooseFileFilter = (typeof looseFileFilters)[number]['id']

export type LooseHintOption = Readonly<{
  value: string
  count: number
}>

export function useLooseFileReviewState(
  candidates: ReleaseImportLooseFileCandidate[] | null | undefined,
) {
  const looseFiles = useMemo(() => candidates ?? [], [candidates])
  const pendingCandidates = useMemo(
    () => looseFiles.filter((candidate) => candidate.decision === 'pending'),
    [looseFiles],
  )
  const [activeFilter, setActiveFilter] = useState<LooseFileFilter>('all')
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [reviewedTitle, setReviewedTitle] = useState('')
  const [reviewedArtistNames, setReviewedArtistNames] = useState<string[]>([])

  const selectedPendingIds = useMemo(
    () =>
      selectedCandidateIds.filter((candidateId) =>
        pendingCandidates.some((candidate) => candidate.id === candidateId),
      ),
    [pendingCandidates, selectedCandidateIds],
  )
  const selectedPendingIdSet = useMemo(
    () => new Set(selectedPendingIds),
    [selectedPendingIds],
  )
  const selectedPendingCandidates = useMemo(
    () =>
      pendingCandidates.filter((candidate) =>
        selectedPendingIdSet.has(candidate.id),
      ),
    [pendingCandidates, selectedPendingIdSet],
  )
  const reviewCandidates =
    selectedPendingCandidates.length > 0
      ? selectedPendingCandidates
      : pendingCandidates
  const albumTitleOptions = useMemo(
    () =>
      countDistinctHints(
        reviewCandidates.map((candidate) => candidate.albumTitleHint),
      ),
    [reviewCandidates],
  )
  const albumArtistOptions = useMemo(
    () =>
      countDistinctHints(
        reviewCandidates.flatMap((candidate) => candidate.albumArtistHints),
      ),
    [reviewCandidates],
  )
  const inferredArtistNames = inferredLooseArtistNames(
    reviewedArtistNames,
    albumArtistOptions,
  )
  const provisionalTitle =
    reviewedTitle ||
    (albumTitleOptions.length === 1 ? albumTitleOptions[0].value : '') ||
    commonFolderName(reviewCandidates) ||
    'Loose files'
  const filteredCandidates = useMemo(
    () =>
      looseFiles.filter((candidate) => matchesFilter(candidate, activeFilter)),
    [activeFilter, looseFiles],
  )
  const groups = useMemo(
    () => groupByReason(filteredCandidates),
    [filteredCandidates],
  )
  const counts = useMemo(
    () => ({
      total: looseFiles.length,
      pending: pendingCandidates.length,
      selected: selectedPendingIds.length,
      converted: looseFiles.filter((candidate) =>
        terminalLooseFileDecisions.has(candidate.decision),
      ).length,
      ignored: looseFiles.filter(
        (candidate) => candidate.decision === 'ignored',
      ).length,
      hasMetadata: looseFiles.filter(hasMetadata).length,
      missingHash: looseFiles.filter((candidate) => !candidate.contentHash)
        .length,
    }),
    [looseFiles, pendingCandidates.length, selectedPendingIds.length],
  )

  function toggleCandidate(candidateId: string) {
    setSelectedCandidateIds((currentIds) =>
      currentIds.includes(candidateId)
        ? currentIds.filter((id) => id !== candidateId)
        : [...currentIds, candidateId],
    )
  }

  function selectAllPending() {
    setSelectedCandidateIds(pendingCandidates.map((candidate) => candidate.id))
  }

  function clearSelection() {
    setSelectedCandidateIds([])
  }

  function toDraftRequest(): CreateLooseFileDraftRequest {
    const trimmedReviewedTitle = reviewedTitle.trim()
    return {
      candidateIds: selectedPendingIds,
      reviewedTitle: trimmedReviewedTitle || null,
      reviewedArtistNames:
        reviewedArtistNames.length > 0 ? reviewedArtistNames : null,
    }
  }

  return {
    activeFilter,
    albumArtistOptions,
    albumTitleOptions,
    clearSelection,
    counts,
    filteredCandidates,
    groups,
    inferredArtistNames,
    looseFiles,
    pendingCandidates,
    provisionalTitle,
    reviewCandidates,
    reviewedArtistNames,
    reviewedTitle,
    selectedPendingIds,
    selectedPendingIdSet,
    setActiveFilter,
    setReviewedArtistNames,
    setReviewedTitle,
    selectAllPending,
    toDraftRequest,
    toggleCandidate,
  }
}

export function matchesFilter(
  candidate: ReleaseImportLooseFileCandidate,
  filter: LooseFileFilter,
) {
  if (filter === 'all') {
    return true
  }

  if (filter === 'pending') {
    return candidate.decision === 'pending'
  }

  if (filter === 'ignored') {
    return candidate.decision === 'ignored'
  }

  if (filter === 'consumed') {
    return terminalLooseFileDecisions.has(candidate.decision)
  }

  if (filter === 'hasMetadata') {
    return hasMetadata(candidate)
  }

  return !candidate.contentHash
}

export function filterCount(
  candidates: ReleaseImportLooseFileCandidate[],
  filter: LooseFileFilter,
) {
  return candidates.filter((candidate) => matchesFilter(candidate, filter))
    .length
}

export function groupByReason(candidates: ReleaseImportLooseFileCandidate[]) {
  const groups = new Map<string, ReleaseImportLooseFileCandidate[]>()
  for (const candidate of candidates) {
    groups.set(candidate.reason, [
      ...(groups.get(candidate.reason) ?? []),
      candidate,
    ])
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, groupCandidates]) => ({
      reason,
      label: humanizeToken(reason),
      description: reasonDescription(reason),
      candidates: groupCandidates,
    }))
}

export function hasMetadata(candidate: ReleaseImportLooseFileCandidate) {
  return Boolean(
    candidate.titleHint ||
    candidate.artistHints.length > 0 ||
    candidate.albumTitleHint ||
    candidate.albumArtistHints.length > 0 ||
    candidate.trackNumber,
  )
}

export function decisionBadgeClass(candidate: ReleaseImportLooseFileCandidate) {
  if (candidate.decision === 'pending') {
    return 'status-amber'
  }

  if (terminalLooseFileDecisions.has(candidate.decision)) {
    return 'status-green'
  }

  return 'status-gray'
}

export function decisionLabel(decision: string) {
  return humanizeToken(decision)
}

export function moveHintMatchLabel(matchKind: string) {
  if (matchKind === 'contentHash') {
    return 'same content hash'
  }

  if (matchKind === 'scanManifestIdentity') {
    return 'same scan manifest identity'
  }

  if (matchKind === 'sizeMtime') {
    return 'same size and modified time'
  }

  return matchKind
}

export function humanizeToken(value: string) {
  const label = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()

  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Unknown'
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '—'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds) {
    return '—'
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
    .toString()
    .padStart(2, '0')
  return `${minutes}:${remainder}`
}

export function joinHints(values: string[]) {
  return values.length > 0 ? values.join(', ') : '—'
}

function countDistinctHints(values: Array<string | null | undefined>) {
  const counts = new Map<string, LooseHintOption>()
  for (const value of values) {
    const hint = value?.trim()
    if (!hint) {
      continue
    }

    const key = hint.toLowerCase()
    const existing = counts.get(key)
    counts.set(key, {
      value: existing?.value ?? hint,
      count: (existing?.count ?? 0) + 1,
    })
  }

  return [...counts.values()].sort((left, right) =>
    left.value.localeCompare(right.value),
  )
}

function commonFolderName(candidates: ReleaseImportLooseFileCandidate[]) {
  const folders = countDistinctHints(
    candidates.map((candidate) => {
      const segments = candidate.relativePath.split('/').filter(Boolean)
      return segments.length > 1 ? segments.at(-2) : null
    }),
  )

  return folders.length === 1 ? folders[0].value : null
}

function inferredLooseArtistNames(
  reviewedArtistNames: string[],
  albumArtistOptions: LooseHintOption[],
) {
  if (reviewedArtistNames.length > 0) {
    return reviewedArtistNames
  }

  if (albumArtistOptions.length === 1) {
    return [albumArtistOptions[0].value]
  }

  return []
}

function reasonDescription(reason: string) {
  if (reason === 'mixed_album_tags') {
    return 'Album tags disagree, so DiscWeave did not create a release draft automatically.'
  }

  if (reason === 'root_audio_unclear_release_context') {
    return 'Audio files are at the scan root, so the release boundary needs review.'
  }

  return 'DiscWeave staged these files because the scanner could not trust the release context.'
}
