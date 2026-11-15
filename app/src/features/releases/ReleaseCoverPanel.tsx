import { Search } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  releaseArtworkPath,
  selectReleaseExternalCover,
} from '../catalog/api/releaseCoverSearchClient'
import { ExternalCoverSearchPanel } from './ExternalCoverSearchPanel'
import { ReleaseCoverAttribution } from './ReleaseCoverAttribution'
import type { ReleaseCoverImage, ReleaseRecord } from './releasesData'
export type ReleaseCoverPanelProps = {
  release: Pick<ReleaseRecord, 'coverImage' | 'id' | 'title'> &
    Partial<Pick<ReleaseRecord, 'artist' | 'labels'>>
  onRemoveCover?: (releaseId: string) => Promise<void> | void
  onUploadCover?: (releaseId: string, file: File) => Promise<void> | void
  onCoverSaved?: (releaseId: string, cover: ReleaseCoverImage) => void
}
export function ReleaseCoverPanel(props: Readonly<ReleaseCoverPanelProps>) {
  return <ReleaseCoverSession key={props.release.id} {...props} />
}
function ReleaseCoverSession({
  release,
  onRemoveCover,
  onUploadCover,
  onCoverSaved,
}: Readonly<ReleaseCoverPanelProps>) {
  const [coverError, setCoverError] = useState('')
  const [pending, setPending] = useState<'local' | 'external' | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [saved, setSaved] = useState<{
    cover: ReleaseCoverImage
    previousUrl: string | undefined
  } | null>(null)
  const active = useRef(false)
  const busy = useRef(false)
  const coverImage =
    saved && saved.previousUrl === release.coverImage?.url
      ? saved.cover
      : release.coverImage
  const inputLabel = coverImage ? 'Replace cover' : 'Upload cover'
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  async function mutate(
    kind: 'local' | 'external',
    operation: () => Promise<void>,
  ) {
    if (busy.current) return
    busy.current = true
    setPending(kind)
    setCoverError('')
    try {
      await operation()
    } catch (error_) {
      if (active.current)
        setCoverError(
          error_ instanceof Error ? error_.message : 'Cover update failed.',
        )
    } finally {
      busy.current = false
      if (active.current) setPending(null)
    }
  }
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !onUploadCover) return
    await mutate('local', async () => {
      await onUploadCover(release.id, file)
      if (active.current) setSaved(null)
    })
  }
  async function handleRemoveClick() {
    if (
      busy.current ||
      !onRemoveCover ||
      !window.confirm('Remove this cover image?')
    )
      return
    await mutate('local', async () => {
      await onRemoveCover(release.id)
      if (active.current) setSaved(null)
    })
  }
  async function applyExternal(externalReleaseId: string, imageId: string) {
    await mutate('external', async () => {
      const cover = await selectReleaseExternalCover(
        release.id,
        externalReleaseId,
        imageId,
      )
      onCoverSaved?.(release.id, cover)
      if (!active.current) return
      setSaved({ cover, previousUrl: release.coverImage?.url })
      setSearchOpen(false)
    })
  }
  return (
    <section className="release-cover-panel" aria-label="Release cover">
      <div className="release-cover-frame">
        {coverImage ? (
          <img
            alt={`${release.title} cover`}
            className="release-cover-image"
            src={coverImage.url}
          />
        ) : (
          <div className="release-cover-placeholder">
            <span>No cover image recorded</span>
          </div>
        )}
      </div>
      {coverImage?.sourceType === 'coverArtArchive' ? (
        <ReleaseCoverAttribution
          releaseId={release.id}
          coverUrl={coverImage.url}
        />
      ) : null}
      <div className="release-cover-actions">
        <label className="button button-secondary release-cover-input">
          {inputLabel}
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-label={inputLabel}
            className="visually-hidden"
            disabled={Boolean(pending) || !onUploadCover}
            type="file"
            onChange={(event) => {
              void handleFileChange(event)
            }}
          />
        </label>
        <button
          type="button"
          className="button button-secondary"
          disabled={Boolean(pending)}
          onClick={() => {
            setCoverError('')
            setSearchOpen(true)
          }}
        >
          <Search size={14} aria-hidden="true" />
          Find cover
        </button>
        {coverImage ? (
          <button
            className="button button-secondary"
            disabled={Boolean(pending) || !onRemoveCover}
            type="button"
            onClick={() => {
              void handleRemoveClick()
            }}
          >
            Remove cover
          </button>
        ) : null}
      </div>
      {searchOpen ? (
        <ExternalCoverSearchPanel
          basePath={releaseArtworkPath(release.id)}
          seed={{
            artist: release.artist ?? '',
            title: release.title,
            catalogNumber: release.labels?.find((label) => label.catalogNumber)
              ?.catalogNumber,
          }}
          disabled={Boolean(pending)}
          onSelect={applyExternal}
          onClose={() => {
            setSearchOpen(false)
            setCoverError('')
          }}
        />
      ) : null}
      {pending ? (
        <output className="imports-cover-hint">
          {pending === 'external' ? 'Applying cover...' : 'Updating cover...'}
        </output>
      ) : null}
      {coverError ? <p role="alert">{coverError}</p> : null}
    </section>
  )
}
