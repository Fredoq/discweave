import { Search } from 'lucide-react'
import type { RatingCriterion } from '../catalog/catalogApi'
import { RatingTableValue } from '../ratings/RatingsPanel'
import { ratingValueFor } from '../ratings/ratingUtils'
import type { ReleaseRecord } from './releasesData'
import {
  releaseCatalogNumberDisplay,
  releaseLabelEntries,
  releaseLabelNames,
} from './releaseFormHelpers'

type SearchFieldProps = {
  label: string
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
}

export function SearchField({
  label,
  placeholder,
  query,
  onQueryChange,
}: SearchFieldProps) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

type ReleaseTableProps = {
  releases: ReleaseRecord[]
  ratingCriteria: RatingCriterion[]
  selectedReleaseId: string
  onSelectRelease: (releaseId: string) => void
}

export function ReleaseTable({
  releases,
  ratingCriteria,
  selectedReleaseId,
  onSelectRelease,
}: ReleaseTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="release-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="release-results-title">Release records</h2>
          <p>Logical releases stay separate from concrete owned copies.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table releases-table">
          <thead>
            <tr>
              <th scope="col">Release</th>
              <th scope="col">Artist</th>
              <th scope="col">Year</th>
              <th scope="col">Label</th>
              <th scope="col">Catalog #</th>
              <th scope="col">Media</th>
              <th scope="col">Ownership</th>
              {ratingCriteria.map((criterion) => (
                <th key={criterion.id} scope="col">
                  {criterion.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr
                key={release.id}
                aria-selected={release.id === selectedReleaseId}
                className={
                  release.id === selectedReleaseId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectRelease(release.id)}
                  >
                    <strong>{release.title}</strong>
                    <span>{release.type}</span>
                  </button>
                </th>
                <td data-label="Artist">{release.artist}</td>
                <td data-label="Year">{release.year}</td>
                <td data-label="Label">
                  <ReleaseLabelsCell release={release} />
                </td>
                <td data-label="Catalog #">
                  <ReleaseCatalogNumbersCell release={release} />
                </td>
                <td data-label="Media">
                  <BadgeList
                    values={[
                      ...new Set(
                        release.ownedCopies.map((copy) => copy.medium),
                      ),
                    ]}
                    variant="media"
                  />
                </td>
                <td data-label="Ownership">
                  <BadgeList
                    values={[
                      ...new Set(
                        release.ownedCopies.map((copy) => copy.status),
                      ),
                    ]}
                    variant="tag"
                  />
                </td>
                {ratingCriteria.map((criterion) => (
                  <td data-label={criterion.name} key={criterion.id}>
                    <RatingTableValue
                      value={ratingValueFor(release.ratings, criterion.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReleaseLabelsCell({ release }: { release: ReleaseRecord }) {
  const labels = releaseLabelNames(release)

  if (labels.length === 0) {
    return <span className="release-table-empty">Unknown label</span>
  }

  return (
    <span className="release-label-stack">
      {labels.map((label) => (
        <span className="release-label-name" key={label}>
          {label}
        </span>
      ))}
    </span>
  )
}

function ReleaseCatalogNumbersCell({ release }: { release: ReleaseRecord }) {
  const labels = releaseLabelEntries(release)

  if (labels.length === 0) {
    return <span className="release-table-empty">Not recorded</span>
  }

  return (
    <span className="release-catalog-stack">
      {labels.map((label, index) => {
        const catalogNumber = releaseCatalogNumberDisplay(label)

        return (
          <span
            className={
              label.catalogNumber
                ? 'release-catalog-number'
                : 'release-catalog-number release-catalog-number-empty'
            }
            key={`${label.name}-${catalogNumber}-${index}`}
          >
            {catalogNumber}
          </span>
        )
      })}
    </span>
  )
}

function BadgeList({
  values,
  variant,
}: {
  values: string[]
  variant: 'media' | 'tag'
}) {
  if (values.length === 0) {
    return <span>None recorded</span>
  }

  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
          {value}
        </span>
      ))}
    </span>
  )
}
