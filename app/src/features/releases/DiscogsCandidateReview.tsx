import type { ReactNode } from 'react'
import { useState } from 'react'
import type {
  CatalogDictionaries,
  ExternalMetadataReleaseDetailDto,
  ExternalMetadataReleaseDraftTrackDto,
} from '../catalog/catalogApi'
import { discogsDraftTrackRows } from './discogsReleaseTrackRows'
import type {
  DiscogsApplyGroups,
  DiscogsCurrentRelease,
} from './DiscogsReleaseLookupPanel'
import {
  discogsRoleLabelFromCode,
  groupDiscogsReviewCredits,
  hasCompilationTrackArtists,
  type GroupedDiscogsReviewCredit,
} from './discogsRoleUtils'

type DiscogsCandidateReviewProps = {
  applyGroups: DiscogsApplyGroups
  current: DiscogsCurrentRelease
  detail: ExternalMetadataReleaseDetailDto
  dictionaries: CatalogDictionaries
  hasSelectedGroup: boolean
  trackImpactAction?: string
  onApplyDraft: (
    detail: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
  ) => void
  onUpdateApplyGroup: (
    group: keyof DiscogsApplyGroups,
    checked: boolean,
  ) => void
}

export function DiscogsCandidateReview({
  applyGroups,
  current,
  detail,
  dictionaries,
  hasSelectedGroup,
  trackImpactAction = 'create track',
  onApplyDraft,
  onUpdateApplyGroup,
}: DiscogsCandidateReviewProps) {
  const compilationDetected = hasCompilationTrackArtists(detail)
  const reviewTracks = discogsDraftTrackRows(detail.draft.tracklist)
  const draftGenres = detail.draft.genres ?? []

  return (
    <div className="discogs-review-panel">
      <div className="release-form-section-header">
        <div>
          <h3>Review Discogs candidate</h3>
          <p>
            {detail.source.attribution}{' '}
            <a
              className="detail-link"
              href={detail.source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Discogs source
            </a>
          </p>
        </div>
      </div>

      <div className="discogs-impact-list">
        <ImpactRow
          checked={applyGroups.core}
          currentValue={[
            current.title || 'Not recorded',
            current.releaseDate || current.year,
          ]
            .filter(Boolean)
            .join(' · ')}
          group="Core"
          nextValue={[
            detail.draft.title,
            detail.draft.releaseDate || detail.draft.year?.toString(),
          ]
            .filter(Boolean)
            .join(' · ')}
          onChange={(checked) => onUpdateApplyGroup('core', checked)}
        />
        <ImpactRow
          checked={applyGroups.artists}
          currentValue={current.artists || 'Not recorded'}
          group="Artists"
          nextValue={`${detail.draft.artistCredits.length} Discogs credits`}
          onChange={(checked) => onUpdateApplyGroup('artists', checked)}
        >
          <ArtistImpactList
            credits={detail.draft.artistCredits}
            dictionaries={dictionaries}
          />
        </ImpactRow>
        <ImpactRow
          checked={applyGroups.labels}
          currentValue={current.labels || 'Not recorded'}
          group="Labels"
          nextValue={releaseLabelSummary(detail) || 'Not recorded'}
          onChange={(checked) => onUpdateApplyGroup('labels', checked)}
        />
        <ImpactRow
          checked={applyGroups.classification}
          currentValue={current.genres || 'Not recorded'}
          group="Classification"
          nextValue={
            draftGenres.length > 0 ? draftGenres.join(', ') : 'Not recorded'
          }
          onChange={(checked) => onUpdateApplyGroup('classification', checked)}
        />
        <ImpactRow
          checked={applyGroups.tracklist}
          currentValue={`${current.trackCount} rows`}
          group="Tracklist"
          nextValue={`${reviewTracks.length} Discogs rows`}
          onChange={(checked) => onUpdateApplyGroup('tracklist', checked)}
        >
          {compilationDetected ? (
            <p className="discogs-impact-warning">
              Compilation detected: track-specific artists differ from release
              artists. Applying Tracklist will mark the release as Various
              Artists and write track-level artist credits.
            </p>
          ) : null}
          <TrackImpactList
            dictionaries={dictionaries}
            tracks={reviewTracks}
            trackImpactAction={trackImpactAction}
          />
        </ImpactRow>
      </div>

      <button
        className="button button-primary button-compact"
        type="button"
        disabled={!hasSelectedGroup}
        onClick={() => onApplyDraft(detail, applyGroups)}
      >
        Apply selected Discogs fields
      </button>
    </div>
  )
}

function ImpactRow({
  checked,
  children,
  currentValue,
  group,
  nextValue,
  onChange,
}: {
  checked: boolean
  children?: ReactNode
  currentValue: string
  group: string
  nextValue: string
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="discogs-impact-row">
      <ApplyGroup
        checked={checked}
        label={`Apply ${group}`}
        onChange={onChange}
      />
      <div className="discogs-impact-group">{group}</div>
      <div className="discogs-impact-value">
        <span>Current</span>
        <strong>{currentValue}</strong>
      </div>
      <div className="discogs-impact-value">
        <span>Discogs</span>
        <strong>{nextValue}</strong>
        {children ? (
          <div className="discogs-impact-detail">{children}</div>
        ) : null}
      </div>
    </div>
  )
}

function ArtistImpactList({
  credits,
  dictionaries,
}: {
  credits: ExternalMetadataReleaseDetailDto['draft']['artistCredits']
  dictionaries: CatalogDictionaries
}) {
  if (credits.length === 0) {
    return <p className="discogs-impact-empty">No Discogs artist credits.</p>
  }

  return (
    <div className="discogs-credit-impact-list">
      {groupDiscogsReviewCredits(credits).map((credit) => (
        <CreditImpactRow
          credit={credit}
          dictionaries={dictionaries}
          key={credit.name}
        />
      ))}
    </div>
  )
}

function TrackImpactList({
  dictionaries,
  tracks,
  trackImpactAction,
}: {
  dictionaries: CatalogDictionaries
  tracks: ExternalMetadataReleaseDraftTrackDto[]
  trackImpactAction: string
}) {
  const [showAllTracks, setShowAllTracks] = useState(false)
  const previewTracks = showAllTracks ? tracks : tracks.slice(0, 4)
  const hiddenCount = tracks.length - previewTracks.length

  if (tracks.length === 0) {
    return <p className="discogs-impact-empty">No Discogs track rows.</p>
  }

  return (
    <div className="discogs-track-impact-list">
      {previewTracks.map((track, index) => {
        const trackContext = discogsTrackContext(track)
        const trackKey = `${track.disc ?? ''}-${track.side ?? ''}-${track.position}-${track.title}-${index}`

        return (
          <div className="discogs-track-impact-row" key={trackKey}>
            <span className="discogs-track-impact-position">
              {track.position}
            </span>
            <div>
              <strong>{track.title}</strong>
              <p>
                {[trackContext, trackDurationLabel(track), trackImpactAction]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {track.artistCredits.length > 0 ? (
                <div className="discogs-credit-impact-list">
                  {groupDiscogsReviewCredits(track.artistCredits).map(
                    (credit) => (
                      <CreditImpactRow
                        credit={credit}
                        dictionaries={dictionaries}
                        key={`${trackKey}-${credit.name}`}
                      />
                    ),
                  )}
                </div>
              ) : (
                <p className="discogs-impact-empty">
                  Inherits release artists.
                </p>
              )}
            </div>
          </div>
        )
      })}
      {hiddenCount > 0 ? (
        <button
          className="button button-secondary button-compact discogs-track-toggle"
          type="button"
          aria-expanded={showAllTracks}
          onClick={() => setShowAllTracks(true)}
        >
          Show {hiddenCount} more Discogs track row
          {hiddenCount === 1 ? '' : 's'}
        </button>
      ) : showAllTracks && tracks.length > 4 ? (
        <button
          className="button button-secondary button-compact discogs-track-toggle"
          type="button"
          aria-expanded={showAllTracks}
          onClick={() => setShowAllTracks(false)}
        >
          Show fewer Discogs track rows
        </button>
      ) : null}
    </div>
  )
}

function discogsTrackContext(track: ExternalMetadataReleaseDraftTrackDto) {
  return [
    track.disc?.trim(),
    track.side?.trim() ? `Side ${track.side.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function trackDurationLabel(track: ExternalMetadataReleaseDraftTrackDto) {
  return track.durationSeconds
    ? formatDurationSeconds(track.durationSeconds)
    : 'No duration'
}

function CreditImpactRow({
  credit,
  dictionaries,
}: {
  credit: GroupedDiscogsReviewCredit
  dictionaries: CatalogDictionaries
}) {
  return (
    <div className="discogs-credit-impact-row">
      <strong>{credit.name}</strong>
      <span className="discogs-credit-role-list">
        {credit.roles.map((role) => (
          <span className="badge badge-credit" key={role}>
            {discogsRoleLabelFromCode(role, dictionaries)}
          </span>
        ))}
      </span>
    </div>
  )
}

function ApplyGroup({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="compact-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function releaseLabelSummary(detail: ExternalMetadataReleaseDetailDto) {
  return detail.draft.labels
    .map((label) => [label.name, label.catalogNumber].filter(Boolean).join(' '))
    .join(', ')
}

function formatDurationSeconds(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
