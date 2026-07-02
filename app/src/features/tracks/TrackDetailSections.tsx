import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import type { PlaylistRecord } from '../playlists/playlistsData'
import { ReleaseCoverThumbnail } from '../releases/ReleaseCoverThumbnail'
import type { ReleaseRecord } from '../releases/releasesData'
import { trackDetailRelationGroups } from './trackDetailRelations'
import { releaseHref, trackArtistDisplay } from './trackDisplayHelpers'
import type {
  TrackCredit,
  TrackRecord,
  TrackReleaseAppearance,
  TrackRelation,
} from './tracksData'

type TrackDetailHeaderProps = Readonly<{
  canUpdateViaDiscogs: boolean
  localFileCount?: number
  track: TrackRecord
  onDelete?: () => void
  onEdit?: () => void
  onOpenLocalFiles?: () => void
  onUpdateViaDiscogs?: () => void
}>

export function TrackDetailHeader({
  canUpdateViaDiscogs,
  localFileCount = 0,
  track,
  onDelete,
  onEdit,
  onOpenLocalFiles,
  onUpdateViaDiscogs,
}: TrackDetailHeaderProps) {
  return (
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
          {onOpenLocalFiles && localFileCount > 0 ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={onOpenLocalFiles}
            >
              {localFileCount === 1 ? 'Open local file' : 'Open local files'}
            </button>
          ) : null}
          <button
            className="button button-secondary"
            type="button"
            onClick={onEdit}
          >
            Edit record
          </button>
          <DiscogsUpdateAction
            canUpdateViaDiscogs={canUpdateViaDiscogs}
            onUpdateViaDiscogs={onUpdateViaDiscogs}
          />
          {onDelete ? (
            <DeleteSessionRecordButton
              confirmationMessage="Delete this track and remove its release links and credits?"
              onDelete={onDelete}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type DiscogsUpdateActionProps = Readonly<{
  canUpdateViaDiscogs: boolean
  onUpdateViaDiscogs?: () => void
}>

function DiscogsUpdateAction({
  canUpdateViaDiscogs,
  onUpdateViaDiscogs,
}: DiscogsUpdateActionProps) {
  if (onUpdateViaDiscogs) {
    const disabledNote = canUpdateViaDiscogs ? null : (
      <span className="discogs-disabled-note">
        Add a Discogs token in Settings to use Discogs lookup.
      </span>
    )

    return (
      <span className="discogs-action-state">
        <button
          className="button button-secondary"
          disabled={!canUpdateViaDiscogs}
          type="button"
          onClick={onUpdateViaDiscogs}
        >
          Update via Discogs
        </button>
        {disabledNote}
      </span>
    )
  }

  return null
}

type ReleaseAppearancesSectionProps = Readonly<{
  appearances: TrackReleaseAppearance[]
  releasesById: Map<string, ReleaseRecord>
}>

export function ReleaseAppearancesSection({
  appearances,
  releasesById,
}: ReleaseAppearancesSectionProps) {
  return (
    <section
      className="detail-section"
      aria-labelledby="release-appearances-title"
    >
      <h3 id="release-appearances-title">Release appearances</h3>
      {appearances.length > 0 ? (
        <div className="relation-list">
          {appearances.map((appearance) => (
            <ReleaseAppearanceCard
              appearance={appearance}
              key={`${appearance.releaseId}-${appearance.position}`}
              linkedRelease={
                appearance.releaseId
                  ? releasesById.get(appearance.releaseId)
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p>No release appearances recorded.</p>
      )}
    </section>
  )
}

type ReleaseAppearanceCardProps = Readonly<{
  appearance: TrackReleaseAppearance
  linkedRelease?: ReleaseRecord
}>

function ReleaseAppearanceCard({
  appearance,
  linkedRelease,
}: ReleaseAppearanceCardProps) {
  const coverImage = linkedRelease?.coverImage ?? appearance.coverImage
  const showsThumbnail = Boolean(linkedRelease || coverImage)

  return (
    <article className={showsThumbnail ? 'release-appearance-card' : ''}>
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
        {linkedRelease && appearance.releaseId ? (
          <a className="detail-link" href={releaseHref(appearance.releaseId)}>
            {appearance.releaseTitle}
          </a>
        ) : (
          <strong>{appearance.releaseTitle}</strong>
        )}
        <p>{appearance.releaseArtist}</p>
        <p>
          {appearance.year} · {appearance.label} · {appearance.duration}
        </p>
      </div>
    </article>
  )
}

type TrackRelationsSectionProps = Readonly<{
  relationGroups: ReturnType<typeof trackDetailRelationGroups>
  relationRecordIds: Set<string>
}>

export function TrackRelationsSection({
  relationGroups,
  relationRecordIds,
}: TrackRelationsSectionProps) {
  const hasRelations = Object.values(relationGroups).some(
    (relations) => relations.length > 0,
  )

  return (
    <section className="detail-section" aria-labelledby="track-relations-title">
      <h3 id="track-relations-title">Track relations</h3>
      {hasRelations ? (
        <div className="track-relation-groups">
          <TrackRelationGroup
            label="Origin"
            relationRecordIds={relationRecordIds}
            relations={relationGroups.origin}
          />
          <TrackRelationGroup
            label="Remixes"
            relationRecordIds={relationRecordIds}
            relations={relationGroups.remixes}
          />
          <TrackRelationGroup
            label="Versions"
            relationRecordIds={relationRecordIds}
            relations={relationGroups.versions}
          />
          <TrackRelationGroup
            label="Other relations"
            relationRecordIds={relationRecordIds}
            relations={relationGroups.other}
            showType
          />
        </div>
      ) : (
        <p>No track relations recorded.</p>
      )}
    </section>
  )
}

type PlaylistBacklinksSectionProps = Readonly<{
  playlists: PlaylistRecord[]
}>

export function PlaylistBacklinksSection({
  playlists,
}: PlaylistBacklinksSectionProps) {
  return (
    <section className="detail-section" aria-labelledby="track-graph-title">
      <h3 id="track-graph-title">Playlist backlinks</h3>
      {playlists.length > 0 ? (
        <div className="relation-list">
          {playlists.map((playlist) => (
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
        <p>No playlist backlinks yet.</p>
      )}
    </section>
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

type CreditCardProps = Readonly<{
  credit: TrackCredit
}>

export function CreditCard({ credit }: CreditCardProps) {
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
  hasRelationRecord: boolean
  relation: TrackRelation
  showType?: boolean
}

type TrackRelationGroupProps = {
  label: string
  relationRecordIds: Set<string>
  relations: TrackRelation[]
  showType?: boolean
}

function TrackRelationGroup({
  label,
  relationRecordIds,
  relations,
  showType = false,
}: Readonly<TrackRelationGroupProps>) {
  if (relations.length === 0) {
    return null
  }

  return (
    <section className="track-relation-group" aria-label={label}>
      <h4>{label}</h4>
      <div className="relation-list">
        {relations.map((relation) => (
          <RelationCard
            key={`${relation.type}-${relation.target}-${relation.direction}`}
            relation={relation}
            hasRelationRecord={hasTrackRelationRecord(
              relation,
              relationRecordIds,
            )}
            showType={showType}
          />
        ))}
      </div>
    </section>
  )
}

function RelationCard({
  hasRelationRecord,
  relation,
  showType = false,
}: Readonly<RelationCardProps>) {
  return (
    <article className="track-relation-card">
      {showType ? (
        <div className="track-relation-card-header">
          <span className="badge badge-credit">{relation.type}</span>
        </div>
      ) : null}
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
      {relation.detail ? <p>{relation.detail}</p> : null}
      {relation.relationId && hasRelationRecord ? (
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

function hasTrackRelationRecord(
  relation: TrackRelation,
  relationRecordIds: Set<string>,
) {
  return Boolean(
    relation.relationId &&
    relationRecordIds.has(relation.relationId.toLowerCase()),
  )
}
