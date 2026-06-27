import type { ReleaseImportLooseFileCandidate } from '../catalog/catalogApi'
import {
  decisionBadgeClass,
  decisionLabel,
  filterCount,
  formatBytes,
  formatDuration,
  joinHints,
  looseFileFilters,
  moveHintMatchLabel,
  useLooseFileReviewState,
} from './useLooseFileReviewState'

type LooseFilesPanelProps = Readonly<{
  candidates: ReleaseImportLooseFileCandidate[] | null | undefined
  compact?: boolean
  isAttaching?: boolean
  isCreatingDraft?: boolean
  onCreateDraft?: (candidateIds: string[]) => void
  onReviewLooseFiles?: () => void
  onStartAttach?: (candidateIds: string[]) => void
}>

type LooseFileCandidateCardProps = Readonly<{
  candidate: ReleaseImportLooseFileCandidate
  isSelectable: boolean
  isSelected: boolean
  onToggle: (candidateId: string) => void
}>

type LooseFileReviewState = ReturnType<typeof useLooseFileReviewState>

export function LooseFilesPanel({
  candidates,
  compact = false,
  isAttaching = false,
  isCreatingDraft = false,
  onCreateDraft,
  onReviewLooseFiles,
  onStartAttach,
}: LooseFilesPanelProps) {
  const review = useLooseFileReviewState(candidates)
  const isBusy = isAttaching || isCreatingDraft

  return (
    <section
      className="panel catalog-panel imports-loose-files-panel"
      aria-labelledby="imports-loose-files-heading"
    >
      <LooseFilesHeader
        filteredCount={review.filteredCandidates.length}
        looseFileCount={review.looseFiles.length}
      />
      <div className="imports-loose-body">
        <p className="imports-status">
          Loose files are staged metadata, not catalog tracks.
        </p>
        <LooseFilesPanelContent
          compact={compact}
          isAttaching={isAttaching}
          isBusy={isBusy}
          isCreatingDraft={isCreatingDraft}
          review={review}
          onCreateDraft={onCreateDraft}
          onReviewLooseFiles={onReviewLooseFiles}
          onStartAttach={onStartAttach}
        />
      </div>
    </section>
  )
}

function LooseFilesHeader({
  filteredCount,
  looseFileCount,
}: Readonly<{
  filteredCount: number
  looseFileCount: number
}>) {
  return (
    <div className="panel-heading">
      <div>
        <h2 id="imports-loose-files-heading">Loose files</h2>
        <p>{looseFileCount} staged files</p>
      </div>
      {looseFileCount > 0 ? (
        <span className="badge status-badge status-gray">
          {filteredCount} shown
        </span>
      ) : null}
    </div>
  )
}

function LooseFilesPanelContent({
  compact,
  isAttaching,
  isBusy,
  isCreatingDraft,
  review,
  onCreateDraft,
  onReviewLooseFiles,
  onStartAttach,
}: Readonly<{
  compact: boolean
  isAttaching: boolean
  isBusy: boolean
  isCreatingDraft: boolean
  review: LooseFileReviewState
  onCreateDraft?: (candidateIds: string[]) => void
  onReviewLooseFiles?: () => void
  onStartAttach?: (candidateIds: string[]) => void
}>) {
  if (compact) {
    return <LooseFilesCompactSummary review={review} />
  }

  if (review.looseFiles.length === 0) {
    return (
      <div className="imports-loose-empty">
        <strong>No loose files for this session.</strong>
        <span>This scan did not stage unmatched file metadata.</span>
      </div>
    )
  }

  return (
    <>
      <LooseFileDraftActions
        isAttaching={isAttaching}
        isBusy={isBusy}
        isCreatingDraft={isCreatingDraft}
        review={review}
        onCreateDraft={onCreateDraft}
        onReviewLooseFiles={onReviewLooseFiles}
        onStartAttach={onStartAttach}
      />
      <LooseFileFilterButtons review={review} />
      <LooseFileGroups
        canSelect={Boolean(onCreateDraft || onStartAttach)}
        review={review}
      />
    </>
  )
}

function LooseFilesCompactSummary({
  review,
}: Readonly<{
  review: LooseFileReviewState
}>) {
  const groupSummary = review.groups.map((group) => group.label).join(', ')
  const pendingSummary =
    groupSummary.length > 0
      ? `${review.pendingCandidates.length} pending · ${groupSummary}`
      : `${review.pendingCandidates.length} pending`

  return (
    <div className="imports-loose-summary">
      <span>{pendingSummary}</span>
      <small>
        Open the loose file review workspace on the right to select files and
        resolve release metadata.
      </small>
    </div>
  )
}

