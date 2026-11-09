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
  return (
    <>
      {originArtist && onSelectArtist ? (
        <nav
          className="artist-inspector-breadcrumb"
          aria-label="Artist context"
        >
          <button
            type="button"
            onClick={() => onSelectArtist(originArtist.id)}
            aria-label={`Return to ${originArtist.name}`}
          >
            ←
          </button>
          <span>From</span>
          <button type="button" onClick={() => onSelectArtist(originArtist.id)}>
            {originArtist.name}
          </button>
          <span aria-hidden="true">›</span>
          <strong>{artist.name}</strong>
        </nav>
      ) : null}
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{artist.type}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="artist-detail-title">{artist.name}</h2>
        {artist.identityHint ? <p>{artist.identityHint}</p> : null}
        {artist.summary ? <p>{artist.summary}</p> : null}
        {onEdit ? (
          <div className="detail-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onEdit}
            >
              Edit record
            </button>
            {onUpdateViaDiscogs ? (
              <span className="discogs-action-state">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!canUpdateViaDiscogs}
                  onClick={onUpdateViaDiscogs}
                >
                  Update via Discogs
                </button>
                {!canUpdateViaDiscogs ? (
                  <span className="discogs-disabled-note">
                    Add a Discogs token in Settings to use Discogs lookup.
                  </span>
                ) : null}
              </span>
            ) : null}
            {onDelete ? (
              <DeleteSessionRecordButton
                confirmationMessage="Delete this artist and remove their credits and relations?"
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}
