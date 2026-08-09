import { useState } from 'react'
import type {
  ExternalDiscogsBindingRebindRequest,
  ExternalMusicBrainzBindingRebindRequest,
  ReleaseImportDraft,
  ReleaseImportMusicBrainzRowDto,
} from '../catalog/catalogApi'

type Props = Readonly<{
  draft: ReleaseImportDraft
  isPending: boolean
  onChangeDraft: (draft: ReleaseImportDraft) => void
  onRebindDiscogs: (
    request: Omit<
      ExternalDiscogsBindingRebindRequest,
      'expectedReviewRevision'
    >,
  ) => void
  onRebindMusicBrainz: (
    request: Omit<
      ExternalMusicBrainzBindingRebindRequest,
      'expectedReviewRevision'
    >,
  ) => void
}>

type BindingForm = {
  recordingMbid: string
  musicBrainzRow: ReleaseImportMusicBrainzRowDto
  discogsRow: {
    releaseId: string
    rowOrdinal: string
    position: string
    fingerprint: string
  }
}

export function SelectedOriginalBindingPanel({
  draft,
  isPending,
  onChangeDraft,
  onRebindDiscogs,
  onRebindMusicBrainz,
}: Props) {
  const binding = draft.selectedOriginalBinding
  const boundTrack = binding
    ? draft.tracks.find((track) => track.id === binding.draftTrackId)
    : null
  const [form, setForm] = useState<BindingForm>(() => formFromBinding(binding))

  if (!binding) {
    return (
      <section className="release-form-section imports-release-section">
        <div className="release-form-section-header">
          <div>
            <h3>Original recording binding</h3>
            <p>No external original binding is selected.</p>
          </div>
        </div>
      </section>
    )
  }

  const boundDraftTrackId = binding.draftTrackId

  const discogsBacked = Boolean(
    binding.releaseRoute.discogsRelease && binding.discogsRow,
  )
  const hasDiscogsRoute =
    form.discogsRow.releaseId.trim() !== '' &&
    form.discogsRow.position.trim() !== '' &&
    form.discogsRow.fingerprint.trim() !== '' &&
    Number.isInteger(Number.parseInt(form.discogsRow.rowOrdinal, 10))

  function updateRow(patch: Partial<ReleaseImportMusicBrainzRowDto>) {
    setForm((current) => ({
      ...current,
      musicBrainzRow: { ...current.musicBrainzRow, ...patch },
    }))
  }

  function updateOriginal(checked: boolean) {
    onChangeDraft({
      ...draft,
      tracks: draft.tracks.map((track) =>
        track.id === boundDraftTrackId
          ? { ...track, isOriginal: checked }
          : track,
      ),
    })
  }

  return (
    <section className="release-form-section imports-release-section">
      <div className="release-form-section-header">
        <div>
          <h3>Original recording binding</h3>
          <p>
            The selected source recording is authoritative. Rebind it only after
            reviewing the MusicBrainz row and optional Discogs route.
          </p>
        </div>
        <span className="badge status-badge status-blue">
          {discogsBacked ? 'Discogs-backed' : 'MusicBrainz-only'}
        </span>
      </div>
      <div className="imports-binding-summary">
        <span>
          <strong>Recording</strong> {binding.recordingSource.externalId}
        </span>
        <span>
          <strong>Draft row</strong> {binding.draftTrackId}
        </span>
        <a
          href={binding.recordingSource.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open source
        </a>
      </div>
      <label className="compact-checkbox">
        <input
          checked={Boolean(boundTrack?.isOriginal)}
          type="checkbox"
          onChange={(event) => updateOriginal(event.currentTarget.checked)}
        />
        <span>Review this bound row as the original version</span>
      </label>
      {!boundTrack?.isOriginal ? (
        <p className="imports-error">
          Required original relation remains blocked until this toggle is
          restored.
        </p>
      ) : null}
      <div className="imports-release-grid">
        <label className="settings-control">
          <span>Recording MBID</span>
          <input
            value={form.recordingMbid}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recordingMbid: event.currentTarget.value,
              }))
            }
          />
        </label>
        <label className="settings-control">
          <span>Release MBID</span>
          <input
            value={form.musicBrainzRow.releaseMbid}
            onChange={(event) =>
              updateRow({ releaseMbid: event.currentTarget.value })
            }
          />
        </label>
        <label className="settings-control">
          <span>Medium position</span>
          <input
            value={form.musicBrainzRow.mediumPosition}
            onChange={(event) =>
              updateRow({ mediumPosition: event.currentTarget.value })
            }
          />
        </label>
        <label className="settings-control">
          <span>Track MBID</span>
          <input
            value={form.musicBrainzRow.trackMbid}
            onChange={(event) =>
              updateRow({ trackMbid: event.currentTarget.value })
            }
          />
        </label>
      </div>
      <div className="imports-binding-route-editor">
        <h4>Discogs route (optional)</h4>
        <div className="imports-release-grid">
          <label className="settings-control">
            <span>Release ID</span>
            <input
              value={form.discogsRow.releaseId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discogsRow: {
                    ...current.discogsRow,
                    releaseId: event.currentTarget.value,
                  },
                }))
              }
            />
          </label>
          <label className="settings-control">
            <span>Row ordinal</span>
            <input
              inputMode="numeric"
              value={form.discogsRow.rowOrdinal}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discogsRow: {
                    ...current.discogsRow,
                    rowOrdinal: event.currentTarget.value,
                  },
                }))
              }
            />
          </label>
          <label className="settings-control">
            <span>Position</span>
            <input
              value={form.discogsRow.position}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discogsRow: {
                    ...current.discogsRow,
                    position: event.currentTarget.value,
                  },
                }))
              }
            />
          </label>
          <label className="settings-control">
            <span>Fingerprint</span>
            <input
              value={form.discogsRow.fingerprint}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discogsRow: {
                    ...current.discogsRow,
                    fingerprint: event.currentTarget.value,
                  },
                }))
              }
            />
          </label>
        </div>
      </div>
      <div className="imports-actions">
        <button
          className="button button-secondary"
          disabled={isPending}
          type="button"
          onClick={() =>
            onRebindMusicBrainz({
              recordingMbid: form.recordingMbid.trim(),
              musicBrainzRow: form.musicBrainzRow,
            })
          }
        >
          Rebind MusicBrainz-only
        </button>
        <button
          className="button button-secondary"
          disabled={isPending || !hasDiscogsRoute}
          type="button"
          onClick={() =>
            onRebindDiscogs({
              recordingMbid: form.recordingMbid.trim(),
              musicBrainzRow: form.musicBrainzRow,
              discogsRoute: {
                releaseId: form.discogsRow.releaseId.trim(),
                rowOrdinal: Number.parseInt(form.discogsRow.rowOrdinal, 10),
                position: form.discogsRow.position.trim(),
                fingerprint: form.discogsRow.fingerprint.trim(),
              },
            })
          }
        >
          Rebind Discogs-backed
        </button>
      </div>
    </section>
  )
}

function formFromBinding(
  binding: ReleaseImportDraft['selectedOriginalBinding'],
): BindingForm {
  return {
    recordingMbid: binding?.recordingSource.externalId ?? '',
    musicBrainzRow: binding?.musicBrainzRow ?? {
      releaseMbid: '',
      mediumPosition: '',
      trackMbid: '',
    },
    discogsRow: {
      releaseId:
        binding?.discogsRow?.releaseId ??
        binding?.releaseRoute.discogsRelease?.externalId ??
        '',
      rowOrdinal: binding?.discogsRow?.rowOrdinal?.toString() ?? '',
      position: binding?.discogsRow?.position ?? '',
      fingerprint: binding?.discogsRow?.fingerprint ?? '',
    },
  }
}
