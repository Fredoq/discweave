import { useEffect, useRef, useState } from 'react'
import {
  externalCoverPreviewUrl,
  loadEditionCovers,
  searchCoverEditions,
  type CoverEdition,
  type CoverSearchQuery,
  type ExternalCoverCandidate,
} from '../catalog/api/importCoverSearchClient'
type Props = {
  sessionId: string
  draftId: string
  seed?: CoverSearchQuery
  disabled: boolean
  onSelect: (releaseId: string, imageId: string) => Promise<void>
  onClose: () => void
}
export function ImportCoverSearch({
  sessionId,
  draftId,
  seed,
  disabled,
  onSelect,
  onClose,
}: Readonly<Props>) {
  const [query, setQuery] = useState<CoverSearchQuery>(
    seed ?? { artist: '', title: '' },
  )
  const [editions, setEditions] = useState<CoverEdition[] | null>(null)
  const [edition, setEdition] = useState<CoverEdition | null>(null)
  const [images, setImages] = useState<ExternalCoverCandidate[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function browse(selected?: CoverEdition) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    setEdition(selected ?? null)
    setImages(null)
    if (!selected) setEditions(null)
    try {
      if (selected) {
        const result = await loadEditionCovers(
          sessionId,
          draftId,
          selected.releaseId,
          controller.signal,
        )
        if (!controller.signal.aborted) setImages(result.items)
      } else {
        const result = await searchCoverEditions(
          sessionId,
          draftId,
          query,
          controller.signal,
        )
        if (!controller.signal.aborted) setEditions(result.items)
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Cover search failed. Try again.',
        )
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  return (
    <section
      className="imports-cover-search"
      aria-label="Find cover"
      aria-busy={busy || disabled}
    >
      <h4>Find cover</h4>
      <p className="imports-cover-hint">
        Search MusicBrainz, choose the exact edition, then choose a front image
        from Cover Art Archive. Only these search fields are sent, not local
        paths. Nothing changes until you use a cover.
      </p>
      <div className="imports-cover-search-fields">
        {(['artist', 'title', 'catalogNumber', 'barcode'] as const).map(
          (field) => (
            <label key={field}>
              {
                {
                  artist: 'Artist',
                  title: 'Release title',
                  catalogNumber: 'Catalog number',
                  barcode: 'Barcode',
                }[field]
              }
              <input
                value={query[field] ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  setQuery({ ...query, [field]: event.currentTarget.value })
                }
              />
            </label>
          ),
        )}
      </div>
      <div className="imports-cover-actions">
        <button
          type="button"
          className="button button-secondary button-compact"
          disabled={
            busy ||
            disabled ||
            !Object.values(query).some((value) => value?.trim())
          }
          onClick={() => {
            void browse()
          }}
        >
          Search editions
        </button>
        <button
          type="button"
          className="button button-secondary button-compact"
          disabled={disabled}
          onClick={onClose}
        >
          Cancel search
        </button>
      </div>
      {busy ? <p role="status">Searching cover sources...</p> : null}
      {error ? (
        <p role="alert">
          {error} Search again or choose the edition again to retry.
        </p>
      ) : null}
      {editions?.length === 0 ? (
        <p>No matching editions. Try another title or catalog number.</p>
      ) : null}
      {editions?.map((item) => (
        <div className="imports-cover-edition" key={item.releaseId}>
          <strong>{item.title}</strong>
          <p>{item.artists.join(', ')}</p>
          <p className="imports-cover-hint">
            {[
              item.date,
              item.country,
              ...item.formats,
              ...item.labels,
              ...item.catalogNumbers,
              item.barcode,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            View edition on MusicBrainz
          </a>{' '}
          <button
            type="button"
            className="button button-secondary button-compact"
            disabled={disabled || busy}
            aria-pressed={edition?.releaseId === item.releaseId}
            onClick={() => {
              void browse(item)
            }}
          >
            Show covers for {item.title}
          </button>
        </div>
      ))}
      {edition && images ? (
        <div aria-label="Edition front covers">
          <h4>Front covers for {edition.title}</h4>
          {images.length === 0 ? (
            <p>
              No front cover for this exact edition. Choose another edition
              yourself or upload an image.
            </p>
          ) : null}
          {images.map((image) => (
            <div className="imports-cover-external-image" key={image.imageId}>
              <img
                loading="lazy"
                src={externalCoverPreviewUrl(
                  sessionId,
                  draftId,
                  edition.releaseId,
                  image.imageId,
                )}
                alt={`Front cover for ${edition.title}`}
              />
              <p>{image.comment || image.types.join(', ')}</p>
              <p className="imports-cover-hint">
                {image.approved
                  ? 'Editorially approved'
                  : 'Not editorially approved'}{' '}
                · Approval is not a copyright license.
              </p>
              <a href={image.sourceUrl} target="_blank" rel="noreferrer">
                View image source
              </a>{' '}
              <button
                type="button"
                className="button button-secondary button-compact"
                disabled={disabled}
                onClick={() => {
                  void onSelect(edition.releaseId, image.imageId)
                }}
              >
                Use this cover
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <p className="imports-cover-hint">
        Image copyright remains with the rights holders. Check your right to use
        the image. DiscWeave saves its own copy of the cover you choose.
      </p>
    </section>
  )
}
