import type { ExternalMetadataReleaseDraftTrackDto } from '../catalog/catalogApi'
import type {
  DiscogsCurrentTrackForMapping,
  DiscogsTrackMappingRow,
} from './discogsTrackMapping'
import { discogsTrackMappingKey } from './discogsTrackMapping'
import { warningText as formatWarningText } from './discogsTrackMappingWarning'

type DiscogsTrackMappingReviewProps = {
  confirmedMappingKeys: ReadonlySet<string>
  currentTracks: readonly DiscogsCurrentTrackForMapping[]
  discogsTracks: readonly ExternalMetadataReleaseDraftTrackDto[]
  keptTrackIds: ReadonlySet<string>
  mapping: readonly DiscogsTrackMappingRow[]
  onSelectTrack: (discogsTrackIndex: number, currentTrackId: string) => void
  onConfirmMatch: (row: DiscogsTrackMappingRow) => void
  onKeepTrack: (currentTrackId: string) => void
  onUndoKeep: (currentTrackId: string) => void
  onSkipDiscogsRow: (discogsTrackIndex: number) => void
  onRestoreDiscogsRow: (discogsTrackIndex: number) => void
}

export function DiscogsTrackMappingReview({
  confirmedMappingKeys,
  currentTracks,
  discogsTracks,
  keptTrackIds,
  mapping,
  onSelectTrack,
  onConfirmMatch,
  onKeepTrack,
  onUndoKeep,
  onSkipDiscogsRow,
  onRestoreDiscogsRow,
}: Readonly<DiscogsTrackMappingReviewProps>) {
  const skippedRows = mapping.filter((row) => row.matchKind === 'skipped')
  const activeMapping = mapping.filter((row) => row.matchKind !== 'skipped')
  const partialMode = skippedRows.length > 0 || keptTrackIds.size > 0
  const movedCount = partialMode
    ? 0
    : activeMapping.filter((row) => {
        const currentTrack = currentTrackForRow(row, currentTracks)
        const discogsTrack = discogsTracks[row.discogsTrackIndex]
        return Boolean(
          currentTrack &&
          discogsTrack &&
          currentTrack.position !== discogsTrack.position,
        )
      }).length
  const reviewCount = activeMapping.filter(
    (row) =>
      row.matchKind === 'review' &&
      !confirmedMappingKeys.has(discogsTrackMappingKey(row)),
  ).length
  const unmatchedCount = activeMapping.filter(
    (row) => row.matchKind === 'unmatched',
  ).length
  const warning = warningText(movedCount, reviewCount, unmatchedCount)

  return (
    <div className="discogs-track-mapping-review">
      {warning ? (
        <p className="discogs-impact-warning discogs-mapping-warning">
          {warning}
        </p>
      ) : null}
      <p className="discogs-mapping-counts">
        {currentTracks.length} local tracks · {discogsTracks.length} Discogs
        rows
      </p>
      <div className="discogs-mapping-table-scroll">
        <table className="discogs-mapping-table">
          <caption>Discogs track mapping review</caption>
          <thead>
            <tr>
              <th scope="col">Imported file</th>
              <th scope="col">Discogs track</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {activeMapping.map((row) => {
              const currentTrack = currentTrackForRow(row, currentTracks)
              const discogsTrack = discogsTracks[row.discogsTrackIndex]
              const discogsTrackLabel = row.discogsTrackIndex + 1
              const isConfirmed = confirmedMappingKeys.has(
                discogsTrackMappingKey(row),
              )

              return (
                <tr key={row.discogsTrackIndex}>
                  <td>
                    <label className="discogs-mapping-select">
                      <span className="visually-hidden">
                        Imported file for Discogs track {discogsTrackLabel}
                      </span>
                      <select
                        aria-label={`Imported file for Discogs track ${discogsTrackLabel}`}
                        value={row.currentTrackId ?? ''}
                        onChange={(event) =>
                          onSelectTrack(
                            row.discogsTrackIndex,
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Select imported file</option>
                        {currentTracks.map((track) => (
                          <option key={track.id} value={track.id}>
                            {track.fileName} (Position {track.position})
                          </option>
                        ))}
                      </select>
                    </label>
                  </td>
                  <td>
                    {discogsTrack ? (
                      <>
                        <strong>{discogsTrack.title}</strong>
                        <span>
                          Position {discogsTrack.position} ·{' '}
                          {durationLabel(discogsTrack.durationSeconds)}
                        </span>
                      </>
                    ) : (
                      <span>Discogs track unavailable</span>
                    )}
                  </td>
                  <td>
                    <MappingResult
                      currentTrack={currentTrack}
                      isConfirmed={isConfirmed}
                      onConfirm={() => onConfirmMatch(row)}
                      onKeep={
                        currentTrack
                          ? () => onKeepTrack(currentTrack.id)
                          : undefined
                      }
                      onSkip={() => onSkipDiscogsRow(row.discogsTrackIndex)}
                      row={row}
                      discogsTrack={discogsTrack}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {currentTracks.some(
        (track) =>
          !activeMapping.some((row) => row.currentTrackId === track.id) &&
          !keptTrackIds.has(track.id),
      ) || keptTrackIds.size > 0 ? (
        <section
          aria-label="Local track exceptions"
          className="discogs-local-exceptions"
        >
          <h4>Local tracks without a Discogs match</h4>
          {currentTracks.map((track) => {
            const kept = keptTrackIds.has(track.id)
            const mapped = activeMapping.some(
              (row) => row.currentTrackId === track.id,
            )
            if (mapped && !kept) {
              return null
            }
            return (
              <div className="discogs-local-exception" key={track.id}>
                <div>
                  <strong>{track.fileName}</strong>
                  <span>Position {track.position}</span>
                </div>
                {kept ? (
                  <>
                    <span className="badge discogs-mapping-status">
                      Kept unchanged
                    </span>
                    <button
                      className="button button-secondary button-compact"
                      type="button"
                      onClick={() => onUndoKeep(track.id)}
                    >
                      Undo
                    </button>
                  </>
                ) : (
                  <>
                    <span className="badge discogs-mapping-status">
                      No Discogs match
                    </span>
                    <button
                      className="button button-secondary button-compact"
                      type="button"
                      onClick={() => onKeepTrack(track.id)}
                    >
                      Keep my metadata
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </section>
      ) : null}
      {skippedRows.length > 0 ? (
        <details className="discogs-skipped-rows">
          <summary>Skipped Discogs rows ({skippedRows.length})</summary>
          {skippedRows.map((row) => {
            const discogsTrack = discogsTracks[row.discogsTrackIndex]
            return (
              <div className="discogs-skipped-row" key={row.discogsTrackIndex}>
                <span>
                  {discogsTrack?.title ?? 'Discogs track unavailable'} ·
                  Position {discogsTrack?.position ?? row.discogsTrackIndex + 1}
                </span>
                <button
                  aria-label={`Restore Discogs row ${row.discogsTrackIndex + 1}`}
                  className="button button-secondary button-compact"
                  type="button"
                  onClick={() => onRestoreDiscogsRow(row.discogsTrackIndex)}
                >
                  Restore
                </button>
              </div>
            )
          })}
        </details>
      ) : null}
      <p className="discogs-mapping-note">
        {partialMode
          ? 'Your track order and local files stay unchanged.'
          : 'Discogs supplies final metadata and order. Local file links stay attached to the matched tracks.'}
      </p>
      <p aria-live="polite" className="discogs-mapping-outcome">
        {activeMapping.filter((row) => row.currentTrackId).length} tracks to
        update · {keptTrackIds.size} kept unchanged · {skippedRows.length}{' '}
        Discogs row
        {skippedRows.length === 1 ? '' : 's'} skipped
      </p>
    </div>
  )
}

function MappingResult({
  currentTrack,
  discogsTrack,
  isConfirmed,
  onConfirm,
  onKeep,
  onSkip,
  row,
}: Readonly<{
  currentTrack: DiscogsCurrentTrackForMapping | undefined
  discogsTrack: ExternalMetadataReleaseDraftTrackDto | undefined
  isConfirmed: boolean
  onConfirm: () => void
  onKeep: (() => void) | undefined
  onSkip: () => void
  row: DiscogsTrackMappingRow
}>) {
  if (row.matchKind === 'unmatched') {
    return (
      <div className="discogs-mapping-result">
        <span className="badge discogs-mapping-status">No safe match</span>
        <span>{row.reason}</span>
        <button
          aria-label={`Skip Discogs row ${row.discogsTrackIndex + 1}`}
          className="button button-secondary button-compact"
          type="button"
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    )
  }

  if (row.matchKind === 'review') {
    return (
      <div className="discogs-mapping-result">
        <span className="badge discogs-mapping-status">
          {isConfirmed ? 'Confirmed' : 'Needs review'}
        </span>
        <span>{row.reason}</span>
        <button
          aria-disabled={isConfirmed}
          aria-label={
            isConfirmed
              ? `Match confirmed for ${currentTrack?.fileName ?? 'imported file'}`
              : undefined
          }
          className="button button-secondary button-compact"
          type="button"
          onClick={isConfirmed ? undefined : onConfirm}
        >
          {isConfirmed
            ? 'Confirmed'
            : `Confirm match for ${currentTrack?.fileName ?? 'imported file'}`}
        </button>
        {onKeep ? (
          <button
            className="button button-secondary button-compact"
            type="button"
            onClick={onKeep}
          >
            Keep my metadata
          </button>
        ) : null}
        <button
          aria-label={`Skip Discogs row ${row.discogsTrackIndex + 1}`}
          className="button button-secondary button-compact"
          type="button"
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    )
  }

  return (
    <div className="discogs-mapping-result">
      <span className="badge discogs-mapping-status">Matched</span>
      {onKeep ? (
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={onKeep}
        >
          Keep my metadata
        </button>
      ) : null}
      <button
        aria-label={`Skip Discogs row ${row.discogsTrackIndex + 1}`}
        className="button button-secondary button-compact"
        type="button"
        onClick={onSkip}
      >
        Skip
      </button>
      {currentTrack &&
      discogsTrack &&
      currentTrack.position !== discogsTrack.position ? (
        <span>
          Moves {currentTrack.position} → {discogsTrack.position}
        </span>
      ) : null}
    </div>
  )
}

function currentTrackForRow(
  row: DiscogsTrackMappingRow,
  currentTracks: readonly DiscogsCurrentTrackForMapping[],
) {
  return row.currentTrackId
    ? currentTracks.find((track) => track.id === row.currentTrackId)
    : undefined
}

function warningText(
  movedCount: number,
  reviewCount: number,
  unmatchedCount: number,
) {
  return formatWarningText(movedCount, reviewCount, unmatchedCount)
}

function durationLabel(durationSeconds: number | null | undefined) {
  if (!durationSeconds) {
    return 'No duration'
  }

  return `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`
}
