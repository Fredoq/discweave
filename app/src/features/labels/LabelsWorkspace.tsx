import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { catalogEntityHref } from '../catalog/catalogLinks'
import { uniqueValues } from '../catalog/catalogGraph'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import { normalizedLabelName } from '../releases/releaseFormHelpers'
import type { LabelRecord } from './labelsData'

type LabelsWorkspaceProps = {
  isManualEntryOpen?: boolean
  labels: LabelRecord[]
  locationSearch?: string
  onAddLabel?: (label: LabelRecord) => void
  onDeleteLabel?: (labelId: string) => void
  onDeleteLabels?: (labelIds: string[]) => void
  onManualEntryClose?: () => void
  onUpdateLabel?: (label: LabelRecord) => void
  onUpdateLabels?: (labels: LabelRecord[]) => void
  ownedItems: OwnedItemRecord[]
  releases: ReleaseRecord[]
}

export function LabelsWorkspace({
  isManualEntryOpen = false,
  labels,
  locationSearch = window.location.search,
  onAddLabel,
  onDeleteLabel,
  onDeleteLabels,
  onManualEntryClose = () => {},
  onUpdateLabel,
  onUpdateLabels,
  ownedItems,
  releases,
}: LabelsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [manualLabels, setManualLabels] = useState<LabelRecord[]>([])
  const [editingLabelId, setEditingLabelId] = useState('')
  const allLabels = useMemo(
    () => [...labels, ...manualLabels],
    [labels, manualLabels],
  )
  const labelSummaries = useMemo(
    () => buildLabelSummaries(allLabels, releases, ownedItems),
    [allLabels, ownedItems, releases],
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
  const editingLabel = labelSummaries.find(
    (label) => label.id === editingLabelId,
  )

  function handleAddLabel(label: LabelRecord) {
    if (onAddLabel) {
      onAddLabel(label)
    } else {
      setManualLabels((currentLabels) => [...currentLabels, label])
    }

    setQuery('')
    selectLabel(label.id)
    onManualEntryClose()
  }

  function handleUpdateLabel(label: LabelRecord) {
    const labelIds = labelSummaries.find(
      (summary) => summary.id === editingLabelId,
    )?.labelIds ?? [label.id]
    const updatedLabels = labelIds.map((labelId) => ({
      ...label,
      id: labelId,
    }))

    if (onUpdateLabels) {
      onUpdateLabels(updatedLabels)
    } else if (onUpdateLabel) {
      updatedLabels.forEach(onUpdateLabel)
    } else {
      setManualLabels((currentLabels) =>
        currentLabels.map((currentLabel) =>
          labelIds.includes(currentLabel.id)
            ? { ...label, id: currentLabel.id }
            : currentLabel,
        ),
      )
    }

    setQuery('')
    selectLabel(labelIds[0] ?? label.id)
    setEditingLabelId('')
  }

  function handleDeleteLabels(labelIds: string[]) {
    if (onDeleteLabels) {
      onDeleteLabels(labelIds)
    } else if (onDeleteLabel) {
      labelIds.forEach(onDeleteLabel)
    } else {
      setManualLabels((currentLabels) =>
        currentLabels.filter((label) => !labelIds.includes(label.id)),
      )
    }

    setQuery('')
    setEditingLabelId('')
  }

  function handleEditLabel(labelId: string) {
    onManualEntryClose()
    setEditingLabelId(labelId)
  }

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

        {isManualEntryOpen && !editingLabel ? (
          <LabelEntryForm
            labels={allLabels}
            onCancel={onManualEntryClose}
            onSubmit={handleAddLabel}
          />
        ) : null}
        {editingLabel ? (
          <LabelEntryForm
            initialLabel={editingLabel}
            key={editingLabel.id}
            excludedDuplicateLabelIds={editingLabel.labelIds}
            labels={allLabels}
            onCancel={() => setEditingLabelId('')}
            onSubmit={handleUpdateLabel}
          />
        ) : null}

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
        <LabelDetailPanel
          label={selectedLabel}
          onDelete={() => handleDeleteLabels(selectedLabel.labelIds)}
          onEdit={() => handleEditLabel(selectedLabel.id)}
        />
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
  labelIds: string[]
  releases: ReleaseRecord[]
  ownedItems: OwnedItemRecord[]
  media: string[]
  statuses: string[]
}

export type LabelEntryFormProps = {
  excludedDuplicateLabelIds?: string[]
  labels: LabelRecord[]
  initialLabel?: LabelRecord
  onCancel: () => void
  onSubmit: (label: LabelRecord) => void
}

export function LabelEntryForm({
  excludedDuplicateLabelIds = [],
  labels,
  initialLabel,
  onCancel,
  onSubmit,
}: LabelEntryFormProps) {
  const [name, setName] = useState(initialLabel?.name ?? '')
  const isValid = name.trim().length > 0
  const normalizedName = name.trim().toLowerCase()
  const duplicateExcludedIds = new Set([
    initialLabel?.id,
    ...excludedDuplicateLabelIds,
  ])
  const duplicateLabel = labels.find(
    (label) =>
      !duplicateExcludedIds.has(label.id) &&
      label.name.trim().toLowerCase() === normalizedName,
  )
  const formTitle = initialLabel ? 'Edit label' : 'Add label'

  function handleSubmit() {
    const trimmedName = name.trim()

    onSubmit({
      id: initialLabel?.id ?? createManualRecordId('label', trimmedName),
      name: trimmedName,
    })
  }

  return (
    <ManualEntryPanel
      title={formTitle}
      requiredMessage="Name is required."
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel={initialLabel ? 'Save record' : 'Add record'}
    >
      <label>
        <span>Name</span>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      {duplicateLabel ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          Likely duplicate label: {duplicateLabel.name}. Submit is still allowed
          for this session.
        </p>
      ) : null}
    </ManualEntryPanel>
  )
}

