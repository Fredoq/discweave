import { Search, Upload } from 'lucide-react'
import { useState } from 'react'
import type { ImportCoverImage } from '../catalog/api/importCoverClient'
import type { CoverSearchQuery } from '../catalog/api/importCoverSearchClient'
import {
  useImportCoverArtwork,
  type ImportCoverCallbacks,
} from './useImportCoverArtwork'
import { ImportCoverSearch } from './ImportCoverSearch'
import './import-cover-picker.css'
type Props = ImportCoverCallbacks & {
  sessionId: string
  draftId: string
  disabled: boolean
  searchSeed?: CoverSearchQuery
}
export function ImportCoverPicker(props: Readonly<Props>) {
  return (
    <CoverPickerSession
      key={`${props.sessionId}:${props.draftId}`}
      {...props}
    />
  )
}
function CoverPickerSession({
  sessionId,
  draftId,
  disabled,
  searchSeed,
  ...callbacks
}: Readonly<Props>) {
  const {
    artwork,
    error,
    isLoading,
    isSaving,
    status,
    retry,
    select,
    upload,
    selectExternal,
  } = useImportCoverArtwork(sessionId, draftId, callbacks)
  const [searchOpen, setSearchOpen] = useState(false)
  const locked = disabled || isLoading || isSaving || !artwork?.canEdit
  const selected = artwork?.selected
  return (
    <section
      className="release-form-section imports-cover-section"
      aria-label="Import cover artwork"
      aria-busy={isLoading || isSaving}
    >
      <div className="release-form-section-header">
        <div>
          <h3>Cover</h3>
          <p>
            Changes save immediately to this draft. DiscWeave keeps its own
            image copy.
          </p>
        </div>
      </div>
      {isLoading ? <output>Loading cover images...</output> : null}
      {artwork ? (
        <>
          <div className="imports-selected-cover">
            {selected ? (
              <>
                <CoverPreview
                  key={selected.url}
                  image={selected}
                  alt="Selected cover"
                />
                <div>
                  <strong>{selected.fileName}</strong>
                  <p>Selected cover · {fileSize(selected.sizeBytes)}</p>
                </div>
              </>
            ) : (
              <p>No cover selected.</p>
            )}
          </div>
          <div className="imports-cover-actions">
            <button
              className="button button-secondary button-compact"
              type="button"
              disabled={locked}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={14} aria-hidden="true" />
              Find cover
            </button>
            <button
              className="button button-secondary button-compact"
              type="button"
              disabled={locked}
              onClick={() => {
                void select(null)
              }}
            >
              No cover
            </button>
            <label
              className={`button button-secondary button-compact imports-cover-upload${locked ? ' is-disabled' : ''}`}
            >
              <Upload size={14} aria-hidden="true" />
              <span>Upload image</span>
              <input
                aria-label="Upload cover image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={locked}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void upload(file)
                }}
              />
            </label>
            <span className="imports-cover-hint">
              JPEG, PNG or WebP · up to 10 MiB
            </span>
          </div>
          {artwork.candidates.length > 0 ? (
            <fieldset className="imports-cover-candidates">
              <legend className="visually-hidden">
                Available cover images
              </legend>
              {artwork.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="imports-cover-candidate"
                  disabled={locked || selected?.id === candidate.id}
                  aria-pressed={selected?.id === candidate.id}
                  aria-label={`Use ${candidate.fileName} as cover`}
                  onClick={() => {
                    void select(candidate.id)
                  }}
                >
                  <CoverPreview image={candidate} alt="" />
                  <span className="imports-cover-filename">
                    {candidate.fileName}
                  </span>
                  <small>
                    {fileSize(candidate.sizeBytes)}
                    {selected?.id === candidate.id ? ' · Selected' : ''}
                  </small>
                </button>
              ))}
            </fieldset>
          ) : (
            <p className="imports-cover-hint">
              No stored candidates. Upload an image, or run a full folder scan
              in the desktop app. Names-only scans do not read images.
            </p>
          )}
          {(artwork.warnings ?? []).map((warning) => (
            <p className="imports-cover-hint" key={warning}>
              {warning}
            </p>
          ))}
        </>
      ) : null}
      {searchOpen ? (
        <ImportCoverSearch
          sessionId={sessionId}
          draftId={draftId}
          seed={searchSeed}
          disabled={locked}
          onSelect={selectExternal}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
      <CoverSaveStatus isSaving={isSaving} status={status} />
      {error ? (
        <div role="alert" className="imports-error">
          <p>{error}</p>
          {!artwork ? (
            <button
              className="button button-secondary button-compact"
              type="button"
              disabled={isLoading}
              onClick={retry}
            >
              Retry cover images
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
function CoverPreview({
  image,
  alt,
}: Readonly<{ image: ImportCoverImage; alt: string }>) {
  const [dimensions, setDimensions] = useState('')
  const [failed, setFailed] = useState(false)
  return (
    <span className="imports-cover-preview">
      {failed ? (
        <span className="imports-cover-preview-error">Preview unavailable</span>
      ) : (
        <img
          src={image.url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth && naturalHeight)
              setDimensions(`${naturalWidth} × ${naturalHeight}`)
          }}
        />
      )}
      {dimensions ? <small>{dimensions}</small> : null}
    </span>
  )
}
function fileSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MiB`
    : `${Math.max(1, Math.round(size / 1024))} KiB`
}

function CoverSaveStatus({
  isSaving,
  status,
}: Readonly<{ isSaving: boolean; status: string }>) {
  if (isSaving) return <output>Saving cover...</output>
  if (status) return <output>{status}</output>
  return null
}
