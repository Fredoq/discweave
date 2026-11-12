import { useRef, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import {
  activeDictionaryLabels,
  type CatalogDictionaries,
} from '../catalog/catalogApi'
import {
  findCatalogOption,
  type CatalogLink,
  type CatalogLinkOption,
} from '../catalog/catalogLinks'
import type { RelationRecord } from './relationsData'
import {
  linkValue,
  validRelationPeriod,
  relationValidationMessage,
  relationSubmitLabel,
} from './relationEntryFormHelpers'

export type RelationEntryFormProps = {
  dictionaries: CatalogDictionaries
  initialRelation?: RelationRecord
  initialSourceLink?: CatalogLink
  lockSource?: boolean
  lockEndpoints?: boolean
  linkOptions: CatalogLinkOption[]
  relations: RelationRecord[]
  onCancel: () => void
  onSubmit: (
    relation: RelationRecord,
  ) => void | boolean | Promise<void | boolean>
}

export function RelationEntryForm({
  dictionaries,
  initialRelation,
  initialSourceLink,
  lockSource = false,
  lockEndpoints = false,
  linkOptions,
  relations,
  onCancel,
  onSubmit,
}: Readonly<RelationEntryFormProps>) {
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sourceValue, setSourceValue] = useState(
    linkValue(initialRelation?.sourceLink ?? initialSourceLink),
  )
  const [targetValue, setTargetValue] = useState(
    initialRelation?.targetLink
      ? `${initialRelation.targetLink.kind}:${initialRelation.targetLink.id}`
      : '',
  )
  const [relationType, setRelationType] = useState(
    initialRelation?.relationType ?? '',
  )
  const [startYear, setStartYear] = useState(
    initialRelation?.startYear?.toString() ?? '',
  )
  const [endYear, setEndYear] = useState(
    initialRelation?.endYear?.toString() ?? '',
  )
  const source = findCatalogOption(linkOptions, sourceValue)
  const target = findCatalogOption(linkOptions, targetValue)
  const originalKind = initialRelation?.sourceLink?.kind
  const supportedOriginal =
    !initialRelation ||
    ((originalKind === 'artist' || originalKind === 'track') &&
      initialRelation.targetLink?.kind === originalKind)
  const sourceOptions = linkOptions.filter(
    (option) =>
      (option.kind === 'artist' || option.kind === 'track') &&
      (!initialRelation || option.kind === originalKind),
  )
  const targetOptions = linkOptions.filter(
    (option) => option.kind === source?.kind && option.value !== sourceValue,
  )
  const kind =
    source?.kind === 'artist' ? 'artistRelationType' : 'trackRelationType'
  const typeOptions = source ? activeDictionaryLabels(dictionaries, kind) : []
  const preservedType = initialRelation?.relationType === relationType
  const validType = relationType !== '' && typeOptions.includes(relationType)
  const validPeriod = validRelationPeriod(source?.kind, startYear, endYear)
  const duplicate = relations.some(
    (relation) =>
      relation.id !== initialRelation?.id &&
      relation.sourceLink?.kind === source?.kind &&
      relation.sourceLink?.id === source?.id &&
      relation.targetLink?.id === target?.id &&
      relation.relationType.toLowerCase() === relationType.toLowerCase() &&
      (source?.kind !== 'artist' ||
        ((relation.startYear ?? null) ===
          (startYear ? Number(startYear) : null) &&
          (relation.endYear ?? null) === (endYear ? Number(endYear) : null))),
  )
  const isValid = Boolean(
    supportedOriginal &&
    source?.kind === target?.kind &&
    source?.id !== target?.id &&
    validType &&
    validPeriod &&
    !duplicate,
  )

  async function submit() {
    if (!isValid || !source || !target || pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError('')
    const period = [startYear, endYear].filter(Boolean).join('–')
    try {
      const saved = await onSubmit({
        id:
          initialRelation?.id ??
          createManualRecordId('relation', `${source.id}-${target.id}`),
        source: source.name,
        sourceLink: { kind: source.kind, id: source.id },
        sourceType: source.typeLabel,
        target: target.name,
        targetLink: { kind: target.kind, id: target.id },
        targetType: target.typeLabel,
        relationType,
        role: relationType,
        startYear:
          source.kind === 'artist' && startYear ? Number(startYear) : null,
        endYear: source.kind === 'artist' && endYear ? Number(endYear) : null,
        context: source.kind === 'artist' ? period : '',
        evidence: source.kind === 'artist' ? period : '',
        linkedEntity: target.name,
        linkedEntityLink: { kind: target.kind, id: target.id },
        linkedEntityType: source.kind === 'artist' ? 'Artist' : 'Track',
        direction:
          source.kind === 'artist' ? 'Artist relation' : 'Track relation',
        searchHints: [source.name, target.name, relationType],
      })
      if (saved === false)
        setError('The relation was not saved. Review the error and try again.')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The relation could not be saved. Try again.',
      )
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  return (
    <fieldset
      disabled={pending}
      style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
    >
      <ManualEntryPanel
        title={initialRelation ? 'Edit relation' : 'Add relation'}
        requiredMessage={relationValidationMessage({
          supportedOriginal,
          preservedType,
          validType,
          duplicate,
          validPeriod,
        })}
        isValid={isValid}
        onCancel={onCancel}
        onSubmit={() => {
          void submit()
        }}
        submitLabel={relationSubmitLabel(pending, Boolean(initialRelation))}
      >
        {error ? (
          <p role="alert" className="manual-entry-wide">
            {error}
          </p>
        ) : null}
        <label>
          <span>Existing source</span>
          <select
            value={sourceValue}
            disabled={!supportedOriginal || lockSource || lockEndpoints}
            onChange={(event) => {
              const next = findCatalogOption(linkOptions, event.target.value)
              if (next?.kind !== source?.kind) {
                setTargetValue('')
                setRelationType('')
                setStartYear('')
                setEndYear('')
              } else if (event.target.value === targetValue) setTargetValue('')
              setSourceValue(event.target.value)
            }}
          >
            <option value="">Choose artist or track</option>
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Existing target</span>
          <select
            value={targetValue}
            disabled={!source || !supportedOriginal || lockEndpoints}
            onChange={(event) => setTargetValue(event.target.value)}
          >
            <option value="">Choose target</option>
            {targetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Relation type</span>
          <select
            value={relationType}
            disabled={!source || !supportedOriginal}
            onChange={(event) => setRelationType(event.target.value)}
          >
            <option value="">Choose type</option>
            {preservedType &&
            relationType &&
            !typeOptions.includes(relationType) ? (
              <option value={relationType}>{relationType} (existing)</option>
            ) : null}
            {typeOptions.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        {source?.kind === 'artist' ? (
          <>
            <label>
              <span>Start year</span>
              <input
                type="number"
                min="1"
                max="9999"
                step="1"
                value={startYear}
                onChange={(event) => setStartYear(event.target.value)}
              />
            </label>
            <label>
              <span>End year</span>
              <input
                type="number"
                min="1"
                max="9999"
                step="1"
                value={endYear}
                onChange={(event) => setEndYear(event.target.value)}
              />
            </label>
          </>
        ) : null}
        <p className="manual-entry-wide">
          Artist relations connect identities and memberships. Track relations
          connect versions and remixes. Credits belong to release or track
          credits, not this form.
        </p>
      </ManualEntryPanel>
    </fieldset>
  )
}