function LabelDetailPanel({
  label,
  onDelete,
  onEdit,
}: {
  label: LabelSummary
  onDelete: () => void
  onEdit: () => void
}) {
  return (
    <aside
      className="panel detail-panel"
      aria-label={label.name}
      aria-labelledby="label-detail-title"
    >
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">Label</span>
          <span className="badge badge-tag">Editable collection record</span>
        </div>
        <h2 id="label-detail-title">{label.name}</h2>
        <p>
          {label.releases.length} releases · {label.ownedItems.length} owned
          copies
        </p>
        <div className="detail-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onEdit}
          >
            Edit record
          </button>
          <DeleteSessionRecordButton
            confirmationMessage={labelDeleteConfirmationMessage(label)}
            onDelete={onDelete}
          />
        </div>
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

function labelDeleteConfirmationMessage(label: LabelSummary) {
  if (label.labelIds.length === 1) {
    return 'Delete this label? Releases linked to it may prevent deletion.'
  }

  return `Delete ${label.labelIds.length} merged label records? Releases linked to them may prevent deletion.`
}

function buildLabelSummaries(
  labels: LabelRecord[],
  releases: ReleaseRecord[],
  ownedItems: OwnedItemRecord[],
): LabelSummary[] {
  const labelsByName = new Map<string, LabelRecord[]>()

  for (const label of labels) {
    const key = normalizedLabelName(label.name)
    labelsByName.set(key, [...(labelsByName.get(key) ?? []), label])
  }

  return [...labelsByName.values()].map((labelGroup) =>
    buildLabelSummary(labelGroup, releases, ownedItems),
  )
}

function buildLabelSummary(
  labelGroup: LabelRecord[],
  releases: ReleaseRecord[],
  ownedItems: OwnedItemRecord[],
): LabelSummary {
  const [primaryLabel] = labelGroup
  const labelIds = labelGroup.map((label) => label.id)
  const labelReleases = releases.filter((release) =>
    releaseHasLabel(release, primaryLabel.name, labelIds),
  )
  const releaseIds = new Set(labelReleases.map((release) => release.id))
  const labelOwnedItems = ownedItems.filter(
    (item) => item.releaseId !== undefined && releaseIds.has(item.releaseId),
  )

  return {
    ...primaryLabel,
    labelIds,
    releases: labelReleases,
    ownedItems: labelOwnedItems,
    media: uniqueValues(labelOwnedItems.map((item) => item.medium)),
    statuses: uniqueValues(labelOwnedItems.map((item) => item.status)),
  }
}

function releaseHasLabel(
  release: ReleaseRecord,
  labelName: string,
  labelIds: string[],
) {
  const labelIdSet = new Set(labelIds)
  const normalizedName = normalizedLabelName(labelName)

  return (
    normalizedLabelName(release.label) === normalizedName ||
    (release.labels ?? []).some(
      (releaseLabel) =>
        (releaseLabel.labelId !== undefined &&
          labelIdSet.has(releaseLabel.labelId)) ||
        normalizedLabelName(releaseLabel.name) === normalizedName,
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
