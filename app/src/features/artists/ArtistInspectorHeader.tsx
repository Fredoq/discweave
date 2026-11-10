import { ArrowLeft } from 'lucide-react'
import type { ArtistRecord } from './artistsData'
import { ArtistInspectorActions } from './ArtistInspectorActions'

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
          <ArtistInspectorActions
            key={artist.id}
            onDelete={onDelete}
            onUpdateViaDiscogs={onUpdateViaDiscogs}
            canUpdateViaDiscogs={canUpdateViaDiscogs}
          />
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
