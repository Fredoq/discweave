import { useMemo, useState, type ChangeEvent } from 'react'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import {
  playlistTouchesRelease,
  relationTouchesLink,
} from '../catalog/catalogGraph'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { RatingsPanel } from '../ratings/RatingsPanel'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import { hasRealLocalFile } from '../tracks/trackDisplayHelpers'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import type {
  OwnedCopy,
  ReleaseArtistCredit,
  ReleaseRecord,
} from './releasesData'
import {
  releaseCatalogNumberDisplay,
  releaseDetailSummary,
  releaseLabelEntries,
  releaseTrackPositionLabel,
  sortReleaseDetailTracks,
} from './releaseFormHelpers'

type ReleaseDetailProps = {
  ownedItems: OwnedItemRecord[]
  onDelete?: () => void
  onEdit?: () => void
  onEditLocalFiles?: (tracks: TrackRecord[]) => void
  onRemoveCover?: (releaseId: string) => Promise<void> | void
  onUpdateViaDiscogs?: () => void
  canUpdateViaDiscogs?: boolean
  onUploadCover?: (releaseId: string, file: File) => Promise<void> | void
  playlists: PlaylistRecord[]
  release: ReleaseRecord
  relations: RelationRecord[]
  ratingCriteria: RatingCriterion[]
  tracks: TrackRecord[]
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

export function ReleaseDetail({
  ownedItems,
  onDelete,
  onEdit,
  onEditLocalFiles,
  onRemoveCover,
  onUpdateViaDiscogs,
  canUpdateViaDiscogs = true,
  onUploadCover,
  playlists,
  release,
  relations,
  ratingCriteria,
  onDeleteRating,
  onRateTarget,
  tracks,
}: ReleaseDetailProps) {
  const releaseLink = { kind: 'release', id: release.id } as const
  const linkedOwnedItems = ownedItems.filter(
    (item) =>
      item.releaseId === release.id ||
      (item.releaseTitle.toLowerCase() === release.title.toLowerCase() &&
        item.artist.toLowerCase() === release.artist.toLowerCase()),
  )
  const linkedRelations = relations.filter(
    (relation) =>
      relationTouchesLink(relation, releaseLink) ||
      relation.source.toLowerCase() === release.title.toLowerCase() ||
      relation.target.toLowerCase() === release.title.toLowerCase() ||
      relation.linkedEntity.toLowerCase() === release.title.toLowerCase(),
  )
  const linkedPlaylists = playlists.filter((playlist) =>
    playlistTouchesRelease(playlist, release),
  )
  const sortedTracks = useMemo(
    () => sortReleaseDetailTracks(tracks, release),
    [release, tracks],
  )
  const localTracks = sortedTracks.filter(
    (track) => hasRealLocalFile(track) && track.fileMetadata.ownedItemId,
  )
  const releaseCredits = releaseArtistCredits(release)
  const summary = releaseDetailSummary(release)

  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="release-detail-title"
    >
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{release.type}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="release-detail-title">{release.title}</h2>
        <p>{release.artist}</p>
        {onEdit ||
        onUpdateViaDiscogs ||
        onDelete ||
        (onEditLocalFiles && localTracks.length > 0) ? (
          <div className="detail-actions">
            {onEdit ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={onEdit}
              >
                Edit record
              </button>
            ) : null}
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
            {onEditLocalFiles && localTracks.length > 0 ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onEditLocalFiles(localTracks)}
              >
                Local files
              </button>
            ) : null}
            {onDelete ? (
              <DeleteSessionRecordButton
                confirmationMessage="Delete this release and unused linked tracks?"
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <ReleaseCoverPanel
        release={release}
        onRemoveCover={onRemoveCover}
        onUploadCover={onUploadCover}
      />

      {summary ? <p className="detail-summary">{summary}</p> : null}

      <RatingsPanel
        criteria={ratingCriteria}
        ratings={release.ratings}
        targetId={release.id}
        targetType="release"
        onDeleteRating={onDeleteRating}
        onRateTarget={onRateTarget}
      />

      <section
        className="detail-section"
        aria-labelledby="release-credits-title"
      >
        <h3 id="release-credits-title">Release credits</h3>
        <div className="relation-list">
          {releaseCredits.map((credit, index) => (
            <article
              key={`${credit.artistId ?? credit.artist}-${credit.role}-${index}`}
            >
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
            </article>
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="release-metadata-title"
      >
        <h3 id="release-metadata-title">Release metadata</h3>
        <dl className="detail-list">
          <div>
            <dt>Artist</dt>
            <dd>{release.artist}</dd>
          </div>
          <div>
            <dt>Year</dt>
            <dd>{release.year}</dd>
          </div>
          <ReleaseLabelMetadata release={release} />
          <div>
            <dt>Genres and tags</dt>
            <dd>
              <BadgeList
                values={[...release.genres, ...release.tags]}
                variant="tag"
              />
            </dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="release-owned-title">
        <h3 id="release-owned-title">Owned copies</h3>
        <div className="copy-list">
          {release.ownedCopies.map((copy) => (
            <OwnedCopyCard key={copy.id} copy={copy} />
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="release-tracks-title"
      >
        <h3 id="release-tracks-title">Tracks</h3>
        {sortedTracks.length > 0 ? (
          <div className="relation-list">
            <p>
              {sortedTracks.length}{' '}
              {sortedTracks.length === 1 ? 'track' : 'tracks'}
            </p>
            {sortedTracks.map((track) => {
              const positionLabel = releaseTrackPositionLabel(track, release)

              return (
                <article key={track.id}>
                  <a className="detail-link" href={trackHref(track.id)}>
                    {track.title}
                  </a>
                  <p>
                    {positionLabel} · {track.artist} · {track.duration}
                  </p>
                </article>
              )
            })}
          </div>
        ) : (
          <p>No tracks linked yet.</p>
        )}
      </section>

      <section className="detail-section" aria-labelledby="release-owned-items">
        <h3 id="release-owned-items">Owned item backlinks</h3>
        {linkedOwnedItems.length > 0 ? (
          <div className="relation-list">
            {linkedOwnedItems.map((item) => (
              <article key={item.id}>
                <span className="badge badge-media">{item.medium}</span>
                <a
                  className="detail-link"
                  href={`/owned-items?ownedItem=${encodeURIComponent(item.id)}`}
                >
                  {item.title}
                </a>
                <p>
                  {item.status} · {item.storage} · {item.condition}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p>No owned items point back to this release yet.</p>
        )}
      </section>

      <section className="detail-section" aria-labelledby="release-graph-links">
        <h3 id="release-graph-links">Relations and playlist appearances</h3>
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

type ReleaseCoverPanelProps = {
  release: Pick<ReleaseRecord, 'coverImage' | 'id' | 'title'>
  onRemoveCover?: (releaseId: string) => Promise<void> | void
  onUploadCover?: (releaseId: string, file: File) => Promise<void> | void
}

export function ReleaseCoverPanel({
  release,
  onRemoveCover,
  onUploadCover,
}: ReleaseCoverPanelProps) {
  const [coverError, setCoverError] = useState('')
  const [isCoverPending, setIsCoverPending] = useState(false)
  const inputLabel = release.coverImage ? 'Replace cover' : 'Upload cover'

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !onUploadCover) {
      return
    }

    setCoverError('')
    setIsCoverPending(true)
    try {
      await onUploadCover(release.id, file)
    } catch (error) {
      setCoverError(coverMutationError(error))
    } finally {
      setIsCoverPending(false)
    }
  }

  async function handleRemoveClick() {
    if (!onRemoveCover || !window.confirm('Remove this cover image?')) {
      return
    }

    setCoverError('')
    setIsCoverPending(true)
    try {
      await onRemoveCover(release.id)
    } catch (error) {
      setCoverError(coverMutationError(error))
    } finally {
      setIsCoverPending(false)
    }
  }

  return (
    <section className="release-cover-panel" aria-label="Release cover">
      <div className="release-cover-frame">
        {release.coverImage ? (
          <img
            alt={`${release.title} cover`}
            className="release-cover-image"
            src={release.coverImage.url}
          />
        ) : (
          <div className="release-cover-placeholder">
            <span>No cover image recorded</span>
          </div>
        )}
      </div>
      <div className="release-cover-actions">
        <label className="button button-secondary release-cover-input">
          {inputLabel}
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-label={inputLabel}
            className="visually-hidden"
            disabled={isCoverPending || !onUploadCover}
            type="file"
            onChange={(event) => {
              void handleFileChange(event)
            }}
          />
        </label>
        {release.coverImage ? (
          <button
            className="button button-secondary"
            disabled={isCoverPending || !onRemoveCover}
            type="button"
            onClick={() => {
              void handleRemoveClick()
            }}
          >
            Remove cover
          </button>
        ) : null}
      </div>
      {isCoverPending ? <p role="status">Updating cover...</p> : null}
      {coverError ? <p role="alert">{coverError}</p> : null}
    </section>
  )
}

function coverMutationError(error: unknown) {
  return error instanceof Error ? error.message : 'Cover update failed.'
}

function ReleaseLabelMetadata({ release }: { release: ReleaseRecord }) {
  const labels = releaseLabelEntries(release)

  return (
    <div>
      <dt className="visually-hidden">Labels</dt>
      <dd>
        {labels.length === 0 ? (
          <span className="release-table-empty">Unknown label</span>
        ) : (
          <span
            className="release-label-metadata-table"
            aria-label="Labels and catalog numbers"
          >
            <span className="release-label-metadata-heading" aria-hidden="true">
              <span>Label</span>
              <span>Catalog number</span>
            </span>
            {labels.map((label, index) => {
              const catalogNumber = releaseCatalogNumberDisplay(label)

              return (
                <span
                  className="release-label-metadata-row"
                  key={`${label.name}-${catalogNumber}-${index}`}
                >
                  <span className="release-label-metadata-name">
                    {label.name}
                  </span>
                  <span
                    className={
                      label.catalogNumber
                        ? 'release-label-metadata-catalog'
                        : 'release-label-metadata-catalog release-catalog-number-empty'
                    }
                  >
                    {catalogNumber}
                  </span>
                </span>
              )
            })}
          </span>
        )}
      </dd>
    </div>
  )
}

function trackHref(trackId: string) {
  return `/tracks?track=${encodeURIComponent(trackId)}`
}

function releaseArtistCredits(release: ReleaseRecord): ReleaseArtistCredit[] {
  if (release.artistCredits && release.artistCredits.length > 0) {
    return release.artistCredits
  }

  return [
    {
      artistId: release.artistId,
      artist: release.artist,
      role: 'Main artist',
      roles: ['Main artist'],
    },
  ]
}

type OwnedCopyCardProps = {
  copy: OwnedCopy
}

function OwnedCopyCard({ copy }: OwnedCopyCardProps) {
  return (
    <article className="copy-card">
      <div>
        <strong>{copy.medium}</strong>
        <span className="badge badge-tag">{copy.status}</span>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Storage</dt>
          <dd>{copy.storage}</dd>
        </div>
        <div>
          <dt>Condition</dt>
          <dd>{copy.condition}</dd>
        </div>
      </dl>
      {copy.note ? <p>{copy.note}</p> : null}
    </article>
  )
}

export function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-release-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-release-detail-title">No matching releases.</h2>
      </div>

      <p className="detail-summary">
        Try another title, artist, label, medium or ownership status.
      </p>
    </aside>
  )
}

type BadgeListProps = {
  values: string[]
  variant: 'media' | 'tag'
}

function BadgeList({ values, variant }: BadgeListProps) {
  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
          {value}
        </span>
      ))}
    </span>
  )
}
