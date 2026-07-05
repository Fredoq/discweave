import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  CatalogApiError,
  getDiscogsTrack,
  searchDiscogsTracks,
  type CatalogDictionaries,
  type DiscogsTrackSearchSort,
  type ExternalMetadataTrackCandidateDto,
  type ExternalMetadataTrackDetailDto,
} from '../catalog/catalogApi'
import { CandidateCard } from './DiscogsTrackCandidateCard'
import { DiscogsLookupInput } from './DiscogsLookupInput'

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
  autoFocusOnOpen?: boolean
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
  autoFocusOnOpen = false,
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
  const [sort, setSort] = useState<DiscogsTrackSearchSort>('discogsRelevance')
  const [page, setPage] = useState(1)
  const [resultLimit, setResultLimit] = useState(25)
  const [resultTotal, setResultTotal] = useState(0)
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
  const panelRef = useRef<HTMLElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)
  const didAutoFocus = useRef(false)
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

    if (!isOpen && wasOpen.current) {
      didAutoFocus.current = false
    }

    wasOpen.current = isOpen
  }, [isOpen, searchSeed])

  useEffect(() => {
    if (!autoFocusOnOpen || !isOpen || didAutoFocus.current) {
      return
    }

    didAutoFocus.current = true
    panelRef.current?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    })
    firstInputRef.current?.focus()
  }, [autoFocusOnOpen, isOpen])

  async function runSearch(nextPage: number) {
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
        page: nextPage,
        sort,
        limit: 25,
      })

      const resultPage = result.page || nextPage
      const resultLimitValue = result.limit || 25
      const resultPageCount = Math.ceil(result.total / resultLimitValue)
      setCandidates(result.items)
      setPage(resultPage)
      setResultLimit(resultLimitValue)
      setResultTotal(result.total)
      setStatus(
        discogsTrackCandidateStatus(
          result.items.length,
          resultPage,
          resultPageCount,
        ),
      )
    } catch (error) {
      setCandidates([])
      setResultTotal(0)
      setStatus(externalMetadataErrorMessage(error))
    }
  }

  function handleSearch() {
    void runSearch(1)
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
  const totalPages = resultLimit > 0 ? Math.ceil(resultTotal / resultLimit) : 0
  const hasMultiplePages = totalPages > 1
  const canGoPrevious = page > 1
  const canGoNext = hasMultiplePages && page < totalPages

  return (
    <section
      className="manual-entry-wide release-form-section discogs-release-lookup discogs-track-lookup"
      aria-label="Discogs track lookup"
      ref={panelRef}
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
            <DiscogsLookupInput
              inputRef={firstInputRef}
              label="Discogs track title"
              value={title}
              onChange={setTitle}
            />
            <DiscogsLookupInput
              label="Discogs artist"
              value={artist}
              onChange={setArtist}
            />
            <DiscogsLookupInput
              label="Discogs release title"
              value={releaseTitle}
              onChange={setReleaseTitle}
            />
            <DiscogsLookupInput
              label="Discogs year"
              value={year}
              onChange={setYear}
            />
            <DiscogsLookupInput
              label="Discogs catalog number"
              value={catalogNumber}
              onChange={setCatalogNumber}
            />
            <DiscogsLookupInput
              inputMode="numeric"
              label="Discogs release track count"
              type="number"
              value={releaseTrackCount}
              onChange={setReleaseTrackCount}
            />
            <button
              className="button button-secondary button-compact"
              type="button"
              onClick={handleSearch}
            >
              <Search size={14} aria-hidden="true" />
              <span>Search Discogs tracks</span>
            </button>
          </div>

          <div className="discogs-result-controls">
            <div className="discogs-result-controls-spacer" />
            <label className="discogs-sort-control">
              <span>Sort</span>
              <select
                aria-label="Discogs track result sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.currentTarget.value as DiscogsTrackSearchSort)
                  setPage(1)
                }}
              >
                <option value="discogsRelevance">Discogs relevance</option>
                <option value="releaseYearAsc">Year oldest first</option>
                <option value="releaseYearDesc">Year newest first</option>
              </select>
            </label>
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

          {hasMultiplePages ? (
            <div
              className="discogs-pagination"
              aria-label="Discogs result pages"
            >
              <button
                className="button button-secondary button-compact"
                type="button"
                disabled={!canGoPrevious}
                aria-label="Previous page"
                onClick={() => {
                  void runSearch(page - 1)
                }}
              >
                <ChevronLeft size={14} aria-hidden="true" />
                <span>Previous</span>
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                className="button button-secondary button-compact"
                type="button"
                disabled={!canGoNext}
                aria-label="Next page"
                onClick={() => {
                  void runSearch(page + 1)
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
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

function discogsTrackCandidateStatus(
  candidateCount: number,
  page: number,
  pageCount: number,
) {
  if (candidateCount === 0) {
    return 'No Discogs track candidates found.'
  }

  const candidateLabel = `candidate${candidateCount === 1 ? '' : 's'}`
  if (pageCount > 1) {
    return `${candidateCount} ${candidateLabel} shown · page ${page} of ${pageCount}.`
  }

  return `${candidateCount} ${candidateLabel} found.`
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
