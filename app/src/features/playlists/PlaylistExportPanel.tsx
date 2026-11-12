import { useEffect, useRef, useState } from 'react'
import type { TrackRecord } from '../tracks/tracksData'
import type { PlaylistRecord } from './playlistsData'
import { createPlaylistExportRows } from './playlistExportModel'
import type {
  PlaylistExportEntry,
  PlaylistExportInspection,
} from './playlistExportTypes'

type Props = {
  playlist: PlaylistRecord
  tracks: TrackRecord[]
  onClose: () => void
}
export function PlaylistExportPanel({
  playlist,
  tracks,
  onClose,
}: Readonly<Props>) {
  const [rows] = useState(() => createPlaylistExportRows(playlist, tracks))
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map((row) => [row.key, row.files.length === 1 ? '0' : '']),
    ),
  )
  const [inspection, setInspection] = useState<PlaylistExportInspection | null>(
    null,
  )
  const [allowPartial, setAllowPartial] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const alive = useRef(true)
  const running = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const bridge = window.discweaveDesktop?.playlists
  const needsChoice = rows.some(
    (row) => row.files.length > 1 && choices[row.key] === '',
  )
  const omitted = inspection ? rows.length - inspection.availableCount : 0
  function entries(): PlaylistExportEntry[] {
    return rows.map((row) => {
      const file =
        choices[row.key] === ''
          ? undefined
          : row.files[Number(choices[row.key])]
      return {
        key: row.key,
        trackId: row.trackId,
        title: row.title,
        artist: row.artist,
        duration: file?.duration || row.duration,
        file: file
          ? {
              path: file.path,
              localAudioFileId: file.localAudioFileId,
              digitalTrackFileLinkId: file.digitalTrackFileLinkId,
            }
          : undefined,
      }
    })
  }
  async function inspect() {
    if (!bridge || running.current || needsChoice) return
    running.current = true
    setPending(true)
    setError('')
    setMessage('')
    setAllowPartial(false)
    try {
      const result = await bridge.inspect({ entries: entries() })
      if (alive.current) setInspection(result)
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not check local files.',
        )
    } finally {
      running.current = false
      if (alive.current) setPending(false)
    }
  }
  async function save() {
    if (
      !bridge ||
      !inspection ||
      running.current ||
      !inspection.availableCount ||
      (omitted > 0 && !allowPartial)
    )
      return
    running.current = true
    setPending(true)
    setError('')
    setMessage('')
    try {
      const result = await bridge.export({
        name: playlist.name,
        entries: entries(),
        allowPartial,
        inspectionId: inspection.inspectionId,
      })
      if (!alive.current) return
      if (result.cancelled) {
        setMessage('Export cancelled. No playlist file was saved.')
      } else if (result.blocked) {
        setInspection(
          result.inspectionId &&
            result.entries &&
            result.availableCount !== undefined
            ? {
                inspectionId: result.inspectionId,
                entries: result.entries,
                availableCount: result.availableCount,
              }
            : null,
        )
        setAllowPartial(false)
        setMessage(
          'File availability changed. Review the updated results before exporting again.',
        )
      } else
        setMessage(
          `Saved ${result.exportedCount ?? 0} tracks${result.omittedCount ? `; ${result.omittedCount} unavailable tracks omitted` : ''} to ${result.path}. Open the M3U8 file in your external player.`,
        )
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not save the playlist file.',
        )
    } finally {
      running.current = false
      if (alive.current) setPending(false)
    }
  }
  return (
    <section
      className="playlist-export"
      aria-label="Export playlist for external player"
    >
      <div className="playlist-heading">
        <div>
          <span className="entity-type">External player</span>
          <h2>Export {playlist.name}</h2>
        </div>
        <button
          className="button button-secondary"
          disabled={pending}
          onClick={onClose}
        >
          Close export
        </button>
      </div>
      <p>
        Save an M3U8 file that points to audio on this Mac. Your collection and
        audio files stay unchanged. No player opens automatically.
      </p>
      <p>
        Paths are local to this Mac. Re-export after moving files. Your player
        must support their audio formats.
      </p>
      {!bridge && (
        <p role="alert">
          Local file checking and M3U8 export require the desktop app.
        </p>
      )}
      <fieldset disabled={pending} className="playlist-export-fields">
        <ol className="playlist-track-list">
          {rows.map((row, index) => {
            const status = inspection?.entries.find(
              (entry) => entry.key === row.key,
            )
            const file =
              choices[row.key] === ''
                ? undefined
                : row.files[Number(choices[row.key])]
            return (
              <li className="playlist-track" key={row.key}>
                <span>{index + 1}</span>
                <div>
                  <strong>{row.title}</strong>
                  <span>{row.artist}</span>
                  {row.files.length > 1 ? (
                    <label className="playlist-field">
                      Audio file for track {index + 1}
                      <select
                        value={choices[row.key]}
                        onChange={(event) => {
                          setChoices((current) => ({
                            ...current,
                            [row.key]: event.target.value,
                          }))
                          setInspection(null)
                          setAllowPartial(false)
                          setMessage('')
                        }}
                      >
                        <option value="">
                          Choose a file ({row.files.length} available links)
                        </option>
                        {row.files.map((candidate, fileIndex) => (
                          <option key={fileIndex} value={String(fileIndex)}>
                            {candidate.format || 'Audio'} ·{' '}
                            {candidate.releaseTitle} · {candidate.path}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : file ? (
                    <span className="playlist-file-path">
                      {file.format || 'Audio'} · {file.releaseTitle} ·{' '}
                      {file.path}
                    </span>
                  ) : (
                    <span>No linked local audio file</span>
                  )}
                  {status && (
                    <small
                      className={
                        status.status === 'available'
                          ? 'playlist-file-available'
                          : 'playlist-file-unavailable'
                      }
                    >
                      {status.status === 'available'
                        ? 'Available on this Mac'
                        : status.message ||
                          'Unavailable; this track cannot be exported'}
                    </small>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        {!rows.length && <p>No tracks to export.</p>}
        {needsChoice && (
          <p>
            Choose which audio file to use for every track with multiple links.
            No quality or release is selected automatically.
          </p>
        )}
        {inspection && (
          <p role="status">
            {inspection.availableCount} of {rows.length} tracks available
            {omitted ? `; ${omitted} unavailable` : ''}.
          </p>
        )}
        {inspection && omitted > 0 && inspection.availableCount > 0 && (
          <label className="playlist-export-partial">
            <input
              type="checkbox"
              checked={allowPartial}
              onChange={(event) => setAllowPartial(event.target.checked)}
            />{' '}
            Export available tracks only; omit {omitted} unavailable tracks
          </label>
        )}
        {inspection && !inspection.availableCount && (
          <p>No playable files were found. Nothing will be exported.</p>
        )}
        <div className="playlist-actions">
          <button
            className="button button-secondary"
            disabled={!bridge || !rows.length || needsChoice}
            onClick={() => void inspect()}
          >
            {pending
              ? 'Working…'
              : inspection
                ? 'Check files again'
                : 'Check local files'}
          </button>
          <button
            className="button button-primary"
            disabled={
              !bridge ||
              !inspection?.availableCount ||
              (omitted > 0 && !allowPartial)
            }
            onClick={() => void save()}
          >
            Save M3U8
          </button>
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
