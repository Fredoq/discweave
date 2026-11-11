import { Search } from 'lucide-react'
import { useState } from 'react'
import { catalogEntityHref } from '../catalog/catalogLinks'
import {
  filterLabelReleases,
  type LabelCollectionFilter,
  type LabelRelease,
} from './labelCollection'

const filters: { value: LabelCollectionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'inCollection', label: 'In collection' },
  { value: 'wanted', label: 'Wanted' },
]

export function LabelReleasesSection({
  releases,
}: Readonly<{ releases: LabelRelease[] }>) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LabelCollectionFilter>('all')
  const visibleReleases = filterLabelReleases(releases, filter, query)

  return (
    <section className="detail-section" aria-labelledby="label-releases-title">
      <h3 id="label-releases-title">Releases on label</h3>
      <p className="label-collection-note">
        Releases recorded in your catalog, not the label’s full discography.
      </p>
      <div
        className="label-collection-filters"
        role="group"
        aria-label="Release collection status"
      >
        {filters.map((option) => (
          <button
            key={option.value}
            className="view-pill"
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label} (
            {filterLabelReleases(releases, option.value, '').length})
          </button>
        ))}
      </div>
      <label className="search-field label-release-search">
        <span className="search-icon" aria-hidden="true">
          <Search size={15} />
        </span>
        <span className="visually-hidden">Search releases on label</span>
        <input
          type="search"
          placeholder="Release, artist, year or catalog number"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="label-collection-note" role="status">
        {visibleReleases.length} of {releases.length} releases shown.
      </p>
      {visibleReleases.length > 0 ? (
        <ul className="label-release-list">
          {visibleReleases.map((release) => (
            <li key={release.id}>
              <div className="label-release-metadata">
                <span className="label-catalog-numbers">
                  <span className="visually-hidden">Catalog number: </span>
                  {release.catalogNumbers.join(' · ')}
                </span>
                <span>{release.year || 'Unknown year'}</span>
              </div>
              <a
                className="detail-link"
                href={catalogEntityHref({ kind: 'release', id: release.id })}
              >
                {release.title}
              </a>
              <span className="label-release-artist">
                {release.artist || 'Unknown artist'}
              </span>
              <span className="badge-list">
                {release.statuses.length > 0 ? (
                  release.statuses.map((status) => (
                    <span key={status} className="badge badge-media">
                      {status}
                    </span>
                  ))
                ) : (
                  <span className="label-collection-note">
                    No collection items
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="label-release-empty">
          <p>
            {releases.length === 0
              ? 'No releases recorded for this label yet.'
              : 'No releases match these filters.'}
          </p>
          {releases.length > 0 ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
            >
              Clear release filters
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
