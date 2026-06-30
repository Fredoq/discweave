import { type ReactNode } from 'react'
import type {
  CatalogDictionaries,
  ExternalMetadataReleaseDraftArtistCreditDto,
  ExternalMetadataTrackCandidateDto,
  ExternalMetadataTrackDetailDto,
} from '../catalog/catalogApi'
import { formatDurationSeconds } from '../catalog/durationFormat'
import type {
  DiscogsCurrentTrack,
  DiscogsTrackApplyGroups,
} from './DiscogsTrackLookupPanel'

export function CandidateCard({
  applyGroups,
  candidate,
  current,
  detail,
  dictionaries,
  hasSelectedGroup,
  isSelected,
  onApplyDraft,
  onReview,
  onUpdateApplyGroup,
}: {
  applyGroups: DiscogsTrackApplyGroups
  candidate: ExternalMetadataTrackCandidateDto
  current: DiscogsCurrentTrack
  detail: ExternalMetadataTrackDetailDto | null
  dictionaries: CatalogDictionaries
  hasSelectedGroup: boolean
  isSelected: boolean
  onApplyDraft: (
    detail: ExternalMetadataTrackDetailDto,
    groups: DiscogsTrackApplyGroups,
  ) => void
  onReview: () => void
  onUpdateApplyGroup: (
    group: keyof DiscogsTrackApplyGroups,
    checked: boolean,
  ) => void
}) {
  return (
    <article className={`discogs-candidate${isSelected ? ' is-selected' : ''}`}>
      <div className="discogs-candidate-summary">
        <div>
          <strong>{candidate.title}</strong>
          <p>
            {candidate.position ?? 'Unnumbered'} ·{' '}
            {formatDurationSeconds(candidate.durationSeconds)}
          </p>
          <p>{joinOrEmpty(candidate.artists)}</p>
          <p>
            {candidate.release.title} ·{' '}
            {candidate.release.year ?? 'Unknown year'} ·{' '}
            {joinOrEmpty(candidate.release.artists)}
          </p>
          <p>{candidate.source.attribution}</p>
        </div>
        <div className="discogs-candidate-actions">
          <a
            className="detail-link"
            href={candidate.source.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open candidate Discogs track source
          </a>
          <button
            className="button button-secondary button-compact"
            type="button"
            onClick={onReview}
          >
            <span>Review {candidate.title}</span>
          </button>
        </div>
      </div>

      {detail ? (
        <DiscogsTrackCandidateReview
          applyGroups={applyGroups}
          current={current}
          detail={detail}
          dictionaries={dictionaries}
          hasSelectedGroup={hasSelectedGroup}
          onApplyDraft={onApplyDraft}
          onUpdateApplyGroup={onUpdateApplyGroup}
        />
      ) : null}
    </article>
  )
}

function DiscogsTrackCandidateReview({
  applyGroups,
  current,
  detail,
  dictionaries,
  hasSelectedGroup,
  onApplyDraft,
  onUpdateApplyGroup,
}: {
  applyGroups: DiscogsTrackApplyGroups
  current: DiscogsCurrentTrack
  detail: ExternalMetadataTrackDetailDto
  dictionaries: CatalogDictionaries
  hasSelectedGroup: boolean
  onApplyDraft: (
    detail: ExternalMetadataTrackDetailDto,
    groups: DiscogsTrackApplyGroups,
  ) => void
  onUpdateApplyGroup: (
    group: keyof DiscogsTrackApplyGroups,
    checked: boolean,
  ) => void
}) {
  return (
    <div className="discogs-review-panel">
      <div className="release-form-section-header">
        <div>
          <h3>Review Discogs track</h3>
          <p>
            {detail.source.attribution}{' '}
            <a
              className="detail-link"
              href={detail.source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Discogs track source
            </a>
          </p>
        </div>
      </div>

      <div className="discogs-impact-list">
        <ImpactRow
          checked={applyGroups.core}
          currentValue={trackCoreLabel(current.title, current.duration)}
          group="Core"
          nextValue={trackCoreLabel(
            detail.draft.title,
            formatDurationSeconds(detail.draft.durationSeconds),
          )}
          onChange={(checked) => onUpdateApplyGroup('core', checked)}
        />
        <ImpactRow
          checked={applyGroups.credits}
          currentValue={current.artists || 'Not recorded'}
          group="Credits"
          nextValue={`${detail.draft.artistCredits.length} Discogs credits`}
          onChange={(checked) => onUpdateApplyGroup('credits', checked)}
        >
          <CreditImpactList
            credits={detail.draft.artistCredits}
            dictionaries={dictionaries}
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

function CreditImpactList({
  credits,
  dictionaries,
}: {
  credits: ExternalMetadataReleaseDraftArtistCreditDto[]
  dictionaries: CatalogDictionaries
}) {
  if (credits.length === 0) {
    return <p className="discogs-impact-empty">No Discogs artist credits.</p>
  }

  return (
    <div className="discogs-credit-impact-list">
      {credits.map((credit, index) => (
        <CreditImpactRow
          credit={credit}
          dictionaries={dictionaries}
          key={`${credit.name}-${credit.role}-${index}`}
        />
      ))}
    </div>
  )
}

function CreditImpactRow({
  credit,
  dictionaries,
}: {
  credit: ExternalMetadataReleaseDraftArtistCreditDto
  dictionaries: CatalogDictionaries
}) {
  const role = roleLabelFromCode(credit.role, dictionaries)

  return (
    <div className="discogs-credit-impact-row">
      <strong>{credit.name}</strong>
      <span className="badge badge-credit">{role}</span>
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

function trackCoreLabel(title: string, duration: string) {
  return [title || 'Not recorded', duration || 'Unknown duration']
    .filter(Boolean)
    .join(' · ')
}

function joinOrEmpty(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'Not recorded'
}

function roleLabelFromCode(role: string, dictionaries: CatalogDictionaries) {
  const trimmedRole = role.trim()

  return (
    dictionaries.creditRole.find(
      (entry) => entry.code === trimmedRole || entry.name === trimmedRole,
    )?.name ?? trimmedRole
  )
}
