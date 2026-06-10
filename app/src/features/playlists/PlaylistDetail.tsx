import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { playlistTouchesArtist } from '../catalog/catalogGraph'
import type { ArtistRecord } from '../artists/artistsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import {
  type LinkedReleaseAvailability,
  type PlaylistRecord,
  type PlaylistTrack,
} from './playlistsData'

function releaseHref(releaseId: string) {
  return `/releases?release=${encodeURIComponent(releaseId)}`
}

function trackHref(trackId: string) {
  return `/tracks?track=${encodeURIComponent(trackId)}`
}

type PlaylistDetailProps = {
  artists: ArtistRecord[]
  onDelete?: () => void
  onEdit?: () => void
  ownedItems: OwnedItemRecord[]
  playlist: PlaylistRecord
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
}

export function PlaylistDetail({
  artists,
  onDelete,
  onEdit,
  ownedItems,
  playlist,
  releases,
  tracks,
}: PlaylistDetailProps) {
  const relatedArtists = artists.filter((artist) =>
    playlistTouchesArtist(playlist, artist),
  )
  const relatedOwnedItems = ownedItems.filter((item) =>
    playlist.linkedReleases.some(
      (release) => release.releaseId === item.releaseId,
    ),
  )

  return (
    <aside className="panel detail-panel" aria-labelledby="playlist-title">
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{playlist.type} playlist</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable record</span>
          ) : null}
        </div>
        <h2 id="playlist-title">{playlist.name}</h2>
        <p>{playlist.curator}</p>
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
                confirmationMessage="Delete this playlist? This cannot be undone."
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="detail-summary">{playlist.description}</p>

      <section
        className="detail-section"
        aria-labelledby="playlist-metadata-title"
      >
        <h3 id="playlist-metadata-title">Playlist metadata</h3>
        <dl className="detail-list">
          <div>
            <dt>Type</dt>
            <dd>{playlist.type}</dd>
          </div>
          <div>
            <dt>Track count</dt>
            <dd>{playlist.tracks.length}</dd>
          </div>
          <div>
            <dt>Year range</dt>
            <dd>{playlist.yearRange}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{playlist.updatedAt}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="playlist-tracks">
        <h3 id="playlist-tracks">Tracks</h3>
        <div className="relation-list">
          {playlist.tracks.map((track) => (
            <TrackCard
              key={track.id}
              knownReleases={releases}
              knownTracks={tracks}
              track={track}
            />
          ))}
        </div>
      </section>

      <section className="detail-section" aria-labelledby="playlist-rules">
        <h3 id="playlist-rules">Smart rules / manual selection</h3>
        {playlist.type === 'Manual' ? (
          <dl className="detail-list">
            <div>
              <dt>Selection mode</dt>
              <dd>{playlist.manualSelection.source}</dd>
            </div>
            <div>
              <dt>Selection note</dt>
              <dd>{playlist.manualSelection.note}</dd>
            </div>
          </dl>
        ) : null}
        {playlist.type === 'Smart' ? (
          <div className="copy-list">
            <article className="copy-card">
              <strong>{playlist.smartRules.summary}</strong>
              <ul className="criteria-list">
                {playlist.smartRules.criteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </article>
          </div>
        ) : null}
      </section>

      <section
        className="detail-section"
        aria-labelledby="playlist-availability"
      >
        <h3 id="playlist-availability">
          Linked releases and owned availability
        </h3>
        <div className="copy-list">
          {playlist.linkedReleases.map((release) => (
            <ReleaseAvailabilityCard
              key={release.releaseId}
              knownReleases={releases}
              release={release}
            />
          ))}
        </div>
      </section>

      <section className="detail-section" aria-labelledby="playlist-graph">
        <h3 id="playlist-graph">Related catalog context</h3>
        <div className="relation-list">
          {relatedArtists.length > 0 || relatedOwnedItems.length > 0 ? (
            <>
              {relatedArtists.map((artist) => (
                <article key={artist.id}>
                  <span className="badge badge-credit">Artist</span>
                  <a
                    className="detail-link"
                    href={`/artists?artist=${encodeURIComponent(artist.id)}`}
                  >
                    {artist.name}
                  </a>
                  <p>{artist.creditHint}</p>
                </article>
              ))}
              {relatedOwnedItems.map((item) => (
                <article key={item.id}>
                  <span className="badge badge-media">{item.medium}</span>
                  <a
                    className="detail-link"
                    href={`/owned-items?ownedItem=${encodeURIComponent(item.id)}`}
                  >
                    {item.title}
                  </a>
                  <p>
                    {item.status} · {item.storage}
                  </p>
                </article>
              ))}
            </>
          ) : (
            <p>No related artists or owned items found yet.</p>
          )}
        </div>
      </section>
    </aside>
  )
}

type TrackCardProps = {
  knownReleases: ReleaseRecord[]
  knownTracks: TrackRecord[]
  track: PlaylistTrack
}

function TrackCard({ knownReleases, knownTracks, track }: TrackCardProps) {
  const linkedTrackExists = knownTracks.some((record) => record.id === track.id)
  const linkedReleaseExists = knownReleases.some(
    (record) => record.id === track.release.id,
  )

  return (
    <article>
      <span className="badge badge-media">{track.fileFormat}</span>
      <strong>
        {linkedTrackExists ? (
          <a className="detail-link" href={trackHref(track.id)}>
            {track.title}
          </a>
        ) : (
          track.title
        )}
      </strong>
      <p>
        {track.artist} ·{' '}
        {linkedReleaseExists ? (
          <a className="detail-link" href={releaseHref(track.release.id)}>
            {track.release.title}
          </a>
        ) : (
          track.release.title
        )}{' '}
        · {track.release.year}
      </p>
      <p>{track.availability}</p>
      <BadgeList values={[...track.tags, ...track.media]} />
    </article>
  )
}

type ReleaseAvailabilityCardProps = {
  knownReleases: ReleaseRecord[]
  release: LinkedReleaseAvailability
}

function ReleaseAvailabilityCard({
  knownReleases,
  release,
}: ReleaseAvailabilityCardProps) {
  const linkedReleaseExists = knownReleases.some(
    (record) => record.id === release.releaseId,
  )

  return (
    <article className="copy-card">
      <div>
        <strong>
          {linkedReleaseExists ? (
            <a className="detail-link" href={releaseHref(release.releaseId)}>
              {release.title}
            </a>
          ) : (
            release.title
          )}
        </strong>
        <span>{release.year}</span>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Artist</dt>
          <dd>{release.artist}</dd>
        </div>
        <div>
          <dt>Media</dt>
          <dd>
            <BadgeList values={release.media} variant="media" />
          </dd>
        </div>
        <div>
          <dt>Owned availability</dt>
          <dd>
            <BadgeList values={release.ownershipStatus} />
          </dd>
        </div>
      </dl>
      <p>{release.availability}</p>
    </article>
  )
}

type BadgeListProps = {
  values: string[]
  variant?: 'media' | 'tag'
}

export function BadgeList({ values, variant = 'tag' }: BadgeListProps) {
  const uniqueValues = [...new Set(values)]

  return (
    <span className="badge-list">
      {uniqueValues.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
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
      aria-labelledby="empty-playlist-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-playlist-detail-title">No matching playlists.</h2>
      </div>

      <p className="detail-summary">
        Try another name, type, track, artist, release, tag, format, status or
        rule.
      </p>
    </aside>
  )
}