function LooseFileDraftActions({
  isAttaching,
  isBusy,
  isCreatingDraft,
  review,
  onCreateDraft,
  onReviewLooseFiles,
  onStartAttach,
}: Readonly<{
  isAttaching: boolean
  isBusy: boolean
  isCreatingDraft: boolean
  review: LooseFileReviewState
  onCreateDraft?: (candidateIds: string[]) => void
  onReviewLooseFiles?: () => void
  onStartAttach?: (candidateIds: string[]) => void
}>) {
  if (!onCreateDraft && !onReviewLooseFiles && !onStartAttach) {
    return null
  }

  function handleCreateDraft() {
    onCreateDraft?.(review.selectedPendingIds)
  }

  function handleStartAttach() {
    onStartAttach?.(review.selectedPendingIds)
  }

  return (
    <div className="imports-loose-draft-actions">
      <div>
        <strong>{review.selectedPendingIds.length} selected</strong>
        <span>
          {review.pendingCandidates.length} pending candidates available
        </span>
      </div>
      <div className="imports-loose-draft-buttons">
        <button
          className="button button-secondary button-compact"
          disabled={review.pendingCandidates.length === 0 || isBusy}
          type="button"
          onClick={review.selectAllPending}
        >
          Select all pending
        </button>
        <button
          className="button button-secondary button-compact"
          disabled={review.selectedPendingIds.length === 0 || isBusy}
          type="button"
          onClick={review.clearSelection}
        >
          Clear selection
        </button>
        {onReviewLooseFiles ? (
          <button
            className="button button-primary button-compact"
            disabled={review.pendingCandidates.length === 0 || isBusy}
            type="button"
            onClick={onReviewLooseFiles}
          >
            Review loose files
          </button>
        ) : null}
        {onCreateDraft ? (
          <button
            className="button button-primary button-compact"
            disabled={review.selectedPendingIds.length === 0 || isBusy}
            type="button"
            onClick={handleCreateDraft}
          >
            {isCreatingDraft ? 'Creating draft' : 'Create release draft'}
          </button>
        ) : null}
        {onStartAttach ? (
          <button
            className="button button-secondary button-compact"
            disabled={review.selectedPendingIds.length === 0 || isBusy}
            type="button"
            onClick={handleStartAttach}
          >
            {isAttaching ? 'Attaching files' : 'Attach to existing release'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function LooseFileFilterButtons({
  review,
}: Readonly<{
  review: LooseFileReviewState
}>) {
  return (
    <div className="imports-loose-filters" aria-label="Loose file filters">
      {looseFileFilters.map((filter) => (
        <button
          aria-pressed={filter.id === review.activeFilter}
          className={looseFilterButtonClass(filter.id === review.activeFilter)}
          key={filter.id}
          type="button"
          onClick={() => review.setActiveFilter(filter.id)}
        >
          {filter.label}
          <span>{filterCount(review.looseFiles, filter.id)}</span>
        </button>
      ))}
    </div>
  )
}

function LooseFileGroups({
  canSelect,
  review,
}: Readonly<{
  canSelect: boolean
  review: LooseFileReviewState
}>) {
  if (review.groups.length === 0) {
    return (
      <div className="imports-loose-empty">
        <strong>No loose files match this filter.</strong>
        <span>Try another review state or metadata filter.</span>
      </div>
    )
  }

  return (
    <div className="imports-loose-groups">
      {review.groups.map((group) => (
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
                isSelected={review.selectedPendingIdSet.has(candidate.id)}
                isSelectable={canSelect && candidate.decision === 'pending'}
                key={candidate.id}
                onToggle={review.toggleCandidate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function looseFilterButtonClass(isSelected: boolean) {
  if (isSelected) {
    return 'button button-secondary button-compact is-selected'
  }

  return 'button button-secondary button-compact'
}

function LooseFileCandidateCard({
  candidate,
  isSelectable,
  isSelected,
  onToggle,
}: LooseFileCandidateCardProps) {
  return (
    <article className="imports-loose-card">
      <div className="imports-loose-card-main">
        <div>
          {isSelectable ? (
            <label className="imports-loose-select">
              <input
                aria-label={`Select ${candidate.relativePath}`}
                checked={isSelected}
                type="checkbox"
                onChange={() => onToggle(candidate.id)}
              />
              <span>Select file</span>
            </label>
          ) : null}
          <strong>{candidate.relativePath}</strong>
          <span>{candidate.filePath}</span>
        </div>
        <span className={`badge status-badge ${decisionBadgeClass(candidate)}`}>
          {decisionLabel(candidate.decision)}
        </span>
      </div>

      {candidate.moveHint ? (
        <output className="imports-move-note">
          <strong>Moved or renamed file hint:</strong>{' '}
          {candidate.moveHint.previousPath
            ? `previously at ${candidate.moveHint.previousPath}`
            : 'multiple previous paths match this file'}{' '}
          ({moveHintMatchLabel(candidate.moveHint.matchKind)},{' '}
          {candidate.moveHint.confidence} confidence)
        </output>
      ) : null}

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
