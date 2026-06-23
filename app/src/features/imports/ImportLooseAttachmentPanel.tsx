import type {
  ReleaseDto,
  ReleaseImportLooseFileCandidate,
} from '../catalog/catalogApi'

type LooseAttachmentMapping = Record<string, string>

type LooseAttachmentPanelProps = Readonly<{
  candidates: ReleaseImportLooseFileCandidate[]
  confirmRelink: boolean
  error: string | null
  isAttaching: boolean
  isSearching: boolean
  mappings: LooseAttachmentMapping
  releaseOptions: ReleaseDto[]
  releaseSearch: string
  selectedReleaseId: string
  onCancel: () => void
  onConfirm: () => void
  onConfirmRelinkChange: (confirmRelink: boolean) => void
  onMappingChange: (candidateId: string, releaseTrackId: string) => void
  onReleaseSearchChange: (query: string) => void
  onSearch: () => void
  onSelectRelease: (release: ReleaseDto) => void
}>

export function LooseAttachmentPanel({
  candidates,
  confirmRelink,
  error,
  isAttaching,
  isSearching,
  mappings,
  releaseOptions,
  releaseSearch,
  selectedReleaseId,
  onCancel,
  onConfirm,
  onConfirmRelinkChange,
  onMappingChange,
  onReleaseSearchChange,
  onSearch,
  onSelectRelease,
}: LooseAttachmentPanelProps) {
  const selectedRelease =
    releaseOptions.find((release) => release.id === selectedReleaseId) ?? null
  const tracklist = selectedRelease?.tracklist ?? []
  const mappableTracklist = tracklist.filter(hasReleaseTrackId)
  const mappedCount = candidates.filter(
    (candidate) => mappings[candidate.id],
  ).length

  return (
    <section className="panel catalog-panel imports-loose-attach-panel">
      <div className="panel-heading">
        <div>
          <h2>Attach to existing release</h2>
          <p>
            Map {candidates.length} selected loose file
            {candidates.length === 1 ? '' : 's'} to release track rows.
          </p>
        </div>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      <div className="imports-loose-attach-body">
        <div className="imports-loose-attach-search">
          <label>
            <span>Search releases</span>
            <input
              aria-label="Search releases"
              value={releaseSearch}
              onChange={(event) => onReleaseSearchChange(event.target.value)}
            />
          </label>
          <button
            className="button button-secondary"
            disabled={isSearching}
            type="button"
            onClick={onSearch}
          >
            {isSearching ? 'Searching' : 'Search'}
          </button>
        </div>

        {releaseOptions.length > 0 ? (
          <div className="imports-loose-release-results">
            {releaseOptions.map((release) => (
              <button
                aria-pressed={release.id === selectedReleaseId}
                className={
                  release.id === selectedReleaseId
                    ? 'imports-loose-release-option is-selected'
                    : 'imports-loose-release-option'
                }
                key={release.id}
                type="button"
                onClick={() => onSelectRelease(release)}
              >
                <strong>{release.title}</strong>
                <span>
                  {release.year ?? 'Unknown year'} ·{' '}
                  {release.tracklist?.length ?? 0} track
                  {release.tracklist?.length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {selectedRelease ? (
          <div className="imports-loose-attach-grid">
            <div>
              <h3>Selected loose files</h3>
              <div className="imports-loose-attach-list">
                {candidates.map((candidate) => (
                  <label
                    className="imports-loose-attach-candidate"
                    key={candidate.id}
                  >
                    <span>
                      <strong>{candidate.relativePath}</strong>
                      <small>
                        {candidate.titleHint ?? 'Untitled'} · track{' '}
                        {candidate.trackNumber ?? '—'}
                      </small>
                    </span>
                    <select
                      aria-label={`Map ${candidate.relativePath}`}
                      value={mappings[candidate.id] ?? ''}
                      onChange={(event) =>
                        onMappingChange(candidate.id, event.target.value)
                      }
                    >
                      <option value="">Leave pending</option>
                      {mappableTracklist.map((track) => (
                        <option
                          key={track.releaseTrackId}
                          value={track.releaseTrackId}
                        >
                          {trackLabel(track)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3>Release tracklist</h3>
              <div className="imports-loose-tracklist-map">
                {tracklist.map((track) => (
                  <article
                    className="imports-loose-track-row"
                    key={track.releaseTrackId ?? track.trackId}
                  >
                    <div>
                      <strong>{trackLabel(track)}</strong>
                      <span>{track.title}</span>
                    </div>
                    <small>{linkedFileState(track)}</small>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {selectedRelease ? (
          <div className="imports-loose-attach-footer">
            <label className="imports-loose-relink-confirm">
              <input
                checked={confirmRelink}
                type="checkbox"
                onChange={(event) =>
                  onConfirmRelinkChange(event.target.checked)
                }
              />
              <span>Confirm relink of existing local files</span>
            </label>
            <span>
              {mappedCount} / {candidates.length} mapped
            </span>
            <button
              className="button button-primary"
              disabled={isAttaching || mappedCount === 0}
              type="button"
              onClick={onConfirm}
            >
              {isAttaching ? 'Attaching' : 'Confirm attachment'}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="imports-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function hasReleaseTrackId(
  track: NonNullable<ReleaseDto['tracklist']>[number],
): track is NonNullable<ReleaseDto['tracklist']>[number] & {
  releaseTrackId: string
} {
  return Boolean(track.releaseTrackId)
}

function trackLabel(track: NonNullable<ReleaseDto['tracklist']>[number]) {
  const context = [track.disc, track.side].filter(Boolean).join(' · ')
  const prefix = context ? `${context} · ` : ''
  return `${prefix}Track ${track.position}`
}

function linkedFileState(track: NonNullable<ReleaseDto['tracklist']>[number]) {
  const files = track.linkedLocalFiles ?? []
  if (files.length === 0) {
    return 'No linked local file'
  }

  return files.length === 1
    ? files[0].path
    : `${files.length} linked local files`
}
