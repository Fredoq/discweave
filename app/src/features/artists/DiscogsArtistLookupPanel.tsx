import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  CatalogApiError,
  getDiscogsArtist,
  searchDiscogsArtists,
  type ExternalMetadataArtistCandidateDto,
  type ExternalMetadataArtistDetailDto,
} from '../catalog/catalogApi'
import type { ArtistType } from './artistsData'

export type DiscogsCurrentArtist = {
  externalSourceCount: number
  name: string
  type: string
}

type DiscogsArtistLookupPanelProps = {
  current: DiscogsCurrentArtist
  isOpen: boolean
  searchSeed: string
  onApplyDraft: (detail: ExternalMetadataArtistDetailDto) => void
  onOpenChange: (isOpen: boolean) => void
}

export function DiscogsArtistLookupPanel({
  current,
  isOpen,
  searchSeed,
  onApplyDraft,
  onOpenChange,
}: DiscogsArtistLookupPanelProps) {
  const [query, setQuery] = useState(searchSeed)
  const [status, setStatus] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [candidates, setCandidates] = useState<
    ExternalMetadataArtistCandidateDto[]
  >([])
  const [selectedDetail, setSelectedDetail] =
    useState<ExternalMetadataArtistDetailDto | null>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setQuery(searchSeed)
    }

    wasOpen.current = isOpen
  }, [isOpen, searchSeed])

  async function handleSearch() {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setCandidates([])
      setSelectedDetail(null)
      setStatus('Enter an artist name to search.')
      return
    }

    setStatus('Searching Discogs artist candidates.')
    setAppliedStatus('')
    setSelectedDetail(null)

    try {
      const result = await searchDiscogsArtists({
        query: trimmedQuery,
        limit: 25,
      })
      setCandidates(result.items)
      setStatus(
        result.items.length > 0
          ? `${result.total} candidate${result.total === 1 ? '' : 's'} found.`
          : 'No Discogs artist candidates found.',
      )
    } catch (error) {
      setCandidates([])
      setStatus(externalMetadataErrorMessage(error))
    }
  }

  async function reviewCandidate(
    candidate: ExternalMetadataArtistCandidateDto,
  ) {
    setStatus(`Loading Discogs detail for ${candidate.name}.`)
    setAppliedStatus('')

    try {
      const detail = await getDiscogsArtist(candidate.source.externalId)
      setSelectedDetail(detail)
      setStatus(`Review loaded for ${detail.name}.`)
    } catch (error) {
      setSelectedDetail(null)
      setStatus(externalMetadataErrorMessage(error))
    }
  }

  function handleApplyDraft(detail: ExternalMetadataArtistDetailDto) {
    onApplyDraft(detail)
    setAppliedStatus(
      'Applied Discogs artist data to the form. Save record to persist changes.',
    )
    setCandidates([])
    setSelectedDetail(null)
    onOpenChange(false)
  }

  const selectedExternalId = selectedDetail?.source.externalId ?? ''

  return (
    <section
      className="manual-entry-wide release-form-section discogs-release-lookup"
      aria-label="Discogs artist lookup"
      role="region"
    >
      <div className="release-form-section-header">
        <div>
          <h3>Discogs</h3>
          <p>Search artist candidates and review fields before applying.</p>
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
            <label>
              <span>Discogs query</span>
              <input
                aria-label="Discogs artist query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className="button button-secondary button-compact"
              type="button"
              onClick={() => {
                void handleSearch()
              }}
            >
              <Search size={14} aria-hidden="true" />
              <span>Search Discogs artists</span>
            </button>
          </div>

          {status ? (
            <p className="discogs-lookup-status" role="status">
              {status}
            </p>
          ) : null}

          {candidates.length > 0 ? (
            <div className="discogs-candidate-list">
              {candidates.map((candidate) => (
                <article
                  aria-label={candidate.name}
                  className={
                    candidate.source.externalId === selectedExternalId
                      ? 'discogs-candidate is-selected'
                      : 'discogs-candidate'
                  }
                  key={candidate.source.externalId}
                >
                  <div className="discogs-candidate-summary">
                    <div>
                      <strong>{candidate.name}</strong>
                      {candidate.profile ? <p>{candidate.profile}</p> : null}
                      {candidate.nameVariations.length > 0 ? (
                        <p>
                          Variations: {candidate.nameVariations.join(', ')}
                        </p>
                      ) : null}
                      <p>{candidate.source.attribution}</p>
                    </div>
                    <div className="discogs-candidate-actions">
                      <a
                        className="detail-link"
                        href={candidate.source.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open candidate Discogs artist source
                      </a>
                      <button
                        className="button button-secondary button-compact"
                        type="button"
                        onClick={() => {
                          void reviewCandidate(candidate)
                        }}
                      >
                        <span>Review {candidate.name}</span>
                      </button>
                    </div>
                  </div>
                  {selectedDetail?.source.externalId ===
                  candidate.source.externalId ? (
                    <ArtistDiscogsCandidateReview
                      current={current}
                      detail={selectedDetail}
                      onApplyDraft={handleApplyDraft}
                    />
                  ) : null}
                </article>
              ))}
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
            'Discogs lookup is optional and never saves data until the artist form is submitted.'}
        </p>
      )}
    </section>
  )
}

