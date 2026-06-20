import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import {
  playlistTouchesRelease,
  relationTouchesLink,
} from '../catalog/catalogGraph'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import {
  digitalCoverageSummary,
  formatCollectorSignal,
  isDigitalOwnedItem,
  type DigitalFileCoverageRecord,
  type OwnedItemRecord,
} from './ownedItemsData'

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
  const linkedReleaseId = item.target?.id ?? item.targetId ?? item.releaseId
  const linkedRelease = releases.find(
    (release) => release.id === linkedReleaseId,
  )
  const linkedTargetHref =
    linkedReleaseId && (linkedRelease || item.target)
      ? releaseHref(linkedReleaseId)
      : undefined
  const linkedTargetTitle = item.target?.title ?? item.releaseTitle
  const relatedTracks = tracks.filter((track) =>
    trackAppearsOnOwnedItemRelease(track, linkedReleaseId, item),
  )
  const isDigitalCopy = isDigitalOwnedItem(item)
  const linkedDigitalTrackIds = new Set(
    item.digitalDetails?.files.map((file) => file.trackId) ?? [],
  )
  const missingDigitalTracks = isDigitalCopy
    ? relatedTracks.filter((track) => !linkedDigitalTrackIds.has(track.id))
    : []
  const itemLink = { kind: 'ownedItem', id: item.id } as const
  const relatedRelations = relations.filter(
    (relation) =>
      relationTouchesLink(relation, itemLink) ||
      relation.source.toLowerCase() === item.title.toLowerCase() ||
      relation.target.toLowerCase() === item.title.toLowerCase() ||
      relation.linkedEntity.toLowerCase() === item.title.toLowerCase(),
  )
  const relatedPlaylists = playlists.filter(
    (playlist) =>
      linkedRelease && playlistTouchesRelease(playlist, linkedRelease),
  )

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
            <dt>Release</dt>
            <dd>
              {linkedTargetHref ? (
                <a className="detail-link" href={linkedTargetHref}>
                  {linkedTargetTitle}
                </a>
              ) : (
                linkedTargetTitle
              )}
            </dd>
          </div>
          <div>
            <dt>{item.target ? 'Context' : 'Artist'}</dt>
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
          <div>
            <dt>Inventory signals</dt>
            <dd>
              <BadgeList
                values={(item.inventorySignals ?? []).map(
                  formatCollectorSignal,
                )}
              />
            </dd>
          </div>
        </dl>
      </section>

      {isDigitalCopy ? (
        <DigitalCopyDetails item={item} missingTracks={missingDigitalTracks} />
      ) : (
        <PhysicalCopyDetails item={item} />
      )}

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

function trackAppearsOnOwnedItemRelease(
  track: TrackRecord,
  linkedReleaseId: string | undefined,
  item: OwnedItemRecord,
) {
  if (linkedReleaseId) {
    return (
      track.release.id === linkedReleaseId ||
      track.releaseAppearances.some(
        (appearance) => appearance.releaseId === linkedReleaseId,
      )
    )
  }

  const releaseTitle = item.releaseTitle.toLowerCase()

  return (
    track.release.title.toLowerCase() === releaseTitle ||
    track.releaseAppearances.some(
      (appearance) => appearance.releaseTitle.toLowerCase() === releaseTitle,
    )
  )
}

function DigitalCopyDetails({
  item,
  missingTracks,
}: {
  readonly item: OwnedItemRecord
  readonly missingTracks: readonly TrackRecord[]
}) {
  const details = item.digitalDetails
  const files = details?.files ?? []
  const coverageSummary = digitalCoverageSummary(details)
  const shouldShowDigitalState = item.digitalState !== coverageSummary

  return (
    <>
      <section
        className="detail-section"
        aria-labelledby="owned-digital-overview-title"
      >
        <h3 id="owned-digital-overview-title">Digital copy overview</h3>
        <dl className="detail-list">
          <div>
            <dt>Medium</dt>
            <dd>{item.medium}</dd>
          </div>
          <div>
            <dt>File coverage</dt>
            <dd>{coverageSummary}</dd>
          </div>
          <div>
            <dt>File formats</dt>
            <dd>{item.fileFormat}</dd>
          </div>
          {shouldShowDigitalState ? (
            <div>
              <dt>Digital state</dt>
              <dd>{item.digitalState}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section
        className="detail-section"
        aria-labelledby="owned-track-coverage-title"
      >
        <h3 id="owned-track-coverage-title">Track file coverage</h3>
        {files.length > 0 || missingTracks.length > 0 ? (
          <div className="relation-list">
            {files.map((file) => (
              <DigitalFileCoverageRow
                key={file.digitalTrackFileLinkId}
                file={file}
              />
            ))}
            {missingTracks.map((track) => (
              <article key={track.id}>
                <span className="badge badge-tag">Missing file</span>
                <a
                  className="detail-link"
                  href={`/tracks?track=${encodeURIComponent(track.id)}`}
                >
                  {track.title}
                </a>
                <p>
                  {track.trackNumber} · No local file linked to this digital
                  copy.
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p>No local files linked to this digital copy yet.</p>
        )}
        {details && details.missingFileCount > missingTracks.length ? (
          <p>
            {details.missingFileCount} release track
            {details.missingFileCount === 1 ? '' : 's'} missing local files.
          </p>
        ) : null}
      </section>
    </>
  )
}

function DigitalFileCoverageRow({
  file,
}: {
  readonly file: DigitalFileCoverageRecord
}) {
  const positionParts = [file.disc, file.side, file.position].filter(Boolean)

  return (
    <article>
      <span className="badge badge-tag">Linked file</span>
      <a
        className="detail-link"
        href={`/tracks?track=${encodeURIComponent(file.trackId)}`}
      >
        {file.trackTitle}
      </a>
      <p>
        {positionParts.join(' · ') || 'Unnumbered'} · {file.format} ·{' '}
        {file.codec} · {file.quality}
      </p>
      <p>{file.path}</p>
      <p>
        {file.duration} · {file.bitrate} · {file.sampleRate} · {file.channels}
      </p>
    </article>
  )
}

function PhysicalCopyDetails({ item }: { readonly item: OwnedItemRecord }) {
  const details = item.physicalDetails
  const shouldShowDigitizationState = item.digitizationState !== item.status

  return (
    <>
      <section
        className="detail-section"
        aria-labelledby="owned-physical-overview-title"
      >
        <h3 id="owned-physical-overview-title">Physical copy overview</h3>
        <dl className="detail-list">
          <div>
            <dt>Medium</dt>
            <dd>{item.medium}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </div>
          {shouldShowDigitizationState ? (
            <div>
              <dt>Digitization state</dt>
              <dd>{item.digitizationState}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section
        className="detail-section"
        aria-labelledby="owned-physical-title"
      >
        <h3 id="owned-physical-title">Physical details</h3>
        <dl className="detail-list">
          <div>
            <dt>Storage</dt>
            <dd>{details?.storageLocation ?? item.storage}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{details?.condition ?? item.condition}</dd>
          </div>
          {details?.formatDescription ? (
            <div>
              <dt>Format</dt>
              <dd>{details.formatDescription}</dd>
            </div>
          ) : null}
          {details?.discCount ? (
            <div>
              <dt>Disc count</dt>
              <dd>{details.discCount}</dd>
            </div>
          ) : null}
          {details?.tapeType ? (
            <div>
              <dt>Tape type</dt>
              <dd>{details.tapeType}</dd>
            </div>
          ) : null}
          {details?.name ? (
            <div>
              <dt>Description</dt>
              <dd>{details.name}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </>
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
