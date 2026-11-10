import { useEffect, useRef } from 'react'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import type { ArtistRecord } from './artistsData'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'

type ArtistInspectorHeaderProps = Readonly<{
  artist: ArtistRecord
  originArtist?: ArtistRecord
  onSelectArtist?: (id: string) => void
  onEdit?: () => void
  onDelete?: () => void
  onUpdateViaDiscogs?: () => void
  canUpdateViaDiscogs: boolean
}>

export function ArtistInspectorHeader({
  artist,
  originArtist,
  onSelectArtist,
  onEdit,
  onDelete,
  onUpdateViaDiscogs,
  canUpdateViaDiscogs,
}: ArtistInspectorHeaderProps) {
  const actionsRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) {
        actionsRef.current?.removeAttribute('open')
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])
  const discogs = artist.externalSources?.find(
    (source) => source.providerName.toLowerCase() === 'discogs',
  )
  return (
    <div className="artist-inspector-header">
      <div className="artist-inspector-title-row">
        {originArtist && onSelectArtist ? (
          <button
            type="button"
            className="artist-inspector-icon-button"
            onClick={() => onSelectArtist(originArtist.id)}
            aria-label={`Return to ${originArtist.name}`}
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
        ) : null}
        <h2 id="artist-detail-title" tabIndex={-1}>
          {artist.name}
        </h2>
        <span className="badge badge-tag">{artist.type}</span>
        {onEdit ? (
          <button
            className="button button-secondary artist-inspector-edit"
            type="button"
            onClick={onEdit}
            aria-label="Edit record"
          >
            Edit
          </button>
        ) : null}
        {onUpdateViaDiscogs || onDelete ? (
          <details
            className="artist-inspector-actions"
            ref={actionsRef}
            key={artist.id}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                actionsRef.current?.removeAttribute('open')
                actionsRef.current?.querySelector('summary')?.focus()
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                event.currentTarget.removeAttribute('open')
              }
            }}
          >
            <summary
              tabIndex={0}
              aria-label="More artist actions"
              title="More artist actions"
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </summary>
            <div className="artist-inspector-action-list">
              {onUpdateViaDiscogs ? (
                <>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={!canUpdateViaDiscogs}
                    aria-describedby={
                      !canUpdateViaDiscogs
                        ? 'artist-discogs-disabled'
                        : undefined
                    }
                    onClick={() => {
                      actionsRef.current?.removeAttribute('open')
                      onUpdateViaDiscogs()
                    }}
                  >
                    Update via Discogs
                  </button>
                  {!canUpdateViaDiscogs ? (
                    <span
                      className="discogs-disabled-note"
                      id="artist-discogs-disabled"
                    >
                      Add a Discogs token in Settings to use Discogs lookup.
                    </span>
                  ) : null}
                </>
              ) : null}
              {onDelete ? (
                <DeleteSessionRecordButton
                  confirmationMessage="Delete this artist and remove their credits and relations?"
                  onDelete={() => {
                    actionsRef.current?.removeAttribute('open')
                    onDelete()
                  }}
                />
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
      {originArtist && onSelectArtist ? (
        <nav
          className="artist-inspector-breadcrumb"
          aria-label="Artist context"
        >
          <span>From</span>
          <button type="button" onClick={() => onSelectArtist(originArtist.id)}>
            {originArtist.name}
          </button>
        </nav>
      ) : null}
      {discogs ? (
        <p className="artist-inspector-source">Discogs #{discogs.externalId}</p>
      ) : null}
    </div>
  )
}
