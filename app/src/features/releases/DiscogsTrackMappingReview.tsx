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
  mapping: readonly DiscogsTrackMappingRow[]
  onSelectTrack: (discogsTrackIndex: number, currentTrackId: string) => void
  onConfirmMatch: (row: DiscogsTrackMappingRow) => void
}

export function DiscogsTrackMappingReview({
  confirmedMappingKeys,
  currentTracks,
  discogsTracks,
  mapping,
  onSelectTrack,
  onConfirmMatch,
}: Readonly<DiscogsTrackMappingReviewProps>) {
  const movedCount = mapping.filter((row) => {
    const currentTrack = currentTrackForRow(row, currentTracks)
    const discogsTrack = discogsTracks[row.discogsTrackIndex]
    return Boolean(
      currentTrack &&
      discogsTrack &&
      currentTrack.position !== discogsTrack.position,
    )
  }).length
  const reviewCount = mapping.filter(
    (row) =>
      row.matchKind === 'review' &&
      !confirmedMappingKeys.has(discogsTrackMappingKey(row)),
  ).length
  const unmatchedCount = mapping.filter(
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
            {mapping.map((row) => {
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
                      <span>
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
      <p className="discogs-mapping-note">
        Discogs supplies final metadata and order. Local file links stay
        attached to the matched tracks.
      </p>
    </div>
  )
}

function MappingResult({
  currentTrack,
  discogsTrack,
  isConfirmed,
  onConfirm,
  row,
}: Readonly<{
  currentTrack: DiscogsCurrentTrackForMapping | undefined
  discogsTrack: ExternalMetadataReleaseDraftTrackDto | undefined
  isConfirmed: boolean
  onConfirm: () => void
  row: DiscogsTrackMappingRow
}>) {
  if (row.matchKind === 'unmatched') {
    return (
      <div className="discogs-mapping-result">
        <span className="badge discogs-mapping-status">No safe match</span>
        <span>{row.reason}</span>
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
      </div>
    )
  }

  return (
    <div className="discogs-mapping-result">
      <span className="badge discogs-mapping-status">Matched</span>
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
