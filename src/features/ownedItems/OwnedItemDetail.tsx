import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import {
  playlistTouchesRelease,
  relationTouchesLink,
} from '../catalog/catalogGraph'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import type { OwnedItemRecord } from './ownedItemsData'

function releaseHref(releaseId: string) {
  return `/releases?release=${encodeURIComponent(releaseId)}`
}

type OwnedItemDetailProps = {
  item: OwnedItemRecord
  onDelete?: () => void
  onEdit?: () => void
  playlists: PlaylistRecord[]
  relations: RelationRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
}

export function OwnedItemDetail({
  item,
  onDelete,
  onEdit,
  playlists,
  relations,
  releases,
  tracks,
}: OwnedItemDetailProps) {
  const linkedReleaseExists =
    item.releaseId && releases.some((release) => release.id === item.releaseId)
  const linkedRelease = releases.find(
    (release) => release.id === item.releaseId,
  )
  const relatedTracks = tracks.filter(
    (track) =>
      (item.releaseId && track.release.id === item.releaseId) ||
      track.release.title.toLowerCase() === item.releaseTitle.toLowerCase(),
  )
  const itemLink = { kind: 'ownedItem', id: item.id } as const
  const relatedRelations = relations.filter(
    (relation) =>
      relationTouchesLink(relation, itemLink) ||
      relation.source.toLowerCase() === item.title.toLowerCase() ||
      relation.target.toLowerCase() === item.title.toLowerCase() ||
      relation.linkedEntity.toLowerCase() === item.title.toLowerCase(),
  )
  const relatedPlaylists = linkedRelease
    ? playlists.filter((playlist) =>
        playlistTouchesRelease(playlist, linkedRelease),
      )
    : []

  return (
    <aside className="panel detail-panel" aria-labelledby="owned-item-title">
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{item.medium}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="owned-item-title">{item.title}</h2>
        <p>{item.artist}</p>
        {onEdit ? (
          <div className="detail-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onEdit}
            >
              Edit record
            </button>
            {onDelete ? (
              <DeleteSessionRecordButton
                confirmationMessage="Delete this owned item? This cannot be undone."
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <StatusBadge item={item}>{item.status}</StatusBadge>
      {item.copyNotes ? (
        <p className="detail-summary">{item.copyNotes}</p>
      ) : null}

      <section className="detail-section" aria-labelledby="owned-linked-title">
        <h3 id="owned-linked-title">Linked catalog item</h3>
        <dl className="detail-list">
          <div>
            <dt>{item.linkedType}</dt>
            <dd>
              {linkedReleaseExists && item.releaseId ? (
                <a className="detail-link" href={releaseHref(item.releaseId)}>
                  {item.releaseTitle}
                </a>
              ) : (
                item.releaseTitle
              )}
            </dd>
          </div>
          <div>
            <dt>Artist</dt>
            <dd>{item.artist}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="owned-state-title">
        <h3 id="owned-state-title">Ownership state</h3>
        <dl className="detail-list">
          <div>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </div>
          <div>
            <dt>Acquisition</dt>
            <dd>{item.acquisition}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>
              <BadgeList values={item.tags} />
            </dd>
          </div>
        </dl>
      </section>

      <section
        className="detail-section"
        aria-labelledby="owned-physical-title"
      >
        <h3 id="owned-physical-title">Physical details</h3>
        <dl className="detail-list">
          <div>
            <dt>Medium</dt>
            <dd>{item.medium}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{item.storage}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{item.condition}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="owned-digital-title">
        <h3 id="owned-digital-title">Digital and digitization metadata</h3>
        <dl className="detail-list">
          <div>
            <dt>File format</dt>
            <dd>{item.fileFormat}</dd>
          </div>
          <div>
            <dt>Digital state</dt>
            <dd>{item.digitalState}</dd>
          </div>
          <div>
            <dt>Digitization state</dt>
            <dd>{item.digitizationState}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="owned-related-title">
        <h3 id="owned-related-title">Related tracks</h3>
        {relatedTracks.length > 0 ? (
          <div className="relation-list">
            {relatedTracks.map((track) => (
              <article key={track.id}>
                <a
                  className="detail-link"
                  href={`/tracks?track=${encodeURIComponent(track.id)}`}
                >
                  {track.title}
                </a>
                <p>
                  {track.trackNumber} · {track.artist} · {track.duration}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p>No tracks linked through this item yet.</p>
        )}
      </section>

      <section className="detail-section" aria-labelledby="owned-graph-title">
        <h3 id="owned-graph-title">Related relations and playlists</h3>
        {relatedRelations.length > 0 || relatedPlaylists.length > 0 ? (
          <div className="relation-list">
            {relatedRelations.map((relation) => (
              <article key={relation.id}>
                <span className="badge badge-credit">
                  {relation.relationType}
                </span>
                <a
                  className="detail-link"
                  href={`/relations?relation=${encodeURIComponent(relation.id)}`}
                >
                  {relation.source} to {relation.target}
                </a>
                <p>{relation.role}</p>
              </article>
            ))}
            {relatedPlaylists.map((playlist) => (
              <article key={playlist.id}>
                <span className="badge badge-tag">{playlist.type}</span>
                <a
                  className="detail-link"
                  href={`/playlists?playlist=${encodeURIComponent(playlist.id)}`}
                >
                  {playlist.name}
                </a>
                <p>{playlist.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No relation or playlist backlinks yet.</p>
        )}
      </section>
    </aside>
  )
}

type StatusBadgeProps = {
  item: OwnedItemRecord
  children: string
}

export function StatusBadge({ item, children }: StatusBadgeProps) {
  return (
    <span className={`badge status-badge status-${item.statusTone}`}>
      {children}
    </span>
  )
}

type BadgeListProps = {
  values: string[]
}

function BadgeList({ values }: BadgeListProps) {
  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className="badge badge-tag">
          {value}
        </span>
      ))}
    </span>
  )
}

export function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-owned-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-owned-detail-title">No matching owned items.</h2>
      </div>

      <p className="detail-summary">
        Try another release, artist, medium, status, storage or condition.
      </p>
    </aside>
  )
}
