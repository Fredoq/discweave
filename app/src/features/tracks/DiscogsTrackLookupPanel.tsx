import { Search } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  CatalogApiError,
  getDiscogsTrack,
  searchDiscogsTracks,
  type CatalogDictionaries,
  type ExternalMetadataReleaseDraftArtistCreditDto,
  type ExternalMetadataTrackCandidateDto,
  type ExternalMetadataTrackDetailDto,
} from '../catalog/catalogApi'
import { formatDurationSeconds } from '../catalog/durationFormat'

export type DiscogsTrackApplyGroups = {
  core: boolean
  credits: boolean
}

export type DiscogsTrackSearchSeed = {
  artist: string
  catalogNumber: string
  releaseTrackCount: string
  releaseTitle: string
  title: string
  year: string
}

export type DiscogsCurrentTrack = {
  artists: string
  duration: string
  title: string
}

type DiscogsTrackLookupPanelProps = {
  current: DiscogsCurrentTrack
  dictionaries: CatalogDictionaries
  isOpen: boolean
  mode: 'create' | 'update'
  searchSeed: DiscogsTrackSearchSeed
  onApplyDraft: (
    detail: ExternalMetadataTrackDetailDto,
    groups: DiscogsTrackApplyGroups,
  ) => void
  onOpenChange: (isOpen: boolean) => void
}

const emptyGroups: DiscogsTrackApplyGroups = {
  core: false,
  credits: false,
}

