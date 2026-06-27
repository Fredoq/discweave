import { useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
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

export type RelationEntryFormProps = {
  dictionaries: CatalogDictionaries
  initialRelation?: RelationRecord
  linkOptions: CatalogLinkOption[]
  relations: RelationRecord[]
  onCancel: () => void
  onSubmit: (relation: RelationRecord) => void
}

export function RelationEntryForm({
  dictionaries,
  initialRelation,
  linkOptions,
  relations,
  onCancel,
  onSubmit,
}: RelationEntryFormProps) {
  const relationTypeOptions = [
    ...activeDictionaryLabels(dictionaries, 'artistRelationType'),
    ...activeDictionaryLabels(dictionaries, 'trackRelationType'),
  ]
  const [selectedSourceValue, setSelectedSourceValue] = useState(
    initialRelation?.sourceLink
      ? `${initialRelation.sourceLink.kind}:${initialRelation.sourceLink.id}`
      : '',
  )
  const [source, setSource] = useState(
    initialRelation?.sourceLink ? '' : (initialRelation?.source ?? ''),
  )
  const [selectedTargetValue, setSelectedTargetValue] = useState(
    initialRelation?.targetLink
      ? `${initialRelation.targetLink.kind}:${initialRelation.targetLink.id}`
      : '',
  )
  const [target, setTarget] = useState(
    initialRelation?.targetLink ? '' : (initialRelation?.target ?? ''),
  )
  const [relationType, setRelationType] = useState(
    initialRelation?.relationType ?? '',
  )
  const [role, setRole] = useState(initialRelation?.role ?? '')
  const [selectedLinkedEntityValue, setSelectedLinkedEntityValue] = useState(
    initialRelation?.linkedEntityLink
      ? `${initialRelation.linkedEntityLink.kind}:${initialRelation.linkedEntityLink.id}`
      : '',
  )
  const [linkedEntity, setLinkedEntity] = useState(
    initialRelation?.linkedEntityLink
      ? ''
      : (initialRelation?.linkedEntity ?? ''),
  )
  const [context, setContext] = useState(initialRelation?.context ?? '')
  const selectedSource = findCatalogOption(linkOptions, selectedSourceValue)
  const selectedTarget = findCatalogOption(linkOptions, selectedTargetValue)
  const selectedLinkedEntity = findCatalogOption(
    linkOptions,
    selectedLinkedEntityValue,
  )
  const sourceName = selectedSource?.name ?? source.trim()
  const targetName = selectedTarget?.name ?? target.trim()
  const relationTypeName = textOrFallback(relationType, 'Unspecified relation')
  const hasDuplicateRelation = relations.some(
    (relation) =>
      relation.id !== initialRelation?.id &&
      relation.source.toLowerCase() === sourceName.toLowerCase() &&
      relation.target.toLowerCase() === targetName.toLowerCase() &&
      relation.relationType.toLowerCase() === relationTypeName.toLowerCase(),
  )
  const isValid =
    sourceName.length > 0 && targetName.length > 0 && !hasDuplicateRelation
  const formTitle = initialRelation ? 'Edit relation' : 'Add relation'

  function handleSubmit() {
    const type = relationTypeName
    const roleName = textOrFallback(role, 'Unspecified role')
    const evidence = textOrFallback(context, 'No context or evidence recorded.')
    const linkedEntityName =
      selectedLinkedEntity?.name ??
      textOrFallback(linkedEntity, selectedTarget?.name ?? targetName)
    const linkedEntityLink = selectedLinkedEntity ?? selectedTarget ?? undefined

    onSubmit({
      id:
        initialRelation?.id ??
        createManualRecordId('relation', `${sourceName}-${targetName}`),
      source: sourceName,
      sourceLink: selectedSource ? linkFromOption(selectedSource) : undefined,
      sourceType: selectedSource?.typeLabel ?? 'Manual source',
      target: targetName,
      targetLink: selectedTarget ? linkFromOption(selectedTarget) : undefined,
      targetType: selectedTarget?.typeLabel ?? 'Manual target',
      relationType: type,
      role: roleName,
      context: evidence,
      evidence,
      linkedEntity: linkedEntityName,
      linkedEntityLink: linkedEntityLink
        ? linkFromOption(linkedEntityLink)
        : undefined,
      linkedEntityType: relationLinkedEntityType(linkedEntityLink),
      direction: 'Manual relation',
      searchHints: [
        sourceName,
        targetName,
        linkedEntityName,
        type,
        roleName,
        evidence,
      ],
    })
  }

  return (
    <ManualEntryPanel
      title={formTitle}
      requiredMessage="Source and target are required."
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel={initialRelation ? 'Save record' : 'Add record'}
    >
      <label>
        <span>Existing source</span>
        <CatalogEntitySelect
          options={linkOptions}
          value={selectedSourceValue}
          onChange={(nextValue) => {
            setSelectedSourceValue(nextValue)

            if (nextValue.length > 0) {
              setSource('')
            }
          }}
        />
      </label>
      <label>
        <span>Source</span>
        <input
          value={source}
          disabled={selectedSourceValue.length > 0}
          onChange={(event) => setSource(event.target.value)}
          required={selectedSourceValue.length === 0}
        />
      </label>
      <label>
        <span>Existing target</span>
        <CatalogEntitySelect
          options={linkOptions}
          value={selectedTargetValue}
          onChange={(nextValue) => {
            setSelectedTargetValue(nextValue)

            if (nextValue.length > 0) {
              setTarget('')
            }
          }}
        />
      </label>
      <label>
        <span>Target</span>
        <input
          value={target}
          disabled={selectedTargetValue.length > 0}
          onChange={(event) => setTarget(event.target.value)}
          required={selectedTargetValue.length === 0}
        />
      </label>
      <label>
        <span>Relation type</span>
        <select
          value={relationType}
          onChange={(event) => setRelationType(event.target.value)}
        >
          <option value="">Not recorded</option>
          {relationTypeOptions.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      {hasDuplicateRelation ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          This relation already exists.
        </p>
      ) : null}
      <label>
        <span>Role</span>
        <input value={role} onChange={(event) => setRole(event.target.value)} />
      </label>
      <label>
        <span>Existing linked entity</span>
        <CatalogEntitySelect
          options={linkOptions}
          value={selectedLinkedEntityValue}
          onChange={(nextValue) => {
            setSelectedLinkedEntityValue(nextValue)

            if (nextValue.length > 0) {
              setLinkedEntity('')
            }
          }}
        />
      </label>
      <label>
        <span>Linked entity</span>
        <input
          value={linkedEntity}
          disabled={selectedLinkedEntityValue.length > 0}
          onChange={(event) => setLinkedEntity(event.target.value)}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Context/evidence</span>
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          rows={3}
        />
      </label>
    </ManualEntryPanel>
  )
}

type CatalogEntitySelectProps = {
  options: CatalogLinkOption[]
  value: string
  onChange: (value: string) => void
}

function CatalogEntitySelect({
  options,
  value,
  onChange,
}: CatalogEntitySelectProps) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Free text</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function linkFromOption(option: CatalogLinkOption): CatalogLink {
  return {
    kind: option.kind,
    id: option.id,
  }
}

function relationLinkedEntityType(
  option: CatalogLinkOption | null | undefined,
): RelationRecord['linkedEntityType'] {
  if (!option) {
    return 'Artist'
  }

  switch (option.kind) {
    case 'artist':
      return 'Artist'
    case 'release':
      return 'Release'
    case 'track':
      return 'Track'
    case 'ownedItem':
      return 'Owned item'
    case 'label':
      return 'Label'
    case 'relation':
      return 'Relation'
    case 'playlist':
      return 'Playlist'
  }
}
