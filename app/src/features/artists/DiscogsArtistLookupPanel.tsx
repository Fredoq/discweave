import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  CatalogApiError,
  getDiscogsArtist,
  searchDiscogsArtists,
  type ExternalMetadataArtistCandidateDto,
  type ExternalMetadataArtistDetailDto,
} from '../catalog/catalogApi'

export type DiscogsArtistApplyGroups = {
  core: boolean
  externalSource: boolean
}

export type DiscogsCurrentArtist = {
  externalSourceCount: number
  name: string
  type: string
}

type DiscogsArtistLookupPanelProps = {
  current: DiscogsCurrentArtist
  isOpen: boolean
  mode: 'create' | 'update'
  searchSeed: string
  onApplyDraft: (
    detail: ExternalMetadataArtistDetailDto,
    groups: DiscogsArtistApplyGroups,
  ) => void
  onOpenChange: (isOpen: boolean) => void
}

const emptyGroups: DiscogsArtistApplyGroups = {
  core: false,
  externalSource: false,
}

export function DiscogsArtistLookupPanel({
  current,
  isOpen,
  mode,
  searchSeed,
  onApplyDraft,
  onOpenChange,
}: DiscogsArtistLookupPanelProps) {
  const [query, setQuery] = useState(searchSeed)
  const [status, setStatus] = useState('')
  const [candidates, setCandidates] = useState<
    ExternalMetadataArtistCandidateDto[]
  >([])
  const [selectedDetail, setSelectedDetail] =
    useState<ExternalMetadataArtistDetailDto | null>(null)
  const [applyGroups, setApplyGroups] = useState<DiscogsArtistApplyGroups>(() =>
    defaultGroups(mode),
  )
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

    try {
      const detail = await getDiscogsArtist(candidate.source.externalId)
      setSelectedDetail(detail)
      setApplyGroups(defaultGroups(mode))
      setStatus(`Review loaded for ${detail.name}.`)
    } catch (error) {
      setSelectedDetail(null)
      setStatus(externalMetadataErrorMessage(error))
    }
  }

  function updateApplyGroup(
    group: keyof DiscogsArtistApplyGroups,
    checked: boolean,
  ) {
    setApplyGroups((groups) => ({ ...groups, [group]: checked }))
  }

  const hasSelectedGroup = Object.values(applyGroups).some(Boolean)

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
                  className="discogs-candidate"
                  key={candidate.source.externalId}
                >
                  <div>
                    <strong>{candidate.name}</strong>
                    {candidate.profile ? <p>{candidate.profile}</p> : null}
                    {candidate.nameVariations.length > 0 ? (
                      <p>Variations: {candidate.nameVariations.join(', ')}</p>
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
                </article>
              ))}
            </div>
          ) : null}

          {selectedDetail ? (
            <div className="discogs-review-panel">
              <div className="release-form-section-header">
                <div>
                  <h3>Review Discogs artist</h3>
                  <p>
                    {selectedDetail.source.attribution}{' '}
                    <a
                      className="detail-link"
                      href={selectedDetail.source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Discogs artist source
                    </a>
                  </p>
                </div>
              </div>

              <div className="discogs-review-grid">
                <ReviewColumn
                  title="Current local artist"
                  rows={currentRows(current)}
                />
                <ReviewColumn
                  title="Discogs draft"
                  rows={discogsRows(selectedDetail)}
                />
              </div>

              <fieldset className="discogs-apply-groups">
                <legend>Apply groups</legend>
                <ApplyGroup
                  checked={applyGroups.core}
                  label="Apply Core"
                  onChange={(checked) => updateApplyGroup('core', checked)}
                />
                <ApplyGroup
                  checked={applyGroups.externalSource}
                  label="Apply External Source"
                  onChange={(checked) =>
                    updateApplyGroup('externalSource', checked)
                  }
                />
              </fieldset>

              <button
                className="button button-primary button-compact"
                type="button"
                disabled={!hasSelectedGroup}
                onClick={() => onApplyDraft(selectedDetail, applyGroups)}
              >
                Apply selected Discogs fields
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="release-section-note">
          Discogs lookup is optional and never saves data until the artist form
          is submitted.
        </p>
      )}
    </section>
  )
}

function defaultGroups(mode: 'create' | 'update'): DiscogsArtistApplyGroups {
  return mode === 'create'
    ? {
        core: true,
        externalSource: true,
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

function currentRows(current: DiscogsCurrentArtist) {
  return [
    ['Name', current.name || 'Not recorded'],
    ['Type', current.type || 'Not recorded'],
    ['Sources', `${current.externalSourceCount} sources`],
  ]
}

function discogsRows(detail: ExternalMetadataArtistDetailDto) {
  return [
    ['Name', detail.draft.name || 'Not recorded'],
    ['Aliases', detail.aliases.join(', ') || 'Not recorded'],
    ['Members', detail.members.join(', ') || 'Not recorded'],
    ['Variations', detail.nameVariations.join(', ') || 'Not recorded'],
    ['Profile', detail.profile ?? 'Not recorded'],
    ['Sources', `${detail.draft.externalSources.length} sources`],
  ]
}

function ReviewColumn({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="discogs-review-column">
      <h4>{title}</h4>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
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
