import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  activeDictionaryLabels,
  type CatalogDictionaries,
} from '../catalog/catalogApi'
import { uniqueValues } from '../catalog/catalogGraph'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import '../manualEntry/manual-entry.css'
import type { ReleaseRecord } from '../releases/releasesData'
import {
  isDigitalMediumLabel,
  isDigitalOwnedItem,
  type OwnedItemRecord,
  type OwnedItemStatus,
} from './ownedItemsData'

export type OwnedItemMutationResult = void | boolean | Promise<void | boolean>

export type OwnedItemEntryFormProps = {
  dictionaries: CatalogDictionaries
  initialItem?: OwnedItemRecord
  items: OwnedItemRecord[]
  onCancel: () => void
  releases: ReleaseRecord[]
  scopedRelease?: ReleaseRecord
  onPendingChange?: (pending: boolean) => void
  onSubmit: (item: OwnedItemRecord) => OwnedItemMutationResult
}

export function OwnedItemEntryForm({
  dictionaries,
  initialItem,
  items,
  onCancel,
  releases,
  scopedRelease,
  onPendingChange,
  onSubmit,
}: Readonly<OwnedItemEntryFormProps>) {
  const mediaTypeOptions = uniqueValues([
    ...activeDictionaryLabels(dictionaries, 'mediaType'),
    initialItem?.medium ?? '',
  ])
  const [title, setTitle] = useState(
    initialItem?.title ?? scopedRelease?.title ?? '',
  )
  const [selectedReleaseId, setSelectedReleaseId] = useState(
    initialItem?.releaseId ?? initialItem?.targetId ?? '',
  )
  const [scopeId] = useState(scopedRelease?.id)
  const [medium, setMedium] = useState(initialItem?.medium ?? '')
  const [status, setStatus] = useState<OwnedItemStatus | ''>(
    initialItem?.status === 'Not recorded' ? '' : (initialItem?.status ?? ''),
  )
  const initiallyDigital = Boolean(
    initialItem && isDigitalOwnedItem(initialItem),
  )
  const [storage, setStorage] = useState(
    initiallyDigital ? '' : (initialItem?.storage ?? ''),
  )
  const [condition, setCondition] = useState(
    initiallyDigital ? '' : (initialItem?.condition ?? ''),
  )
  const [copyNote, setCopyNote] = useState(initialItem?.copyNotes ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const mounted = useRef(false)
  const isDigitalMedium =
    initialItem?.medium === medium
      ? initiallyDigital
      : isDigitalMediumLabel(medium)
  const selectedRelease =
    scopedRelease ?? releases.find((record) => record.id === selectedReleaseId)
  const initialReleaseId =
    initialItem?.releaseId ?? initialItem?.targetId ?? initialItem?.target?.id
  const validScope =
    !scopedRelease ||
    (scopeId === scopedRelease.id &&
      (!initialReleaseId || initialReleaseId === scopedRelease.id))
  const isValid =
    title.trim().length > 0 && Boolean(selectedRelease) && validScope
  const noteLabel = scopedRelease
    ? 'Copy note'
    : isDigitalMedium
      ? 'Digital copy note'
      : 'Digitization note'
  const formTitle = scopedRelease
    ? initialItem
      ? 'Edit copy'
      : 'Add copy'
    : initialItem
      ? 'Edit owned item'
      : 'Add owned item'
  const submitLabel = scopedRelease
    ? initialItem
      ? 'Save copy'
      : 'Add copy'
    : initialItem
      ? 'Save record'
      : 'Add record'
  const requiredMessage = !validScope
    ? 'This copy belongs to a different release. Reopen the editor.'
    : title.trim().length === 0
      ? 'Item name is required.'
      : 'Select an existing release.'
  const duplicateItem = items.find(
    (item) =>
      item.id !== initialItem?.id &&
      selectedRelease &&
      (item.releaseId ?? item.targetId ?? item.target?.id) ===
        selectedRelease.id &&
      item.medium.toLowerCase() === medium.trim().toLowerCase() &&
      item.storage.toLowerCase() === storage.trim().toLowerCase(),
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValid || !selectedRelease || saving.current) return
    const losesFileLinks =
      initiallyDigital &&
      !isDigitalMedium &&
      Math.max(
        initialItem?.digitalDetails?.linkedFileCount ?? 0,
        initialItem?.digitalDetails?.files.length ?? 0,
      ) > 0
    if (
      losesFileLinks &&
      !window.confirm(
        'Changing this digital copy to a physical medium will remove its track-file links. The audio files themselves will not be deleted. Continue?',
      )
    )
      return

    saving.current = true
    setPending(true)
    setError('')
    onPendingChange?.(true)
    try {
      const itemStatus = status || 'Not recorded'
      const unchangedMedium = initialItem?.medium === medium
      const item: OwnedItemRecord = {
        ...initialItem,
        id: initialItem?.id ?? createManualRecordId('owned-item', title.trim()),
        title: title.trim(),
        targetType: 'Release',
        targetId: selectedRelease.id,
        target: initialItem?.target
          ? {
              ...initialItem.target,
              id: selectedRelease.id,
              title: selectedRelease.title,
            }
          : undefined,
        releaseId: selectedRelease.id,
        releaseTitle: selectedRelease.title,
        artist: selectedRelease.artist,
        medium: textOrFallback(medium, 'Unspecified medium'),
        mediumType: unchangedMedium
          ? initialItem?.mediumType
          : isDigitalMedium
            ? 'digital'
            : undefined,
        physicalDetails:
          unchangedMedium && initialItem?.physicalDetails
            ? {
                ...initialItem.physicalDetails,
                storageLocation: storage.trim(),
                condition: condition.trim(),
              }
            : undefined,
        digitalDetails: unchangedMedium
          ? initialItem?.digitalDetails
          : undefined,
        status: itemStatus,
        statusTone: statusToneFor(itemStatus),
        storage: isDigitalMedium
          ? unchangedMedium
            ? (initialItem?.storage ?? 'Digital copy')
            : 'Digital copy'
          : textOrFallback(storage, 'No storage recorded'),
        condition: isDigitalMedium
          ? unchangedMedium
            ? (initialItem?.condition ?? 'Digital copy recorded')
            : 'Digital copy recorded'
          : textOrFallback(condition, 'No condition recorded'),
        acquisition: initialItem?.acquisition ?? 'Manual entry',
        copyNotes: copyNote.trim(),
        linkedType: 'Release',
        fileFormat: unchangedMedium
          ? (initialItem?.fileFormat ?? 'None recorded')
          : 'None recorded',
        digitalState: unchangedMedium
          ? (initialItem?.digitalState ?? 'No digital file recorded')
          : isDigitalMedium
            ? 'Digital copy recorded'
            : 'No digital file recorded',
        digitizationState:
          unchangedMedium && initialItem
            ? initialItem.digitizationState
            : isDigitalMedium
              ? 'Digital source only'
              : copyNote.trim(),
        tags: initialItem?.tags ?? ['manual entry'],
      }
      const result = await onSubmit(item)
      if (result === false && mounted.current)
        setError(
          'The copy could not be saved. Your changes are still here; try again.',
        )
    } catch (saveError: unknown) {
      if (mounted.current)
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'The copy could not be saved. Try again.',
        )
    } finally {
      saving.current = false
      if (mounted.current) {
        setPending(false)
        onPendingChange?.(false)
      }
    }
  }

  return (
    <form
      className="panel manual-entry-panel"
      aria-label={formTitle}
      aria-busy={pending}
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      <div className="manual-entry-header">
        {!scopedRelease ? (
          <div>
            <h2>{formTitle}</h2>
            <p>Keep copy details separate from release metadata.</p>
          </div>
        ) : null}
        <div className="manual-entry-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={!isValid || pending}
          >
            {pending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <p
        className="manual-entry-validation"
        aria-live="polite"
        role={isValid ? undefined : 'alert'}
      >
        {isValid
          ? 'Optional metadata can be filled in later.'
          : requiredMessage}
      </p>
      <fieldset
        className="manual-entry-grid"
        disabled={pending}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <legend className="visually-hidden">Copy details</legend>
        {!scopedRelease ? (
          <label>
            <span>Item name</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
        ) : null}
        {duplicateItem && medium.trim() && storage.trim() ? (
          <output className="manual-entry-warning manual-entry-wide">
            Likely duplicate owned item for {duplicateItem.releaseTitle},{' '}
            {duplicateItem.medium}, {duplicateItem.storage}. Saving another copy
            is still allowed.
          </output>
        ) : null}
        {scopedRelease ? (
          <div>
            <span>Release</span>
            <p>{scopedRelease.title}</p>
          </div>
        ) : (
          <label>
            <span>Existing release</span>
            <select
              value={selectedReleaseId}
              onChange={(event) => setSelectedReleaseId(event.target.value)}
            >
              <option value="">Select a release</option>
              {releases.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Medium</span>
          <select
            value={medium}
            onChange={(event) => setMedium(event.target.value)}
          >
            <option value="">Not recorded</option>
            {mediaTypeOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Ownership status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as OwnedItemStatus | '')
            }
          >
            <option value="">Not recorded</option>
            <option>Owned</option>
            <option>Wanted</option>
            <option>Sold</option>
            <option>Needs digitization</option>
          </select>
        </label>
        {isDigitalMedium ? null : (
          <>
            <label>
              <span>Storage location</span>
              <input
                value={storage}
                onChange={(event) => setStorage(event.target.value)}
              />
            </label>
            <label>
              <span>Condition</span>
              <input
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
              />
            </label>
          </>
        )}
        <label className="manual-entry-wide">
          <span>{noteLabel}</span>
          <textarea
            value={copyNote}
            onChange={(event) => setCopyNote(event.target.value)}
            rows={3}
          />
        </label>
      </fieldset>
    </form>
  )
}

function statusToneFor(status: OwnedItemStatus): OwnedItemRecord['statusTone'] {
  switch (status) {
    case 'Owned':
      return 'green'
    case 'Wanted':
      return 'blue'
    case 'Needs digitization':
      return 'amber'
    default:
      return 'gray'
  }
}
