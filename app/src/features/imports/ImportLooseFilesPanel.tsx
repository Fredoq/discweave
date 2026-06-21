import { useMemo, useState } from 'react'
import type { ReleaseImportLooseFileCandidate } from '../catalog/catalogApi'

const looseFileFilters = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'ignored', label: 'Ignored' },
  { id: 'consumed', label: 'Consumed / converted' },
  { id: 'hasMetadata', label: 'Has metadata' },
  { id: 'missingHash', label: 'Missing hash' },
] as const

type LooseFileFilter = (typeof looseFileFilters)[number]['id']

export function LooseFilesPanel({
  candidates,
}: {
  candidates: ReleaseImportLooseFileCandidate[] | null | undefined
}) {
  const looseFiles = useMemo(() => candidates ?? [], [candidates])
  const [activeFilter, setActiveFilter] = useState<LooseFileFilter>('all')
  const filteredCandidates = useMemo(
    () =>
      looseFiles.filter((candidate) => matchesFilter(candidate, activeFilter)),
    [activeFilter, looseFiles],
  )
  const groups = useMemo(
    () => groupByReason(filteredCandidates),
    [filteredCandidates],
  )

  return (
    <section
      className="panel catalog-panel imports-loose-files-panel"
      aria-labelledby="imports-loose-files-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="imports-loose-files-heading">Loose files</h2>
          <p>{looseFiles.length} staged files</p>
        </div>
        {looseFiles.length > 0 ? (
          <span className="badge status-badge status-gray">
            {filteredCandidates.length} shown
          </span>
        ) : null}
      </div>
      <div className="imports-loose-body">
        <p className="imports-status">
          Loose files are staged metadata, not catalog tracks.
        </p>

        {looseFiles.length === 0 ? (
          <div className="imports-loose-empty">
            <strong>No loose files for this session.</strong>
            <span>This scan did not stage unmatched file metadata.</span>
          </div>
        ) : (
          <>
            <div
              className="imports-loose-filters"
              aria-label="Loose file filters"
            >
              {looseFileFilters.map((filter) => (
                <button
                  aria-pressed={filter.id === activeFilter}
                  className={
                    filter.id === activeFilter
                      ? 'button button-secondary button-compact is-selected'
                      : 'button button-secondary button-compact'
                  }
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                  <span>{filterCount(looseFiles, filter.id)}</span>
                </button>
              ))}
            </div>

            {groups.length > 0 ? (
              <div className="imports-loose-groups">
                {groups.map((group) => (
                  <section
                    aria-label={`${group.label} loose files`}
                    className="imports-loose-group"
                    key={group.reason}
                  >
                    <div className="imports-loose-group-heading">
                      <h3>{group.label}</h3>
                      <span>{group.candidates.length}</span>
                    </div>
                    <div className="imports-loose-list">
                      {group.candidates.map((candidate) => (
                        <LooseFileCandidateCard
                          candidate={candidate}
                          key={candidate.id}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="imports-loose-empty">
                <strong>No loose files match this filter.</strong>
                <span>Try another review state or metadata filter.</span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function LooseFileCandidateCard({
  candidate,
}: {
  candidate: ReleaseImportLooseFileCandidate
}) {
  return (
    <article className="imports-loose-card">
      <div className="imports-loose-card-main">
        <div>
          <strong>{candidate.relativePath}</strong>
          <span>{candidate.filePath}</span>
        </div>
        <span className={`badge status-badge ${decisionBadgeClass(candidate)}`}>
          {decisionLabel(candidate.decision)}
        </span>
      </div>

      <dl className="imports-loose-facts" aria-label="Loose file facts">
        <div>
          <dt>Format</dt>
          <dd>{candidate.format.toUpperCase()}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{formatBytes(candidate.sizeBytes)}</dd>
        </div>
        <div>
          <dt>Hash</dt>
          <dd>{candidate.contentHash ? 'Hash present' : 'Missing hash'}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(candidate.durationSeconds)}</dd>
        </div>
        <div>
          <dt>Codec</dt>
          <dd>{candidate.codec ?? '—'}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{candidate.quality ?? '—'}</dd>
        </div>
      </dl>

      <dl className="imports-loose-tags" aria-label="Loose file tag hints">
        <div>
          <dt>Title hint</dt>
          <dd>{candidate.titleHint ?? '—'}</dd>
        </div>
        <div>
          <dt>Artist hint</dt>
          <dd>{joinHints(candidate.artistHints)}</dd>
        </div>
        <div>
          <dt>Album hint</dt>
          <dd>{candidate.albumTitleHint ?? '—'}</dd>
        </div>
        <div>
          <dt>Album artist hint</dt>
          <dd>{joinHints(candidate.albumArtistHints)}</dd>
        </div>
      </dl>
    </article>
  )
}

function matchesFilter(
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
    return ['consumed', 'converted'].includes(candidate.decision)
  }

  if (filter === 'hasMetadata') {
    return hasMetadata(candidate)
  }

  return !candidate.contentHash
}

function filterCount(
  candidates: ReleaseImportLooseFileCandidate[],
  filter: LooseFileFilter,
) {
  return candidates.filter((candidate) => matchesFilter(candidate, filter))
    .length
}

function groupByReason(candidates: ReleaseImportLooseFileCandidate[]) {
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
      candidates: groupCandidates,
    }))
}

function hasMetadata(candidate: ReleaseImportLooseFileCandidate) {
  return Boolean(
    candidate.titleHint ||
    candidate.artistHints.length > 0 ||
    candidate.albumTitleHint ||
    candidate.albumArtistHints.length > 0 ||
    candidate.trackNumber,
  )
}

function decisionBadgeClass(candidate: ReleaseImportLooseFileCandidate) {
  if (candidate.decision === 'pending') {
    return 'status-amber'
  }

  if (['consumed', 'converted'].includes(candidate.decision)) {
    return 'status-green'
  }

  return 'status-gray'
}

function decisionLabel(decision: string) {
  return humanizeToken(decision)
}

function humanizeToken(value: string) {
  const label = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()

  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Unknown'
}

function formatBytes(bytes: number) {
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

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) {
    return '—'
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
    .toString()
    .padStart(2, '0')
  return `${minutes}:${remainder}`
}

function joinHints(values: string[]) {
  return values.length > 0 ? values.join(', ') : '—'
}