export function DiscogsTrackLookupPanel({
  current,
  dictionaries,
  isOpen,
  mode,
  searchSeed,
  onApplyDraft,
  onOpenChange,
}: DiscogsTrackLookupPanelProps) {
  const [title, setTitle] = useState(searchSeed.title)
  const [artist, setArtist] = useState(searchSeed.artist)
  const [releaseTitle, setReleaseTitle] = useState(searchSeed.releaseTitle)
  const [year, setYear] = useState(searchSeed.year)
  const [catalogNumber, setCatalogNumber] = useState(searchSeed.catalogNumber)
  const [releaseTrackCount, setReleaseTrackCount] = useState(
    searchSeed.releaseTrackCount,
  )
  const [status, setStatus] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [candidates, setCandidates] = useState<
    ExternalMetadataTrackCandidateDto[]
  >([])
  const [selectedDetail, setSelectedDetail] =
    useState<ExternalMetadataTrackDetailDto | null>(null)
  const [applyGroups, setApplyGroups] = useState<DiscogsTrackApplyGroups>(() =>
    defaultGroups(mode),
  )
  const wasOpen = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setTitle(searchSeed.title)
      setArtist(searchSeed.artist)
      setReleaseTitle(searchSeed.releaseTitle)
      setYear(searchSeed.year)
      setCatalogNumber(searchSeed.catalogNumber)
      setReleaseTrackCount(searchSeed.releaseTrackCount)
    }

    wasOpen.current = isOpen
  }, [isOpen, searchSeed])

  async function handleSearch() {
    setStatus('Searching Discogs track candidates.')
    setAppliedStatus('')
    setSelectedDetail(null)

    try {
      const result = await searchDiscogsTracks({
        title,
        artist,
        releaseTitle,
        year,
        catalogNumber,
        trackCount: releaseTrackCount,
        limit: 25,
      })

      setCandidates(result.items)
      setStatus(
        result.items.length > 0
          ? `${result.total} candidate${result.total === 1 ? '' : 's'} found.`
          : 'No Discogs track candidates found.',
      )
    } catch (error) {
      setCandidates([])
      setStatus(externalMetadataErrorMessage(error))
    }
  }

  async function reviewCandidate(candidate: ExternalMetadataTrackCandidateDto) {
    setStatus(`Loading Discogs detail for ${candidate.title}.`)
    setAppliedStatus('')

    try {
      const detail = await getDiscogsTrack(candidate.source.externalId)
      setSelectedDetail(detail)
      setApplyGroups(defaultGroups(mode))
      setStatus(`Review loaded for ${detail.title}.`)
    } catch (error) {
      setSelectedDetail(null)
      setStatus(externalMetadataErrorMessage(error))
    }
  }

  function updateApplyGroup(
    group: keyof DiscogsTrackApplyGroups,
    checked: boolean,
  ) {
    setApplyGroups((groups) => ({ ...groups, [group]: checked }))
  }

  function handleApplyDraft(
    detail: ExternalMetadataTrackDetailDto,
    groups: DiscogsTrackApplyGroups,
  ) {
    onApplyDraft(detail, groups)
    setAppliedStatus(
      `Applied Discogs ${appliedGroupLabel(groups)} to the form. Save record to persist changes.`,
    )
    setCandidates([])
    setSelectedDetail(null)
    onOpenChange(false)
  }

  const hasSelectedGroup = Object.values(applyGroups).some(Boolean)

  return (
    <section
      className="manual-entry-wide release-form-section discogs-release-lookup discogs-track-lookup"
      aria-label="Discogs track lookup"
      role="region"
    >
      <div className="release-form-section-header">
        <div>
          <h3>Discogs</h3>
          <p>Search track candidates and review fields before applying.</p>
        </div>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={() => onOpenChange(!isOpen)}
        >
          <Search size={14} aria-hidden="true" />
          {isOpen ? 'Hide Discogs' : 'Search Discogs'}
        </button>
      </div>

      {isOpen ? (
        <>
          <div className="discogs-search-form">
            <LookupInput
              label="Discogs track title"
              value={title}
              onChange={setTitle}
            />
            <LookupInput
              label="Discogs artist"
              value={artist}
              onChange={setArtist}
            />
            <LookupInput
              label="Discogs release title"
              value={releaseTitle}
              onChange={setReleaseTitle}
            />
            <LookupInput label="Discogs year" value={year} onChange={setYear} />
            <LookupInput
              label="Discogs catalog number"
              value={catalogNumber}
              onChange={setCatalogNumber}
            />
            <LookupInput
              inputMode="numeric"
              label="Discogs release track count"
              type="number"
              value={releaseTrackCount}
              onChange={setReleaseTrackCount}
            />
            <button
              className="button button-secondary button-compact"
              type="button"
              onClick={() => {
                void handleSearch()
              }}
            >
              <Search size={14} aria-hidden="true" />
              <span>Search Discogs tracks</span>
            </button>
          </div>

          {status ? (
            <p className="discogs-lookup-status" role="status">
              {status}
            </p>
          ) : null}

          {candidates.length > 0 ? (
            <div className="discogs-candidate-list">
              {candidates.map((candidate) => {
                const isSelected =
                  selectedDetail?.source.externalId ===
                  candidate.source.externalId

                return (
                  <CandidateCard
                    applyGroups={applyGroups}
                    candidate={candidate}
                    current={current}
                    detail={isSelected ? selectedDetail : null}
                    dictionaries={dictionaries}
                    hasSelectedGroup={hasSelectedGroup}
                    isSelected={isSelected}
                    key={candidate.source.externalId}
                    onApplyDraft={handleApplyDraft}
                    onReview={() => {
                      void reviewCandidate(candidate)
                    }}
                    onUpdateApplyGroup={updateApplyGroup}
                  />
                )
              })}
            </div>
          ) : null}
        </>
      ) : (
        <p
          className={
            appliedStatus ? 'discogs-apply-status' : 'release-section-note'
          }
          role={appliedStatus ? 'status' : undefined}
        >
          {appliedStatus ||
            'Discogs lookup is optional and never saves data until the track form is submitted.'}
        </p>
      )}
    </section>
  )
}

function CandidateCard({
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

function defaultGroups(mode: 'create' | 'update'): DiscogsTrackApplyGroups {
  return mode === 'create'
    ? {
        core: true,
        credits: true,
      }
    : emptyGroups
}

function appliedGroupLabel(groups: DiscogsTrackApplyGroups) {
  const labels = [
    groups.core ? 'core' : '',
    groups.credits ? 'credits' : '',
  ].filter(Boolean)

  if (labels.length === 0) {
    return 'fields'
  }

  return labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}

function externalMetadataErrorMessage(error: unknown) {
  if (error instanceof CatalogApiError) {
    const retry =
      error.retryAfter && error.status === 429
        ? ` Retry after ${error.retryAfter} seconds.`
        : ''

    return `${error.message}${retry}`
  }

  return 'External metadata provider is unavailable.'
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

function LookupInput({
  inputMode,
  label,
  type = 'text',
  value,
  onChange,
}: {
  inputMode?: 'numeric'
  label: string
  type?: 'number' | 'text'
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        aria-label={label}
        inputMode={inputMode}
        min={type === 'number' ? '1' : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
