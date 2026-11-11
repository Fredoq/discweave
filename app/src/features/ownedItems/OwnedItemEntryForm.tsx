import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  activeDictionaryLabels,
  type CatalogDictionaries,
} from '../catalog/catalogApi'
import { uniqueValues } from '../catalog/catalogGraph'
import '../manualEntry/manual-entry.css'
import {
  buildOwnedItemRecord,
  confirmMediumChange,
  findDuplicateCopy,
  ownedItemFormPresentation,
  initialCopyFields,
} from './ownedItemFormModel'
import type { ReleaseRecord } from '../releases/releasesData'
import {
  isDigitalMediumLabel,
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
  const [initial] = useState(() =>
    initialCopyFields(initialItem, scopedRelease),
  )
  const [title, setTitle] = useState(initial.title)
  const [selectedReleaseId, setSelectedReleaseId] = useState(initial.releaseId)
  const [scopeId] = useState(scopedRelease?.id)
  const [medium, setMedium] = useState(initial.medium)
  const [status, setStatus] = useState<OwnedItemStatus | ''>(initial.status)
  const initiallyDigital = initial.isDigital
  const [storage, setStorage] = useState(initial.storage)
  const [condition, setCondition] = useState(initial.condition)
  const [copyNote, setCopyNote] = useState(initial.copyNote)
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
  const { isValid, noteLabel, formTitle, submitLabel, requiredMessage } =
    ownedItemFormPresentation({
      title,
      scopeId,
      scopedRelease,
      initialItem,
      selectedRelease,
      isDigitalMedium,
    })
  const duplicateItem = findDuplicateCopy(
    items,
    initialItem,
    selectedRelease,
    medium,
    storage,
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
    if (!confirmMediumChange(initialItem, initiallyDigital, isDigitalMedium))
      return

    saving.current = true
    setPending(true)
    setError('')
    onPendingChange?.(true)
    try {
      const item = buildOwnedItemRecord(
        initialItem,
        selectedRelease,
        {
          title,
          medium,
          status,
          storage,
          condition,
          copyNote,
        },
        isDigitalMedium,
      )
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
