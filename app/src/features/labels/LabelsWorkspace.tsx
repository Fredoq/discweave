import { DateAddedSortSelect } from '../catalog/DateAddedSortSelect'
import { useDateAddedSort } from '../catalog/dateAddedSort'
import { MoreHorizontal, Pencil, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { uniqueValues } from '../catalog/catalogGraph'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import { normalizedLabelName } from '../releases/releaseFormHelpers'
import type { LabelRecord } from './labelsData'
import { TrackAverages } from '../ratings/RatingsPanel'
import { useTrackAverages } from '../ratings/ratingAverages'
import { LabelReleasesSection } from './LabelReleasesSection'
import { LabelDiscogsCatalog } from './LabelDiscogsCatalog'
import {
  buildLabelSummaries,
  labelSearchText,
  type LabelSummary,
} from './labelCollection'
import './labels.css'

type LabelsWorkspaceProps = {
  isManualEntryOpen?: boolean
  labels: LabelRecord[]
  locationSearch?: string
  onAddLabel?: (label: LabelRecord) => void
  onDeleteLabel?: (labelId: string) => void
  onNavigateToUrl?: (url: string) => boolean
  onManualEntryClose?: () => void
  onUpdateLabel?: (label: LabelRecord) => void
  ownedItems: OwnedItemRecord[]
  releases: ReleaseRecord[]
}

export function LabelsWorkspace({
  isManualEntryOpen = false,
  labels,
  locationSearch = window.location.search,
  onAddLabel,
  onDeleteLabel,
  onManualEntryClose = () => {},
  onNavigateToUrl = navigateLabelCatalog,
  onUpdateLabel,
  ownedItems,
  releases,
}: Readonly<LabelsWorkspaceProps>) {
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
  const filteredLabels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return labelSummaries
    }

    return labelSummaries.filter((label) =>
      labelSearchText(label).includes(normalizedQuery),
    )
  }, [labelSummaries, query])
  const {
    sort,
    setSort,
    sortedRecords: visibleLabels,
  } = useDateAddedSort(filteredLabels, 'labels')

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
    if (onUpdateLabel) {
      onUpdateLabel(label)
    } else {
      setManualLabels((currentLabels) =>
        currentLabels.map((currentLabel) =>
          currentLabel.id === label.id ? label : currentLabel,
        ),
      )
    }

    setQuery('')
    selectLabel(label.id)
    setEditingLabelId('')
  }

  function handleDeleteLabel(labelId: string) {
    if (onDeleteLabel) {
      onDeleteLabel(labelId)
    } else {
      setManualLabels((currentLabels) =>
        currentLabels.filter((label) => label.id !== labelId),
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
    <section className="labels-workspace" aria-label="Labels workspace">
      <nav className="labels-rail" aria-labelledby="labels-title">
        <div className="labels-rail-header">
          <span className="labels-eyebrow">Collection</span>
          <h2 id="labels-title">Labels</h2>
          <label className="search-field labels-index-search">
            <span className="search-icon" aria-hidden="true">
              <Search size={15} />
            </span>
            <span className="visually-hidden">Search labels</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search labels…"
            />
          </label>
          <div className="labels-rail-meta">
            <span
              aria-label={`${visibleLabels.length} shown from ${labelSummaries.length} labels.`}
            >
              {visibleLabels.length} labels
            </span>
            <span className="visually-hidden">
              {visibleLabels.length} shown from {labelSummaries.length} labels.
            </span>
            <DateAddedSortSelect value={sort} onChange={setSort} />
          </div>
        </div>
        <ul className="labels-index-list">
          {visibleLabels.map((label) => (
            <li key={label.id}>
              <button
                type="button"
                aria-current={
                  label.id === selectedLabel?.id ? 'true' : undefined
                }
                onClick={() => selectLabel(label.id)}
              >
                <span>{label.name}</span>
                <span
                  className="labels-index-count"
                  aria-label={`${label.releases.length} releases`}
                >
                  {label.releases.length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="labels-content">
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
            key={`edit-${editingLabel.id}`}
            labels={allLabels}
            onCancel={() => setEditingLabelId('')}
            onSubmit={handleUpdateLabel}
          />
        ) : null}
        {selectedLabel ? (
          <LabelDetailPanel
            key={`detail-${selectedLabel.id}`}
            label={selectedLabel}
            onNavigateToUrl={onNavigateToUrl}
            onDelete={() => handleDeleteLabel(selectedLabel.id)}
            onEdit={() => handleEditLabel(selectedLabel.id)}
          />
        ) : (
          <div className="labels-empty">
            <h2>No matching labels.</h2>
          </div>
        )}
      </div>
    </section>
  )
}

export type LabelEntryFormProps = {
  labels: LabelRecord[]
  initialLabel?: LabelRecord
  onCancel: () => void
  onSubmit: (label: LabelRecord) => void
}

export function LabelEntryForm({
  labels,
  initialLabel,
  onCancel,
  onSubmit,
}: Readonly<LabelEntryFormProps>) {
  const [name, setName] = useState(initialLabel?.name ?? '')
  const normalizedName = normalizedLabelName(name)
  const duplicateLabel = labels.find(
    (label) =>
      label.id !== initialLabel?.id &&
      normalizedLabelName(label.name) === normalizedName,
  )
  const hasDuplicateLabel = duplicateLabel !== undefined
  const isValid = name.trim().length > 0 && !hasDuplicateLabel
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
        <output className="manual-entry-warning manual-entry-wide">
          This label already exists.
        </output>
      ) : null}
    </ManualEntryPanel>
  )
}

