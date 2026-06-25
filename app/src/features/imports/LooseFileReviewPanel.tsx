import type {
  CreateLooseFileDraftRequest,
  ReleaseImportLooseFileCandidate,
} from '../catalog/catalogApi'
import {
  decisionBadgeClass,
  decisionLabel,
  filterCount,
  formatBytes,
  formatDuration,
  joinHints,
  looseFileFilters,
  useLooseFileReviewState,
} from './useLooseFileReviewState'

type LooseFileReviewPanelProps = Readonly<{
  candidates: ReleaseImportLooseFileCandidate[] | null | undefined
  isAttaching?: boolean
  isCreatingDraft?: boolean
  onCreateDraft: (request: CreateLooseFileDraftRequest) => void
  onStartAttach: (candidateIds: string[]) => void
}>

type LooseFileReviewRowProps = Readonly<{
  candidate: ReleaseImportLooseFileCandidate
  isSelectable: boolean
  isSelected: boolean
  onToggle: (candidateId: string) => void
}>

export function LooseFileReviewPanel({
  candidates,
  isAttaching = false,
  isCreatingDraft = false,
  onCreateDraft,
  onStartAttach,
}: LooseFileReviewPanelProps) {
  const review = useLooseFileReviewState(candidates)
  const {
    activeFilter,
    albumArtistOptions,
    albumTitleOptions,
    clearSelection,
    counts,
    groups,
    inferredArtistNames,
    looseFiles,
    pendingCandidates,
    provisionalTitle,
    reviewedArtistNames,
    reviewedTitle,
    selectAllPending,
    selectedPendingIds,
    selectedPendingIdSet,
    setActiveFilter,
    setReviewedArtistNames,
    setReviewedTitle,
    toDraftRequest,
    toggleCandidate,
  } = review
  const isBusy = isAttaching || isCreatingDraft

  function createDraft() {
    onCreateDraft(toDraftRequest())
  }

  function attachFiles() {
    onStartAttach(selectedPendingIds)
  }

  return (
    <section
      className="panel detail-panel imports-loose-review-panel"
      aria-labelledby="imports-loose-review-heading"
    >
      <div className="detail-header imports-loose-review-header">
        <div>
          <h2 id="imports-loose-review-heading">Loose file review</h2>
          <p>
            These files are staged scan metadata. Review the release context
            before creating a draft or attaching files to an existing release.
          </p>
        </div>
        <div
          className="imports-loose-review-metrics"
          aria-label="Loose file metrics"
        >
          <span className="badge status-badge status-gray">
            {counts.total} total
          </span>
          <span className="badge status-badge status-amber">
            {counts.pending} pending
          </span>
          <span className="badge status-badge status-green">
            {counts.converted} converted
          </span>
          <span className="badge status-badge status-gray">
            {counts.ignored} ignored
          </span>
          <span className="badge status-badge status-gray">
            {counts.selected} selected
          </span>
        </div>
      </div>

      <div className="imports-loose-review-body">
        <div className="imports-loose-review-actions">
          <div>
            <strong>{selectedPendingIds.length} selected</strong>
            <span>{pendingCandidates.length} pending candidates available</span>
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
            <button
              className="button button-primary button-compact"
              disabled={selectedPendingIds.length === 0 || isBusy}
              type="button"
              onClick={createDraft}
            >
              {isCreatingDraft ? 'Creating draft' : 'Create release draft'}
            </button>
            <button
              className="button button-secondary button-compact"
              disabled={selectedPendingIds.length === 0 || isBusy}
              type="button"
              onClick={attachFiles}
            >
              {isAttaching ? 'Attaching files' : 'Attach to existing release'}
            </button>
          </div>
        </div>

        {looseFiles.length === 0 ? (
          <div className="imports-loose-empty">
            <strong>No loose files for this session.</strong>
            <span>This scan did not stage unmatched file metadata.</span>
          </div>
        ) : (
          <>
            <section className="imports-loose-resolution">
              <div>
                <h3>Resolve release title</h3>
                <p>
                  Current provisional title: <strong>{provisionalTitle}</strong>
                </p>
              </div>

              {albumTitleOptions.length > 1 ? (
                <div className="imports-loose-option-list">
                  {albumTitleOptions.map((option) => (
                    <button
                      aria-pressed={reviewedTitle === option.value}
                      className={
                        reviewedTitle === option.value
                          ? 'button button-secondary button-compact is-selected'
                          : 'button button-secondary button-compact'
                      }
                      key={option.value}
                      type="button"
                      onClick={() => setReviewedTitle(option.value)}
                    >
                      Use {option.value}
                      <span className="imports-loose-count-pill">
                        {option.count}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <label>
                <span>Final release title</span>
                <input
                  value={provisionalTitle}
                  onChange={(event) => setReviewedTitle(event.target.value)}
                />
              </label>
            </section>

            {albumArtistOptions.length > 1 ? (
              <section className="imports-loose-resolution">
                <div>
                  <h3>Resolve release artist</h3>
                  <p>
                    Current release artist:{' '}
                    <strong>{joinHints(inferredArtistNames)}</strong>
                  </p>
                </div>
                <div className="imports-loose-option-list">
                  {albumArtistOptions.map((option) => (
                    <button
                      aria-pressed={reviewedArtistNames.includes(option.value)}
                      className={
                        reviewedArtistNames.includes(option.value)
                          ? 'button button-secondary button-compact is-selected'
                          : 'button button-secondary button-compact'
                      }
                      key={option.value}
                      type="button"
                      onClick={() => setReviewedArtistNames([option.value])}
                    >
                      Use {option.value}
                      <span className="imports-loose-count-pill">
                        {option.count}
                      </span>
                    </button>
                  ))}
                  <button
                    className="button button-secondary button-compact"
                    type="button"
                    onClick={() => setReviewedArtistNames([])}
                  >
                    Leave empty
                  </button>
                </div>
              </section>
            ) : null}

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
                  <span className="imports-loose-count-pill">
                    {filterCount(looseFiles, filter.id)}
                  </span>
                </button>
              ))}
            </div>

            <div className="imports-loose-groups">
              {groups.map((group) => (
                <section
                  aria-label={`${group.label} loose files`}
                  className="imports-loose-group imports-loose-review-group"
                  key={group.reason}
                >
                  <div className="imports-loose-group-heading">
                    <div>
                      <h3>{group.label}</h3>
                      <p>{group.description}</p>
                    </div>
                    <span className="imports-loose-count-pill">
                      {group.candidates.length}
                    </span>
                  </div>
                  <div className="imports-loose-review-list">
                    {group.candidates.map((candidate) => (
                      <LooseFileReviewRow
                        candidate={candidate}
                        isSelected={selectedPendingIdSet.has(candidate.id)}
                        isSelectable={candidate.decision === 'pending'}
                        key={candidate.id}
                        onToggle={toggleCandidate}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function LooseFileReviewRow({
  candidate,
  isSelectable,
  isSelected,
  onToggle,
}: LooseFileReviewRowProps) {
  const trackPrefix = candidate.trackNumber
    ? `Track ${candidate.trackNumber}`
    : null
  const title = candidate.titleHint ?? candidate.relativePath
  const pathDetail = candidate.titleHint
    ? candidate.relativePath
    : candidate.filePath

  return (
    <article className="imports-loose-row">
      <div className="imports-loose-row-main">
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
        <div>
          {trackPrefix ? <small>{trackPrefix}</small> : null}
          <strong>{title}</strong>
          <span>{pathDetail}</span>
        </div>
      </div>
      <span className={`badge status-badge ${decisionBadgeClass(candidate)}`}>
        {decisionLabel(candidate.decision)}
      </span>
      <dl className="imports-loose-row-meta" aria-label="Loose file metadata">
        <div>
          <dt>Album</dt>
          <dd>{candidate.albumTitleHint ?? '—'}</dd>
        </div>
        <div>
          <dt>Artist</dt>
          <dd>{joinHints(candidate.artistHints)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(candidate.durationSeconds)}</dd>
        </div>
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
          <dt>Quality</dt>
          <dd>{candidate.quality ?? '—'}</dd>
        </div>
      </dl>
    </article>
  )
}
