import type { Ref } from 'react'
import { playlistTouchesTrack } from '../catalog/catalogGraph'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { RatingsPanel } from '../ratings/RatingsPanel'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import {
  isDifferentTrackDigitalFilePath,
  isReusedTrackDigitalFile,
  trackDigitalFilePositionLabel,
  trackDigitalFileSummary,
  trackReleaseAppearances,
} from './trackDisplayHelpers'
import {
  CreditCard,
  PlaylistBacklinksSection,
  ReleaseAppearancesSection,
  TrackDetailHeader,
  TrackRelationsSection,
} from './TrackDetailSections'
import { trackDetailRelationGroups } from './trackDetailRelations'
import type { TrackDigitalFile, TrackRecord } from './tracksData'

type TrackDetailProps = Readonly<{
  addToStackButtonRef?: Ref<HTMLButtonElement>
  localFileCount?: number
  onAddToStack?: () => void
  onDelete?: () => void
  onEdit?: () => void
  onEditLocalFile?: (track: TrackRecord, file: TrackDigitalFile) => void
  onOpenLocalFiles?: () => void
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
}>

export function TrackDetail({
  addToStackButtonRef,
  localFileCount = 0,
  onAddToStack,
  onDelete,
  onEdit,
  onEditLocalFile,
  onOpenLocalFiles,
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
  const trackRelationGroups = trackDetailRelationGroups(track.relations)

  return (
    <aside className="panel detail-panel" aria-labelledby="track-detail-title">
      <TrackDetailHeader
        addToStackButtonRef={addToStackButtonRef}
        canUpdateViaDiscogs={canUpdateViaDiscogs}
        localFileCount={localFileCount}
        track={track}
        onAddToStack={onAddToStack}
        onDelete={onDelete}
        onEdit={onEdit}
        onOpenLocalFiles={onOpenLocalFiles}
        onUpdateViaDiscogs={onUpdateViaDiscogs}
      />

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

      <ReleaseAppearancesSection
        appearances={appearances}
        releasesById={releasesById}
      />

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

      <TrackRelationsSection
        relationGroups={trackRelationGroups}
        relationRecordIds={relationRecordIds}
      />

      <DigitalFilesInCollectionSection
        onEditLocalFile={onEditLocalFile}
        track={track}
      />

      <PlaylistBacklinksSection playlists={linkedPlaylists} />
    </aside>
  )
}

type DigitalFilesInCollectionSectionProps = {
  readonly onEditLocalFile?: (
    track: TrackRecord,
    file: TrackDigitalFile,
  ) => void
  readonly track: TrackRecord
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
  readonly summary: ReturnType<typeof trackDigitalFileSummary>
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
  readonly file: TrackDigitalFile
  readonly files: readonly TrackDigitalFile[]
  readonly onEditLocalFile?: () => void
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
