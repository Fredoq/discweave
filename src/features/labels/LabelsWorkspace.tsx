import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { catalogEntityHref } from '../catalog/catalogLinks'
import { uniqueValues } from '../catalog/catalogGraph'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { LabelRecord } from './labelsData'

type LabelsWorkspaceProps = {
  labels: LabelRecord[]
  locationSearch?: string
  ownedItems: OwnedItemRecord[]
  releases: ReleaseRecord[]
}

export function LabelsWorkspace({
  labels,
  locationSearch = window.location.search,
  ownedItems,
  releases,
}: LabelsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const labelSummaries = useMemo(
    () => labels.map((label) => buildLabelSummary(label, releases, ownedItems)),
    [labels, ownedItems, releases],
  )
  const visibleLabels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return labelSummaries
    }

    return labelSummaries.filter((label) =>
      [
        label.name,
        ...label.releases.map((release) => release.title),
        ...label.ownedItems.map((item) => item.title),
        ...label.media,
        ...label.statuses,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [labelSummaries, query])
  const { selectedRecord: selectedLabel, selectRecord: selectLabel } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'label',
      records: labelSummaries,
      routePath: '/labels',
      visibleRecords: visibleLabels,
    })

  return (
    <section className="catalog-layout" aria-label="Labels workspace">
      <div className="catalog-main">
        <label className="search-field">
          <span className="search-icon" aria-hidden="true">
            <Search size={17} strokeWidth={2.2} />
          </span>
          <span className="visually-hidden">Search labels</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Label, release, media, status or catalog context"
          />
        </label>

        <section className="panel catalog-panel" aria-labelledby="labels-title">
          <div className="panel-heading">
            <div>
              <h2 id="labels-title">Label index</h2>
              <p>
                {visibleLabels.length} shown from {labelSummaries.length}{' '}
                labels.
              </p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="catalog-table workspace-table">
              <thead>
                <tr>
                  <th scope="col">Label</th>
                  <th scope="col">Releases</th>
                  <th scope="col">Media</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleLabels.map((label) => (
                  <tr
                    key={label.id}
                    aria-selected={label.id === selectedLabel?.id}
                    className={
                      label.id === selectedLabel?.id ? 'is-selected' : undefined
                    }
                  >
                    <th scope="row">
                      <button
                        className="row-title"
                        type="button"
                        onClick={() => selectLabel(label.id)}
                      >
                        <strong>{label.name}</strong>
                        <span>{label.releases.length} releases</span>
                      </button>
                    </th>
                    <td data-label="Releases">{label.releases.length}</td>
                    <td data-label="Media">
                      <BadgeList values={label.media} />
                    </td>
                    <td data-label="Status">
                      <BadgeList values={label.statuses} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedLabel ? (
        <LabelDetailPanel label={selectedLabel} />
      ) : (
        <aside className="panel detail-panel empty-detail-panel">
          <div className="detail-header">
            <span className="entity-type">No label</span>
            <h2>No matching labels.</h2>
          </div>
        </aside>
      )}
    </section>
  )
}

type LabelSummary = LabelRecord & {
  releases: ReleaseRecord[]
  ownedItems: OwnedItemRecord[]
  media: string[]
  statuses: string[]
}

function LabelDetailPanel({ label }: { label: LabelSummary }) {
  return (
    <aside
      className="panel detail-panel"
      aria-label={label.name}
      aria-labelledby="label-detail-title"
    >
      <div className="detail-header">
        <span className="entity-type">Label</span>
        <h2 id="label-detail-title">{label.name}</h2>
        <p>
          {label.releases.length} releases · {label.ownedItems.length} owned
          copies
        </p>
      </div>

      <section
        className="detail-section"
        aria-labelledby="label-releases-title"
      >
        <h3 id="label-releases-title">Releases on label</h3>
        <GraphLinkList
          items={label.releases.map((release) => ({
            id: release.id,
            href: catalogEntityHref({ kind: 'release', id: release.id }),
            title: release.title,
            subtitle: [release.artist, release.year]
              .filter(Boolean)
              .join(' · '),
          }))}
        />
      </section>

      <section className="detail-section" aria-labelledby="label-owned-title">
        <h3 id="label-owned-title">Owned coverage</h3>
        <GraphLinkList
          items={label.ownedItems.map((item) => ({
            id: item.id,
            href: catalogEntityHref({ kind: 'ownedItem', id: item.id }),
            title: item.title,
            subtitle: [item.medium, item.status].filter(Boolean).join(' · '),
          }))}
        />
      </section>

      <section className="detail-section" aria-labelledby="label-media-title">
        <h3 id="label-media-title">Media coverage</h3>
        <BadgeList values={label.media} />
      </section>
    </aside>
  )
}

function buildLabelSummary(
  label: LabelRecord,
  releases: ReleaseRecord[],
  ownedItems: OwnedItemRecord[],
): LabelSummary {
  const labelReleases = releases.filter((release) =>
    releaseHasLabel(release, label),
  )
  const releaseIds = new Set(labelReleases.map((release) => release.id))
  const labelOwnedItems = ownedItems.filter(
    (item) => item.releaseId !== undefined && releaseIds.has(item.releaseId),
  )

  return {
    ...label,
    releases: labelReleases,
    ownedItems: labelOwnedItems,
    media: uniqueValues(labelOwnedItems.map((item) => item.medium)),
    statuses: uniqueValues(labelOwnedItems.map((item) => item.status)),
  }
}

function releaseHasLabel(release: ReleaseRecord, label: LabelRecord) {
  return (
    release.label === label.name ||
    (release.labels ?? []).some(
      (releaseLabel) =>
        releaseLabel.labelId === label.id || releaseLabel.name === label.name,
    )
  )
}

function GraphLinkList({
  items,
}: {
  items: { id: string; href: string; title: string; subtitle: string }[]
}) {
  if (items.length === 0) {
    return <p className="detail-summary">None recorded.</p>
  }

  return (
    <ul className="graph-link-list">
      {items.map((item) => (
        <li key={item.id}>
          <a className="detail-link" href={item.href}>
            {item.title}
          </a>
          <span>{item.subtitle}</span>
        </li>
      ))}
    </ul>
  )
}

function BadgeList({ values }: { values: string[] }) {
  const unique = uniqueValues(values)

  if (unique.length === 0) {
    return <span>None recorded</span>
  }

  return (
    <span className="badge-list">
      {unique.map((value) => (
        <span key={value} className="badge badge-media">
          {value}
        </span>
      ))}
    </span>
  )
}