function LabelDetailPanel({
  label,
  onNavigateToUrl,
  onDelete,
  onEdit,
}: Readonly<{
  label: LabelSummary
  onNavigateToUrl: (url: string) => boolean
  onDelete: () => void
  onEdit: () => void
}>) {
  const [view, setView] = useState<'collection' | 'discogs'>('collection')
  return (
    <aside
      className="labels-main"
      aria-label={label.name}
      aria-labelledby="label-detail-title"
    >
      <div className="labels-workspace-header">
        <div className="labels-heading-row">
          <div>
            <div className="detail-title-row">
              <span className="entity-type">Label</span>
              <span className="badge badge-tag">
                Editable collection record
              </span>
            </div>
            <h2 id="label-detail-title">{label.name}</h2>
            <p>
              {label.releases.length} releases · {label.ownedItems.length}{' '}
              collection items
            </p>
          </div>
          <div className="labels-heading-actions">
            <button
              className="button button-secondary"
              type="button"
              aria-label="Edit record"
              onClick={onEdit}
            >
              <Pencil size={14} aria-hidden="true" /> Edit
              <span className="visually-hidden"> record</span>
            </button>
            <details className="labels-more-actions">
              <summary aria-label="More label actions">
                <MoreHorizontal size={16} aria-hidden="true" />
              </summary>
              <div>
                <DeleteSessionRecordButton
                  confirmationMessage={labelDeleteConfirmationMessage()}
                  onDelete={onDelete}
                />
              </div>
            </details>
          </div>
        </div>

        <fieldset className="label-collection-filters labels-view-switch">
          <legend className="visually-hidden">Label catalog view</legend>
          <button
            type="button"
            className="view-pill"
            aria-pressed={view === 'collection'}
            onClick={() => setView('collection')}
          >
            Collection
          </button>
          <button
            type="button"
            className="view-pill"
            aria-pressed={view === 'discogs'}
            onClick={() => setView('discogs')}
          >
            Discogs catalog
          </button>
        </fieldset>
      </div>
      {view === 'discogs' ? (
        <LabelDiscogsCatalog
          key={label.id}
          labelId={label.id}
          labelName={label.name}
          onNavigate={onNavigateToUrl}
        />
      ) : (
        <div className="labels-collection-content">
          <LabelTrackAverages labelId={label.id} />
          <LabelReleasesSection releases={label.releases} />

          <section
            className="detail-section"
            aria-labelledby="label-media-title"
          >
            <h3 id="label-media-title">Media coverage</h3>
            <BadgeList values={label.media} />
          </section>
        </div>
      )}
    </aside>
  )
}

function labelDeleteConfirmationMessage() {
  return 'Delete this label? Releases linked to it may prevent deletion.'
}

function BadgeList({ values }: Readonly<{ values: string[] }>) {
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

function LabelTrackAverages({ labelId }: Readonly<{ labelId: string }>) {
  const averages = useTrackAverages('label', labelId)

  return averages.length > 0 ? (
    <section className="detail-section" aria-label="Ratings">
      <TrackAverages averages={averages} targetType="label" />
    </section>
  ) : null
}

function navigateLabelCatalog(url: string) {
  window.history.pushState({}, '', url)
  window.dispatchEvent(new Event('discweave:navigation'))
  return true
}
