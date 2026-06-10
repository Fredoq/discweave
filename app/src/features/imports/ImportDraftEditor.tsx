import { Check, Save, X } from 'lucide-react'
import type { ArtistRecord } from '../artists/artistsData'
import type { DictionaryEntry, ReleaseImportDraft } from '../catalog/catalogApi'
import {
  draftIsValid,
  effectiveDraftArtistCredits,
  effectiveDraftLabels,
  releaseTypeCodeForValue,
  withDraftArtistCredits,
  withDraftLabels,
} from './importHelpers'
import { ImportArtistCreditsEditor } from './ImportArtistCreditsEditor'
import { ImportLabelsEditor } from './ImportLabelsEditor'
import { TrackDraftList } from './TrackDraftList'

export function DraftEditor({
  artists,
  creditRoleOptions,
  draft,
  releaseTypeOptions,
  validationMessage,
  onChange,
  onSave,
  onConfirm,
  onSkip,
}: {
  artists: ArtistRecord[]
  creditRoleOptions: DictionaryEntry[]
  draft: ReleaseImportDraft
  releaseTypeOptions: DictionaryEntry[]
  validationMessage: string
  onChange: (draft: ReleaseImportDraft) => void
  onSave: () => void
  onConfirm: () => void
  onSkip: () => void
}) {
  const isValid = draftIsValid(draft)
  const releaseTypeValue = releaseTypeCodeForValue(
    draft.type,
    releaseTypeOptions,
  )
  const hasReleaseTypeOption = releaseTypeOptions.some(
    (option) => option.code === releaseTypeValue,
  )
  const artistCredits = effectiveDraftArtistCredits(draft)
  const labels = effectiveDraftLabels(draft)

  return (
    <section className="panel detail-panel imports-detail">
      <div className="detail-header">
        <h2>{draft.title}</h2>
        <p>{draft.relativePath}</p>
      </div>
      <div className="imports-editor">
        <section className="release-form-section release-core-section imports-release-section">
          <div className="release-form-section-header">
            <div>
              <h3>Release metadata</h3>
              <p>Review parsed release fields before confirming.</p>
            </div>
          </div>
          <div className="imports-release-grid">
            <label className="settings-control imports-release-full-field">
              <span>Title</span>
              <input
                value={draft.title}
                onChange={(event) =>
                  onChange({ ...draft, title: event.target.value })
                }
              />
            </label>
            <label className="settings-control">
              <span>Release date</span>
              <input
                value={draft.releaseDate ?? ''}
                onChange={(event) =>
                  onChange({ ...draft, releaseDate: event.target.value })
                }
              />
            </label>
            <label className="settings-control">
              <span>Year</span>
              <input
                value={draft.year ?? ''}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    year: Number.parseInt(event.target.value, 10) || null,
                  })
                }
              />
            </label>
            <label className="settings-control">
              <span>Type</span>
              <select
                value={hasReleaseTypeOption ? releaseTypeValue : draft.type}
                onChange={(event) =>
                  onChange({ ...draft, type: event.target.value })
                }
              >
                {hasReleaseTypeOption ? null : (
                  <option value={draft.type}>{draft.type}</option>
                )}
                {releaseTypeOptions.map((releaseType) => (
                  <option key={releaseType.id} value={releaseType.code}>
                    {releaseType.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-control">
              <span>Cover candidate</span>
              <input readOnly value={draft.coverPath ?? ''} />
            </label>
          </div>
        </section>

        <section className="release-form-section imports-release-section">
          <div className="release-form-section-header">
            <div>
              <h3>Artists</h3>
              <p>Release credits.</p>
            </div>
            <div className="release-section-actions">
              <label className="compact-checkbox">
                <input
                  checked={draft.isVariousArtists}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      isVariousArtists: event.target.checked,
                    })
                  }
                />
                <span>Various Artists</span>
              </label>
            </div>
          </div>
          <ImportArtistCreditsEditor
            artists={artists}
            credits={artistCredits}
            creditRoleOptions={creditRoleOptions}
            isVariousArtists={draft.isVariousArtists}
            onChange={(credits) =>
              onChange(withDraftArtistCredits(draft, credits))
            }
          />
        </section>

        <section className="release-form-section imports-release-section">
          <div className="release-form-section-header">
            <div>
              <h3>Labels</h3>
              <p>Release label credits and catalog numbers.</p>
            </div>
            <div className="release-section-actions">
              <label className="compact-checkbox">
                <input
                  checked={draft.notOnLabel}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({ ...draft, notOnLabel: event.target.checked })
                  }
                />
                <span>Not On Label</span>
              </label>
            </div>
          </div>
          <ImportLabelsEditor
            labels={labels}
            notOnLabel={draft.notOnLabel}
            onChange={(nextLabels) =>
              onChange(withDraftLabels(draft, nextLabels))
            }
          />
        </section>

        <section className="release-form-section imports-track-section">
          <TrackDraftList
            artists={artists}
            creditRoleOptions={creditRoleOptions}
            tracks={draft.tracks}
            onChange={(tracks) => onChange({ ...draft, tracks })}
          />
        </section>

        <p className={isValid ? 'imports-status' : 'imports-error'}>
          {isValid ? 'Ready to confirm.' : validationMessage}
        </p>
        <div className="imports-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onSave}
          >
            <Save size={16} /> Save
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={onSkip}
          >
            <X size={16} /> Skip
          </button>
          <button
            className="button button-primary"
            disabled={!isValid || draft.status === 'confirmed'}
            type="button"
            onClick={onConfirm}
          >
            <Check size={16} /> Confirm
          </button>
        </div>
      </div>
    </section>
  )
}
