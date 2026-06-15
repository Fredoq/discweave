import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import {
  playlistTouchesTrack,
  relationTouchesLink,
} from '../catalog/catalogGraph'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { RatingsPanel } from '../ratings/RatingsPanel'
import type { PlaylistRecord } from '../playlists/playlistsData'
import { ReleaseCoverThumbnail } from '../releases/ReleaseCoverThumbnail'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import {
  hasRealLocalFile,
  releaseHref,
  trackArtistDisplay,
  trackReleaseAppearances,
} from './trackDisplayHelpers'
import type {
  LocalFileMetadata,
  TrackCredit,
  TrackRecord,
  TrackReleaseAppearance,
  TrackRelation,
} from './tracksData'

type TrackDetailProps = {
  onDelete?: () => void
  onEdit?: () => void
  onEditLocalFile?: (track: TrackRecord) => void
  onUpdateViaDiscogs?: () => void
  canUpdateViaDiscogs?: boolean
  playlists: PlaylistRecord[]
  ratingCriteria: RatingCriterion[]
  relations: RelationRecord[]
  releases: ReleaseRecord[]
  track: TrackRecord
  onDeleteRating?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
  ) => void
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
  ) => void
}

export function TrackDetail({
  onDelete,
  onEdit,
  onEditLocalFile,
  onUpdateViaDiscogs,
  canUpdateViaDiscogs = true,
  onDeleteRating,
  onRateTarget,
  playlists,
  ratingCriteria,
  relations,
  releases,
  track,
}: TrackDetailProps) {
  const appearances = trackReleaseAppearances(track)
  const releasesById = new Map(releases.map((release) => [release.id, release]))
  const trackLink = { kind: 'track', id: track.id } as const
  const linkedRelations = relations.filter(
    (relation) =>
      relationTouchesLink(relation, trackLink) ||
      track.relations.some(
        (trackRelation) =>
          trackRelation.target.toLowerCase() ===
          relation.linkedEntity.toLowerCase(),
      ) ||
      relation.linkedEntity.toLowerCase() === track.title.toLowerCase(),
  )
  const linkedPlaylists = playlists.filter((playlist) =>
    playlistTouchesTrack(playlist, track),
  )

  return (
    <aside className="panel detail-panel" aria-labelledby="track-detail-title">
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">Track</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="track-detail-title">{track.title}</h2>
        <p>{trackArtistDisplay(track)}</p>
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
                confirmationMessage="Delete this track and remove its release links and credits?"
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {track.relationHint ? (
        <p className="detail-summary">{track.relationHint}</p>
      ) : null}

      <RatingsPanel
        criteria={ratingCriteria}
        ratings={track.ratings}
        targetId={track.id}
        targetType="track"
        onDeleteRating={onDeleteRating}
        onRateTarget={onRateTarget}
      />

      <section
        className="detail-section"
        aria-labelledby="release-appearances-title"
      >
        <h3 id="release-appearances-title">Release appearances</h3>
        {appearances.length > 0 ? (
          <div className="relation-list">
            {appearances.map((appearance) => {
              const linkedRelease = appearance.releaseId
                ? releasesById.get(appearance.releaseId)
                : undefined
              const linkedReleaseExists = Boolean(linkedRelease)
              const coverImage =
                linkedRelease?.coverImage ?? appearance.coverImage
              const showsThumbnail = Boolean(linkedRelease || coverImage)

              return (
                <article
                  className={showsThumbnail ? 'release-appearance-card' : ''}
                  key={`${appearance.releaseId}-${appearance.position}`}
                >
                  {showsThumbnail ? (
                    <ReleaseCoverThumbnail
                      coverImage={coverImage}
                      title={appearance.releaseTitle}
                    />
                  ) : null}
                  <div className="release-appearance-card-body">
                    <span className="badge badge-credit">
                      {trackAppearancePositionLabel(appearance)}
                    </span>
                    {linkedReleaseExists && appearance.releaseId ? (
                      <a
                        className="detail-link"
                        href={releaseHref(appearance.releaseId)}
                      >
                        {appearance.releaseTitle}
                      </a>
                    ) : (
                      <strong>{appearance.releaseTitle}</strong>
                    )}
                    <p>{appearance.releaseArtist}</p>
                    <p>
                      {appearance.year} · {appearance.label} ·{' '}
                      {appearance.duration}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p>No release appearances recorded.</p>
        )}
      </section>

      <section className="detail-section" aria-labelledby="track-credits-title">
        <h3 id="track-credits-title">Track credits</h3>
        <div className="relation-list">
          {track.credits.map((credit) => (
            <CreditCard
              key={`${credit.role}-${credit.artist}`}
              credit={credit}
            />
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="track-relations-title"
      >
        <h3 id="track-relations-title">Relations</h3>
        <div className="relation-list">
          {track.relations.map((relation) => (
            <RelationCard
              key={`${relation.type}-${relation.target}`}
              relation={relation}
            />
          ))}
        </div>
      </section>

      {hasRealLocalFile(track) ? (
        <section className="detail-section" aria-labelledby="track-files-title">
          <h3 id="track-files-title">Local file metadata</h3>
          {onEditLocalFile && track.fileMetadata.ownedItemId ? (
            <div className="detail-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onEditLocalFile(track)}
              >
                Edit local file
              </button>
            </div>
          ) : null}
          <FileMetadata metadata={track.fileMetadata} />
        </section>
      ) : null}

      <section className="detail-section" aria-labelledby="track-graph-title">
        <h3 id="track-graph-title">Relation and playlist backlinks</h3>
        {linkedRelations.length > 0 || linkedPlaylists.length > 0 ? (
          <div className="relation-list">
            {linkedRelations.map((relation) => (
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
            {linkedPlaylists.map((playlist) => (
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

function trackAppearancePositionLabel(appearance: TrackReleaseAppearance) {
  const context = [
    appearance.disc?.trim(),
    appearance.side?.trim() ? `Side ${appearance.side.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return [context, `Track ${appearance.position}`].filter(Boolean).join(' · ')
}

type CreditCardProps = {
  credit: TrackCredit
}

function CreditCard({ credit }: CreditCardProps) {
  return (
    <article>
      {(credit.roles && credit.roles.length > 0
        ? credit.roles
        : [credit.role]
      ).map((role) => (
        <span className="badge badge-credit" key={role}>
          {role}
        </span>
      ))}
      {credit.artistId ? (
        <a
          className="detail-link"
          href={`/artists?artist=${encodeURIComponent(credit.artistId)}`}
        >
          {credit.artist}
        </a>
      ) : (
        <strong>{credit.artist}</strong>
      )}
      {credit.scope ? <p>{credit.scope}</p> : null}
    </article>
  )
}

type RelationCardProps = {
  relation: TrackRelation
}

function RelationCard({ relation }: RelationCardProps) {
  return (
    <article>
      <span className="badge badge-credit">{relation.type}</span>
      {relation.targetId ? (
        <a
          className="detail-link"
          href={`/tracks?track=${encodeURIComponent(relation.targetId)}`}
        >
          {relation.target}
        </a>
      ) : (
        <strong>{relation.target}</strong>
      )}
      <p>{relation.detail}</p>
      {relation.relationId ? (
        <a
          className="detail-link"
          href={`/relations?relation=${encodeURIComponent(relation.relationId)}`}
        >
          Relation record
        </a>
      ) : null}
    </article>
  )
}

type FileMetadataProps = {
  metadata: LocalFileMetadata
}

function FileMetadata({ metadata }: FileMetadataProps) {
  return (
    <dl className="detail-list">
      <div>
        <dt>Format</dt>
        <dd>{metadata.format}</dd>
      </div>
      <div>
        <dt>Path</dt>
        <dd>{metadata.path}</dd>
      </div>
      <div>
        <dt>Bitrate</dt>
        <dd>{metadata.bitrate}</dd>
      </div>
      <div>
        <dt>Sample rate</dt>
        <dd>{metadata.sampleRate}</dd>
      </div>
      <div>
        <dt>Channels</dt>
        <dd>{metadata.channels}</dd>
      </div>
      <div>
        <dt>Import state</dt>
        <dd>{metadata.importedAt}</dd>
      </div>
      <div>
        <dt>Checksum</dt>
        <dd>{metadata.checksum}</dd>
      </div>
    </dl>
  )
}

export function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-track-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-track-detail-title">No matching tracks.</h2>
      </div>

      <p className="detail-summary">
        Try another title, artist, release, role, version or file format.
      </p>
    </aside>
  )
}
