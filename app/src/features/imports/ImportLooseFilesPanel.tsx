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
  const {
    activeFilter,
    clearSelection,
    filteredCandidates,
    groups,
    looseFiles,
    pendingCandidates,
    selectAllPending,
    selectedPendingIds,
    selectedPendingIdSet,
    setActiveFilter,
    toggleCandidate,
  } = review
  const isBusy = isAttaching || isCreatingDraft

  function handleCreateDraft() {
    onCreateDraft?.(selectedPendingIds)
  }

  function handleStartAttach() {
    onStartAttach?.(selectedPendingIds)
  }

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

        {compact ? (
          <div className="imports-loose-summary">
            <span>
              {pendingCandidates.length} pending
              {groups.length > 0
                ? ` · ${groups.map((group) => group.label).join(', ')}`
                : ''}
            </span>
            <small>
              Open the loose file review workspace on the right to select files
              and resolve release metadata.
            </small>
          </div>
        ) : null}

        {!compact &&
        looseFiles.length > 0 &&
        (onCreateDraft || onReviewLooseFiles || onStartAttach) ? (
          <div className="imports-loose-draft-actions">
            <div>
              <strong>{selectedPendingIds.length} selected</strong>
              <span>
                {pendingCandidates.length} pending candidates available
              </span>
            </div>
            <div className="imports-loose-draft-buttons">
              <button
                className="button button-secondary button-compact"
                disabled={pendingCandidates.length === 0 || isBusy}
                type="button"
                onClick={selectAllPending}
              >
                Select all pending
              </button>
              <button
                className="button button-secondary button-compact"
                disabled={selectedPendingIds.length === 0 || isBusy}
                type="button"
                onClick={clearSelection}
              >
                Clear selection
              </button>
              {onReviewLooseFiles ? (
                <button
                  className="button button-primary button-compact"
                  disabled={pendingCandidates.length === 0 || isBusy}
                  type="button"
                  onClick={onReviewLooseFiles}
                >
                  Review loose files
                </button>
              ) : null}
              {onCreateDraft ? (
                <button
                  className="button button-primary button-compact"
                  disabled={selectedPendingIds.length === 0 || isBusy}
                  type="button"
                  onClick={handleCreateDraft}
                >
                  {isCreatingDraft ? 'Creating draft' : 'Create release draft'}
                </button>
              ) : null}
              {onStartAttach ? (
                <button
                  className="button button-secondary button-compact"
                  disabled={selectedPendingIds.length === 0 || isBusy}
                  type="button"
                  onClick={handleStartAttach}
                >
                  {isAttaching
                    ? 'Attaching files'
                    : 'Attach to existing release'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {compact ? null : looseFiles.length === 0 ? (
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
                          isSelected={selectedPendingIdSet.has(candidate.id)}
                          isSelectable={Boolean(
                            (onCreateDraft || onStartAttach) &&
                            candidate.decision === 'pending',
                          )}
                          key={candidate.id}
                          onToggle={toggleCandidate}
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
