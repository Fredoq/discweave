import { useEffect, useId, useRef, useState } from 'react'
import type { TrackDto } from '../catalog/api/catalogTypes'
import { DuplicateTrackCandidate } from './DuplicateTrackCandidate'
import { loadDuplicateTrackRecords } from './duplicateTrackReview'

type Props = Readonly<{
  ids: readonly string[]
  onClose: () => void
  onOpen: (kind: 'track' | 'release', id: string, title: string) => void
}>

export function DuplicateTrackReviewDialog({ ids, onClose, onOpen }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const [records, setRecords] = useState<TrackDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [keeperId, setKeeperId] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<string[]>([])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
  }, [])

  useEffect(() => {
    let current = true
    void loadDuplicateTrackRecords(ids)
      .then((loaded) => {
        if (current) setRecords(loaded)
      })
      .catch((reason: unknown) => {
        if (current)
          setError(
            reason instanceof Error && reason.message.startsWith('A candidate')
              ? reason.message
              : 'Candidate records could not be loaded. Try again.',
          )
      })
    return () => {
      current = false
    }
  }, [ids, attempt])

  function close() {
    if (typeof dialogRef.current?.close === 'function')
      dialogRef.current.close()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      aria-modal="true"
      className="duplicate-track-review-dialog"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <header className="duplicate-track-review-heading">
        <h2 id={headingId}>Compare duplicate tracks</h2>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={close}
        >
          Close comparison
        </button>
      </header>
      <p>
        These records share a title and main artist. That does not prove they
        are the same recording. Compare their releases, duration and credits.
      </p>
      <p className="duplicate-track-review-notice">
        Selection preview only. No records will be changed. Choices are not
        saved when you close.
      </p>
      {!records && !error ? (
        <p>
          <output>Loading all {ids.length} records…</output>
        </p>
      ) : null}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button button-secondary button-compact"
            type="button"
            onClick={() => {
              setError(null)
              setAttempt((value) => value + 1)
            }}
          >
            Retry comparison
          </button>
        </div>
      ) : null}
      {records ? (
        <>
          <p>
            Select the record to keep, then explicitly mark its duplicates.
            Unselected records remain separate. Keeping a record does not change
            its Original recording marker.
          </p>
          <div className="duplicate-track-candidates">
            {records.map((track, index) => (
              <DuplicateTrackCandidate
                key={track.id}
                track={track}
                number={index + 1}
                keeperId={keeperId}
                selected={duplicates.includes(track.id)}
                onKeep={() => {
                  setKeeperId(track.id)
                  setDuplicates([])
                }}
                onSelect={(selected) =>
                  setDuplicates((values) =>
                    selected
                      ? [...values, track.id]
                      : values.filter((id) => id !== track.id),
                  )
                }
                onOpen={(kind, id, title) => {
                  close()
                  onOpen(kind, id, title)
                }}
              />
            ))}
          </div>
          <section
            className="duplicate-track-preview"
            aria-label="Selection preview"
            aria-live="polite"
          >
            <h3>Selection preview</h3>
            {!keeperId ? (
              <p>No record selected to keep.</p>
            ) : (
              <p>
                Keep record{' '}
                {records.findIndex((track) => track.id === keeperId) + 1}.{' '}
                {duplicates.length} explicitly selected{' '}
                {duplicates.length === 1 ? 'duplicate' : 'duplicates'}.{' '}
                {records.length - duplicates.length - 1} other records remain
                separate.
              </p>
            )}
            {duplicates.length > 0 ? (
              <p>
                Proposed release links to redirect:{' '}
                {records
                  .filter((track) => duplicates.includes(track.id))
                  .reduce(
                    (count, track) =>
                      count + (track.releaseAppearances?.length ?? 0),
                    0,
                  )}
                . No links have been changed.
              </p>
            ) : null}
            <p>
              Merging is not available yet. A safe merge must preserve release
              rows and file links, playlist order, credits, ratings, relations
              and import references in one transaction. This preview does not
              check those dependencies or resolve metadata conflicts.
            </p>
          </section>
        </>
      ) : null}
    </dialog>
  )
}
