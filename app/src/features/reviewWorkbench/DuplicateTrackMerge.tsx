import { useEffect, useRef, useState } from 'react'
import type { TrackDto } from '../catalog/api/catalogTypes'
import { TrackMergeMetadata } from './TrackMergeMetadata'
import { validPreviewRecords } from './trackMergePreviewRecords'
import { CatalogApiError } from '../catalog/api/httpClient'
import {
  confirmTrackMerge,
  previewTrackMerge,
  type TrackMergePreview,
  type TrackMergeSelection,
} from './trackMergeApi'

type Props = {
  selection: TrackMergeSelection
  onPreviewRecords: (records: TrackDto[]) => void
  onBusy: (busy: boolean) => void
  onMerged: () => void
  onUncertain: () => void
}

export function DuplicateTrackMerge({
  selection,
  onBusy,
  onPreviewRecords,
  onMerged,
  onUncertain,
}: Readonly<Props>) {
  const [preview, setPreview] = useState<TrackMergePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const alive = useRef(true)
  const pending = useRef(false)
  const uncertainResult = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function loadPreview() {
    if (pending.current || uncertain) return
    pending.current = true
    setBusy(true)
    setPreview(null)
    setConfirmed(false)
    setError(null)
    try {
      const result = await previewTrackMerge(selection)
      if (!alive.current) return
      if (
        !validPreviewRecords(result.records, selection) ||
        typeof result.previewToken !== 'string' ||
        !result.previewToken ||
        typeof result.canMerge !== 'boolean' ||
        !Array.isArray(result.conflicts) ||
        !result.conflicts.every(
          (conflict) =>
            conflict &&
            typeof conflict.code === 'string' &&
            typeof conflict.message === 'string',
        ) ||
        !result.counts ||
        !Object.values(result.counts).every(
          (count) => Number.isInteger(count) && count >= 0,
        ) ||
        result.metadataPolicy !== 'keepKeeper' ||
        result.keeperTrackId !== selection.keeperTrackId ||
        [...result.duplicateTrackIds].sort().join(',') !==
          [...selection.duplicateTrackIds].sort().join(',')
      ) {
        throw new Error('Unexpected preview')
      }
      onPreviewRecords(result.records)
      setPreview(result)
    } catch {
      if (alive.current)
        setError('Merge preview could not be loaded. Try a new preview.')
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }

  async function merge() {
    if (
      pending.current ||
      !confirmed ||
      !preview?.canMerge ||
      preview.conflicts.length ||
      uncertain
    )
      return
    pending.current = true
    setBusy(true)
    onBusy(true)
    setError(null)
    try {
      const result = await confirmTrackMerge(preview)
      if (
        result.keeperTrackId !== preview.keeperTrackId ||
        !Array.isArray(result.mergedTrackIds) ||
        [...result.mergedTrackIds].sort().join(',') !==
          [...preview.duplicateTrackIds].sort().join(',')
      )
        throw new Error('Unverified merge result')
      // Refresh even if navigation unmounted the comparison during the request.
      onMerged()
    } catch (reason) {
      if (!alive.current) {
        onUncertain()
        return
      }
      setPreview(null)
      setConfirmed(false)
      if (
        reason instanceof CatalogApiError &&
        reason.status >= 400 &&
        reason.status < 500
      ) {
        setError(
          reason.code === 'track_merge.preview_stale'
            ? 'The collection changed since this preview. Review a new preview before merging.'
            : `${reason.message} Review a new preview or change your selection.`,
        )
      } else {
        uncertainResult.current = true
        setUncertain(true)
        setError(
          'The merge result could not be verified. It may have completed. Do not retry: close and refresh the collection to check the records first.',
        )
      }
    } finally {
      pending.current = false
      if (alive.current) {
        setBusy(false)
        onBusy(uncertainResult.current)
      }
    }
  }

  return (
    <section
      className="duplicate-track-preview"
      aria-label="Merge preview"
      aria-live="polite"
    >
      <h3>Merge preview</h3>
      <p>
        The keeper retains its title, duration, year and Original recording
        marker. Genres, tags, external sources and credits are combined. Release
        rows, positions and file links are preserved; the selected duplicate
        Track records are deleted.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {uncertain ? (
        <button
          className="button button-secondary"
          type="button"
          onClick={onUncertain}
        >
          Close and refresh collection
        </button>
      ) : (
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={() => void loadPreview()}
        >
          {busy
            ? 'Checking…'
            : preview
              ? 'Refresh merge preview'
              : 'Preview merge'}
        </button>
      )}
      {preview ? (
        <>
          <TrackMergeMetadata
            records={preview.records}
            keeperId={preview.keeperTrackId}
          />
          <ul>
            {Object.entries(preview.counts).map(([name, count]) => (
              <li key={name}>
                {name.replace(/([A-Z])/g, ' $1').toLowerCase()}: {count}
              </li>
            ))}
          </ul>
          {preview.conflicts.length ? (
            <div role="alert">
              <p>
                Merge blocked. Resolve these conflicts or select different
                records:
              </p>
              <ul>
                {preview.conflicts.map((conflict, index) => (
                  <li key={`${conflict.code}-${index}`}>{conflict.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.canMerge && !preview.conflicts.length ? (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(event) =>
                    setConfirmed(event.currentTarget.checked)
                  }
                />{' '}
                I confirm these are the same recording and want to delete the{' '}
                {selection.duplicateTrackIds.length} selected duplicate Track
                records.
              </label>
              <button
                className="button"
                type="button"
                disabled={busy || !confirmed}
                onClick={() => void merge()}
              >
                {busy ? 'Merging…' : 'Merge selected duplicates'}
              </button>
            </>
          ) : (
            <p>
              No changes were made. Merge is unavailable for this selection.
            </p>
          )}
        </>
      ) : null}
    </section>
  )
}
