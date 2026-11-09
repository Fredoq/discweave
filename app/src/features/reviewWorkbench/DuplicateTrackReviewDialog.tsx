import { useEffect, useId, useRef, useState } from 'react'
import type { TrackDto } from '../catalog/api/catalogTypes'
import { DuplicateTrackMerge } from './DuplicateTrackMerge'
import { DuplicateTrackCandidate } from './DuplicateTrackCandidate'
import { loadDuplicateTrackRecords } from './duplicateTrackReview'

type Props = Readonly<{
  ids: readonly string[]
  onChanged?: () => void
  onClose: () => void
  onOpen: (kind: 'track' | 'release', id: string, title: string) => void
}>

export function DuplicateTrackReviewDialog({
  ids,
  onClose,
  onOpen,
  onChanged,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [merging, setMerging] = useState(false)
  const mergingRef = useRef(false)
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
    if (mergingRef.current) return
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
          disabled={merging}
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
        Compare first, then preview the merge and explicitly confirm it. Nothing
        changes until you confirm. Choices are not saved when you close.
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
          <fieldset
            disabled={merging}
            className="duplicate-track-candidates"
            aria-label="Duplicate candidate records"
          >
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
          </fieldset>
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
          </section>
          {keeperId && duplicates.length > 0 ? (
            <DuplicateTrackMerge
              key={JSON.stringify([keeperId, duplicates])}
              selection={{
                keeperTrackId: keeperId,
                duplicateTrackIds: duplicates,
              }}
              onPreviewRecords={(updated) => {
                const byId = new Map(updated.map((track) => [track.id, track]))
                setRecords(
                  (current) =>
                    current?.map((track) => byId.get(track.id) ?? track) ??
                    null,
                )
              }}
              onBusy={(busy) => {
                mergingRef.current = busy
                setMerging(busy)
              }}
              onMerged={() => {
                mergingRef.current = false
                onChanged?.()
                onClose()
              }}
              onUncertain={() => {
                mergingRef.current = false
                onChanged?.()
                onClose()
              }}
            />
          ) : null}
        </>
      ) : null}
    </dialog>
  )
}