function ArtistDiscogsCandidateReview({
  current,
  detail,
  onApplyDraft,
}: {
  current: DiscogsCurrentArtist
  detail: ExternalMetadataArtistDetailDto
  onApplyDraft: (detail: ExternalMetadataArtistDetailDto) => void
}) {
  return (
    <div className="discogs-review-panel">
      <div className="release-form-section-header">
        <div>
          <h3>Review Discogs artist</h3>
          <p>
            {detail.source.attribution}{' '}
            <a
              className="detail-link"
              href={detail.source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Discogs artist source
            </a>
          </p>
        </div>
      </div>

      <div className="discogs-impact-list">
        <ReadOnlyImpactRow
          group="Core"
          currentValue={current.name || 'Not recorded'}
          nextValue={detail.draft.name || detail.name || 'Not recorded'}
        />
        <ReadOnlyImpactRow
          group="Type"
          currentValue={current.type || 'Not recorded'}
          nextValue={artistTypeFromDiscogs(detail)}
        />
        <ReadOnlyImpactRow
          group="Aliases"
          currentValue="Local aliases unchanged"
          nextValue={summaryList(detail.aliases)}
        />
        <ReadOnlyImpactRow
          group="Members"
          currentValue="Local member relations unchanged"
          nextValue={memberSummary(detail.members)}
        />
        <ReadOnlyImpactRow
          group="External source"
          currentValue={`${current.externalSourceCount} sources`}
          nextValue="Discogs source will be applied"
        />
      </div>

      <button
        className="button button-primary button-compact"
        type="button"
        onClick={() => onApplyDraft(detail)}
      >
        Apply Discogs data
      </button>
    </div>
  )
}

function ReadOnlyImpactRow({
  group,
  currentValue,
  nextValue,
}: {
  group: string
  currentValue: string
  nextValue: string
}) {
  return (
    <div className="discogs-impact-row discogs-impact-row-readonly">
      <strong className="discogs-impact-group">{group}</strong>
      <div className="discogs-impact-value">
        <span>Current</span>
        <strong>{currentValue}</strong>
      </div>
      <div className="discogs-impact-value">
        <span>Discogs</span>
        <strong>{nextValue}</strong>
      </div>
    </div>
  )
}

function artistTypeFromDiscogs(
  detail: ExternalMetadataArtistDetailDto,
): ArtistType {
  return detail.members.some((member) => member.trim().length > 0)
    ? 'Band'
    : 'Person'
}

function summaryList(values: string[]) {
  const recordedValues = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return recordedValues.length > 0 ? recordedValues.join(', ') : 'Not recorded'
}

function memberSummary(values: string[]) {
  const recordedValues = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return recordedValues.length > 0
    ? recordedValues.join(', ')
    : 'No members in Discogs detail'
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
