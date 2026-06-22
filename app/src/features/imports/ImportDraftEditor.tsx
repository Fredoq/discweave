import { Check, Save, X } from 'lucide-react'
import { useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type {
  CatalogDictionaries,
  DictionaryEntry,
  ExternalMetadataReleaseDetailDto,
  ImportIssue,
  ReleaseImportDraft,
} from '../catalog/catalogApi'
import {
  DiscogsReleaseLookupPanel,
  type DiscogsApplyGroups,
} from '../releases/DiscogsReleaseLookupPanel'
import { applyDiscogsReleaseToImportDraft } from './importDiscogsApply'
import {
  draftIsValid,
  effectiveDraftArtistCredits,
  effectiveDraftLabels,
  importArtistCreditName,
  releaseTypeCodeForValue,
  withDraftArtistCredits,
  withDraftLabels,
} from './importHelpers'
import { ImportArtistCreditsEditor } from './ImportArtistCreditsEditor'
import { ImportLabelsEditor } from './ImportLabelsEditor'
import { TrackDraftList } from './TrackDraftList'

export function DraftEditor({
  actionError,
  artists,
  creditRoleOptions,
  dictionaries,
  draft,
  genreOptions,
  releaseTypeOptions,
  validationMessage,
  onChange,
  onSave,
  onConfirm,
  onSkip,
}: {
  actionError: string | null
  artists: ArtistRecord[]
  creditRoleOptions: DictionaryEntry[]
  dictionaries: CatalogDictionaries
  draft: ReleaseImportDraft
  genreOptions: DictionaryEntry[]
  releaseTypeOptions: DictionaryEntry[]
  validationMessage: string
  onChange: (draft: ReleaseImportDraft) => void
  onSave: () => void
  onConfirm: () => void
  onSkip: () => void
}) {
  const [isDiscogsLookupOpen, setDiscogsLookupOpen] = useState(false)
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
  const releaseArtist = artistCredits
    .map((credit) => importArtistCreditName(credit, artists))
    .filter(Boolean)
    .join(', ')
  const uniqueDraftGenres = [...new Set(draft.genres)]
  const effectiveGenreOptions = [
    ...genreOptions,
    ...uniqueDraftGenres
      .filter((genre) => !genreOptions.some((option) => option.code === genre))
      .map((genre, index) => ({
        id: `draft-genre-${genre}`,
        kind: 'genre' as const,
        code: genre,
        name: genre,
        sortOrder: genreOptions.length + index + 1,
        isActive: true,
        isBuiltin: false,
        isProtected: false,
        mediaProfile: null,
      })),
  ]

  function handleApplyDiscogsDraft(
    detail: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
  ) {
    onChange(
      applyDiscogsReleaseToImportDraft({
        artists,
        detail,
        dictionaries,
        draft,
        groups,
      }),
    )
  }

  return (
    <section
      className="panel detail-panel imports-detail"
      aria-label="Import draft editor"
    >
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

        <ReleaseIssuesList issues={draft.issues} />

        <DiscogsReleaseLookupPanel
          current={{
            artists: releaseArtist,
            externalSourceCount: draft.externalSources?.length ?? 0,
            genres: draft.genres.join(', '),
            labels: labels
              .map((label) =>
                [label.name, label.catalogNumber].filter(Boolean).join(' '),
              )
              .join(', '),
            releaseDate: draft.releaseDate ?? '',
            title: draft.title,
            trackCount: draft.tracks.filter((track) => !track.isSkipped).length,
            year: draft.year?.toString() ?? '',
          }}
          dictionaries={dictionaries}
          isOpen={isDiscogsLookupOpen}
          mode="create"
          searchSeed={{
            artist: releaseArtist,
            catalogNumber:
              labels.find((label) => label.catalogNumber?.trim())
                ?.catalogNumber ??
              draft.catalogNumber ??
              '',
            title: draft.title,
            year: draft.year?.toString() ?? '',
          }}
          trackImpactAction="updates imported file rows"
          onApplyDraft={handleApplyDiscogsDraft}
          onOpenChange={setDiscogsLookupOpen}
        />

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
            key={draft.id}
            catalogNumberSeed={labels.length === 0 ? draft.catalogNumber : null}
            labels={labels}
            notOnLabel={draft.notOnLabel}
            onChange={(nextLabels) =>
              onChange(withDraftLabels(draft, nextLabels))
            }
          />
        </section>

        <section className="release-form-section imports-release-section">
          <div className="release-form-section-header">
            <div>
              <h3>Classification</h3>
              <p>Genres and user tags.</p>
            </div>
          </div>
          <div className="imports-classification-grid">
            <div className="imports-genre-grid">
              {effectiveGenreOptions.map((genre) => (
                <label className="settings-check" key={genre.id}>
                  <input
                    aria-label={genre.name}
                    checked={draft.genres.includes(genre.code)}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        genres: event.target.checked
                          ? [...draft.genres, genre.code]
                          : draft.genres.filter((code) => code !== genre.code),
                      })
                    }
                  />
                  <span>{genre.name}</span>
                </label>
              ))}
            </div>
            <label className="settings-control">
              <span>Tags</span>
              <input
                value={draft.tags.join(', ')}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    tags: event.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </div>
        </section>

        <section className="release-form-section imports-track-section">
          <TrackDraftList
            artists={artists}
            creditRoleOptions={creditRoleOptions}
            isVariousArtists={draft.isVariousArtists}
            releaseMainArtistCredits={artistCredits.filter(
              (credit) =>
                credit.role === 'mainArtist' ||
                credit.role.toLowerCase() === 'main artist',
            )}
            tracks={draft.tracks}
            onChange={(tracks) => onChange({ ...draft, tracks })}
          />
        </section>

        <p className={isValid ? 'imports-status' : 'imports-error'}>
          {isValid ? 'Ready to confirm.' : validationMessage}
        </p>
        {actionError ? (
          <p
            aria-label="Import draft action error"
            className="imports-error"
            role="alert"
          >
            {actionError}
          </p>
        ) : null}
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

function ReleaseIssuesList({
  issues,
}: Readonly<{
  issues: ImportIssue[]
}>) {
  if (issues.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="release-import-issues-heading"
      className="release-form-section imports-release-section imports-release-issues-section"
    >
      <div className="release-form-section-header">
        <div>
          <h3 id="release-import-issues-heading">Release issues</h3>
          <p>Review release-level warnings before confirming.</p>
        </div>
      </div>
      <output className="imports-issue-list">
        {issues.map((issue) => (
          <span
            className="imports-issue-item"
            key={`${issue.severity}-${issue.code}-${issue.message}`}
          >
            <strong>{issue.severity}</strong> {issue.message}
          </span>
        ))}
      </output>
    </section>
  )
}
