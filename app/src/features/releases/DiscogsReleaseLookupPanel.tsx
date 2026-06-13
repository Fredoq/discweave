import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  CatalogApiError,
  getDiscogsRelease,
  searchDiscogsReleases,
  type CatalogDictionaries,
  type ExternalMetadataReleaseCandidateDto,
  type ExternalMetadataReleaseDetailDto,
} from '../catalog/catalogApi'
import { DiscogsCandidateReview } from './DiscogsCandidateReview'

export type DiscogsApplyGroups = {
  core: boolean
  artists: boolean
  classification: boolean
  labels: boolean
  tracklist: boolean
}

export type DiscogsSearchSeed = {
  artist: string
  catalogNumber: string
  title: string
  year: string
}

export type DiscogsCurrentRelease = {
  artists: string
  externalSourceCount: number
  genres: string
  labels: string
  releaseDate: string
  title: string
  trackCount: number
  year: string
}

type DiscogsReleaseLookupPanelProps = {
  current: DiscogsCurrentRelease
  dictionaries: CatalogDictionaries
  isOpen: boolean
  mode: 'create' | 'update'
  searchSeed: DiscogsSearchSeed
  trackImpactAction?: string
  onApplyDraft: (
    detail: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
  ) => void
  onOpenChange: (isOpen: boolean) => void
}

const emptyGroups: DiscogsApplyGroups = {
  core: false,
  artists: false,
  classification: false,
  labels: false,
  tracklist: false,
}

export function DiscogsReleaseLookupPanel({
  current,
  dictionaries,
  isOpen,
  mode,
  searchSeed,
  trackImpactAction,
  onApplyDraft,
  onOpenChange,
}: DiscogsReleaseLookupPanelProps) {
  const [query, setQuery] = useState('')
  const [artist, setArtist] = useState(searchSeed.artist)
  const [title, setTitle] = useState(searchSeed.title)
  const [year, setYear] = useState(searchSeed.year)
  const [catalogNumber, setCatalogNumber] = useState(searchSeed.catalogNumber)
  const [status, setStatus] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [candidates, setCandidates] = useState<
    ExternalMetadataReleaseCandidateDto[]
  >([])
  const [selectedDetail, setSelectedDetail] =
    useState<ExternalMetadataReleaseDetailDto | null>(null)
  const [applyGroups, setApplyGroups] = useState<DiscogsApplyGroups>(() =>
    defaultGroups(mode),
  )
  const wasOpen = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setArtist(searchSeed.artist)
      setTitle(searchSeed.title)
      setYear(searchSeed.year)
      setCatalogNumber(searchSeed.catalogNumber)
    }

    wasOpen.current = isOpen
  }, [isOpen, searchSeed])

  async function handleSearch() {
    setStatus('Searching Discogs release candidates.')
    setAppliedStatus('')
    setSelectedDetail(null)

    try {
      const result = await searchDiscogsReleases({
        query,
        artist,
        title,
        year,
        catalogNumber,
        limit: 25,
      })

      setCandidates(result.items)
      setStatus(
        result.items.length > 0
          ? `${result.total} candidate${result.total === 1 ? '' : 's'} found.`
          : 'No Discogs release candidates found.',
      )
    } catch (error) {
      setCandidates([])
      setStatus(externalMetadataErrorMessage(error))
    }
  }

  async function reviewCandidate(
    candidate: ExternalMetadataReleaseCandidateDto,
  ) {
    setStatus(`Loading Discogs detail for ${candidate.title}.`)
    setAppliedStatus('')

    try {
      const detail = await getDiscogsRelease(candidate.source.externalId)
      setSelectedDetail(detail)
      setApplyGroups(defaultGroups(mode))
      setStatus(`Review loaded for ${detail.title}.`)
    } catch (error) {
      setSelectedDetail(null)
      setStatus(externalMetadataErrorMessage(error))
    }
  }

  function updateApplyGroup(group: keyof DiscogsApplyGroups, checked: boolean) {
    setApplyGroups((groups) => ({ ...groups, [group]: checked }))
  }

  function handleApplyDraft(
    detail: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
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
  const selectedExternalId = selectedDetail?.source.externalId ?? ''

  return (
    <section
      className="manual-entry-wide release-form-section discogs-release-lookup"
      aria-label="Discogs release lookup"
      role="region"
    >
      <div className="release-form-section-header">
        <div>
          <h3>Discogs</h3>
          <p>Search release candidates and review fields before applying.</p>
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
                aria-label="Discogs query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Discogs artist</span>
              <input
                aria-label="Discogs artist"
                value={artist}
                onChange={(event) => setArtist(event.target.value)}
              />
            </label>
            <label>
              <span>Discogs title</span>
              <input
                aria-label="Discogs title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              <span>Discogs year</span>
              <input
                aria-label="Discogs year"
                inputMode="numeric"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </label>
            <label>
              <span>Discogs catalog number</span>
              <input
                aria-label="Discogs catalog number"
                value={catalogNumber}
                onChange={(event) => setCatalogNumber(event.target.value)}
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
              <span>Search Discogs releases</span>
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
                  className={
                    candidate.source.externalId === selectedExternalId
                      ? 'discogs-candidate is-selected'
                      : 'discogs-candidate'
                  }
                  key={candidate.source.externalId}
                >
                  <div className="discogs-candidate-summary">
                    <div>
                      <strong>{candidate.title}</strong>
                      <p>
                        {candidate.artists.join(', ') || 'Unknown artist'} ·{' '}
                        {candidate.year ?? 'Unknown year'} ·{' '}
                        {trackCountLabel(candidate.trackCount)}
                      </p>
                      <p>
                        {[...candidate.formats, candidate.catalogNumber]
                          .filter(Boolean)
                          .join(' · ')}
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
                        Open candidate Discogs source
                      </a>
                      <button
                        className="button button-secondary button-compact"
                        type="button"
                        onClick={() => {
                          void reviewCandidate(candidate)
                        }}
                      >
                        <span>Review {candidate.title}</span>
                      </button>
                    </div>
                  </div>
                  {selectedDetail?.source.externalId ===
                  candidate.source.externalId ? (
                    <DiscogsCandidateReview
                      applyGroups={applyGroups}
                      current={current}
                      detail={selectedDetail}
                      dictionaries={dictionaries}
                      hasSelectedGroup={hasSelectedGroup}
                      trackImpactAction={trackImpactAction}
                      onApplyDraft={handleApplyDraft}
                      onUpdateApplyGroup={updateApplyGroup}
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
            'Discogs lookup is optional and never saves data until the release form is submitted.'}
        </p>
      )}
    </section>
  )
}

function trackCountLabel(trackCount: number | null | undefined) {
  return typeof trackCount === 'number'
    ? `${trackCount} track${trackCount === 1 ? '' : 's'}`
    : 'Track count unknown'
}

function appliedGroupLabel(groups: DiscogsApplyGroups) {
  const labels = [
    groups.core ? 'core' : '',
    groups.artists ? 'artists' : '',
    groups.labels ? 'labels' : '',
    groups.classification ? 'classification' : '',
    groups.tracklist ? 'tracklist' : '',
  ].filter(Boolean)

  if (labels.length === 0) {
    return 'fields'
  }

  return labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}

function defaultGroups(mode: 'create' | 'update'): DiscogsApplyGroups {
  return mode === 'create'
    ? {
        core: true,
        artists: true,
        classification: true,
        labels: true,
        tracklist: true,
      }
    : emptyGroups
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
