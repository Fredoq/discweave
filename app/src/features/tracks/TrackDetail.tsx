import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { playlistTouchesTrack } from '../catalog/catalogGraph'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { RatingsPanel } from '../ratings/RatingsPanel'
import type { PlaylistRecord } from '../playlists/playlistsData'
import { ReleaseCoverThumbnail } from '../releases/ReleaseCoverThumbnail'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import {
  isDifferentTrackDigitalFilePath,
  isReusedTrackDigitalFile,
  releaseHref,
  trackArtistDisplay,
  trackDigitalFilePositionLabel,
  trackDigitalFileSummary,
  trackReleaseAppearances,
} from './trackDisplayHelpers'
import type {
  TrackDigitalFile,
  TrackCredit,
  TrackRecord,
  TrackReleaseAppearance,
  TrackRelation,
} from './tracksData'

type TrackDetailProps = {
  onDelete?: () => void
  onEdit?: () => void
  onEditLocalFile?: (track: TrackRecord, file: TrackDigitalFile) => void
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
  const linkedPlaylists = playlists.filter((playlist) =>
    playlistTouchesTrack(playlist, track),
  )
  const relationRecordIds = new Set(
    relations.map((relation) => relation.id.toLowerCase()),
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
        <h3 id="track-relations-title">Track relations</h3>
        {track.relations.length > 0 ? (
          <div className="relation-list">
            {track.relations.map((relation) => (
              <RelationCard
                key={`${relation.type}-${relation.target}`}
                relation={relation}
                hasRelationRecord={Boolean(
                  relation.relationId &&
                  relationRecordIds.has(relation.relationId.toLowerCase()),
                )}
                trackTitle={track.title}
              />
            ))}
          </div>
        ) : (
          <p>No track relations recorded.</p>
        )}
      </section>

      <DigitalFilesInCollectionSection
        onEditLocalFile={onEditLocalFile}
        track={track}
      />

      <section className="detail-section" aria-labelledby="track-graph-title">
        <h3 id="track-graph-title">Playlist backlinks</h3>
        {linkedPlaylists.length > 0 ? (
          <div className="relation-list">
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
          <p>No playlist backlinks yet.</p>
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
  hasRelationRecord: boolean
  relation: TrackRelation
  trackTitle: string
}

function RelationCard({
  hasRelationRecord,
  relation,
  trackTitle,
}: Readonly<RelationCardProps>) {
  return (
    <article className="track-relation-card">
      <div className="track-relation-card-header">
        <span className="badge badge-credit">{relation.type}</span>
        <span className="track-relation-direction">
          {relationDirectionLabel(relation)}
        </span>
      </div>
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
      <p>{relationSentence(trackTitle, relation)}</p>
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

function relationDirectionLabel(relation: TrackRelation) {
  return relation.direction === 'incoming'
    ? 'Incoming relation'
    : 'Outgoing relation'
}

function relationSentence(trackTitle: string, relation: TrackRelation) {
  const relationType = relation.type.toLocaleLowerCase()
  const isOfRelation = relationType.endsWith(' of')

  if (relation.direction === 'incoming') {
    return isOfRelation
      ? `${relation.target} is ${relationType} this track.`
      : `${relation.target} has ${relationType} relation to this track.`
  }

  return isOfRelation
    ? `${trackTitle} is ${relationType} ${relation.target}.`
    : `${trackTitle} has ${relationType} relation to ${relation.target}.`
}

type DigitalFilesInCollectionSectionProps = {
  onEditLocalFile?: (track: TrackRecord, file: TrackDigitalFile) => void
  track: TrackRecord
}

function DigitalFilesInCollectionSection({
  onEditLocalFile,
  track,
}: DigitalFilesInCollectionSectionProps) {
  const summary = trackDigitalFileSummary(track)

  return (
    <section className="detail-section" aria-labelledby="track-files-title">
      <h3 id="track-files-title">Digital files in collection</h3>
      <DigitalFilesSummary summary={summary} />
      {track.digitalFiles.length > 0 ? (
        <div className="relation-list track-digital-file-list">
          {track.digitalFiles.map((file) => (
            <DigitalFileMetadata
              file={file}
              files={track.digitalFiles}
              key={file.digitalTrackFileLinkId}
              onEditLocalFile={
                onEditLocalFile ? () => onEditLocalFile(track, file) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p>No digital files linked to this track through release copies yet.</p>
      )}
    </section>
  )
}

function DigitalFilesSummary({
  summary,
}: {
  summary: ReturnType<typeof trackDigitalFileSummary>
}) {
  return (
    <dl
      className="track-digital-file-summary"
      aria-label="Digital file summary"
    >
      <div>
        <dt>Linked rows</dt>
        <dd>{summary.linkedFileRows}</dd>
      </div>
      <div>
        <dt>Unique files</dt>
        <dd>{summary.uniqueLocalFiles}</dd>
      </div>
      <div>
        <dt>Reused files</dt>
        <dd>{summary.reusedLocalFiles}</dd>
      </div>
      <div>
        <dt>Distinct paths</dt>
        <dd>{summary.distinctPaths}</dd>
      </div>
    </dl>
  )
}

type DigitalFileMetadataProps = {
  file: TrackDigitalFile
  files: readonly TrackDigitalFile[]
  onEditLocalFile?: () => void
}

function DigitalFileMetadata({
  file,
  files,
  onEditLocalFile,
}: DigitalFileMetadataProps) {
  const isReused = isReusedTrackDigitalFile(file, files)
  const hasDifferentPaths = isDifferentTrackDigitalFilePath(file, files)

  return (
    <article className="track-digital-file-card">
      <div className="track-digital-file-card-header">
        <div>
          <span className="badge badge-credit">
            {trackDigitalFilePositionLabel(file)}
          </span>
          <strong>{file.releaseTitle}</strong>
        </div>
        {onEditLocalFile ? (
          <button
            aria-label={`Edit file for ${file.releaseTitle} ${trackDigitalFilePositionLabel(file)}`}
            className="button button-secondary button-compact"
            type="button"
            onClick={onEditLocalFile}
          >
            Edit file
          </button>
        ) : null}
      </div>
      <div className="track-digital-file-path-row">
        <span className="badge badge-tag">{file.format}</span>
        <span className="track-digital-file-path" title={file.path}>
          {file.path}
        </span>
      </div>
      <div className="track-digital-file-state-row">
        {isReused ? (
          <span className="badge badge-tag">Same local file reused</span>
        ) : null}
        {hasDifferentPaths ? (
          <span className="badge badge-tag">Different file path</span>
        ) : null}
      </div>
      <dl className="detail-list">
        <div>
          <dt>Codec</dt>
          <dd>{file.codec}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{file.quality}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{file.duration}</dd>
        </div>
        <div>
          <dt>Bitrate</dt>
          <dd>{file.bitrate}</dd>
        </div>
        <div>
          <dt>Sample rate</dt>
          <dd>{file.sampleRate}</dd>
        </div>
        <div>
          <dt>Channels</dt>
          <dd>{file.channels}</dd>
        </div>
        <div>
          <dt>Checksum</dt>
          <dd>{file.contentHash}</dd>
        </div>
      </dl>
    </article>
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
