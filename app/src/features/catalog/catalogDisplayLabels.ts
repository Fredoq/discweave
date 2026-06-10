import type { CatalogDictionaries } from './catalogApi'
import { activeDictionaries } from './api/catalogDefaults'
import {
  creditRoleLabel,
  relationTypeLabel,
  toCreditRoleCode,
} from './api/catalogValueMappers'

const matchedFieldLabels: Record<string, string> = {
  'artist credits': 'Artist credits',
  'credit.contributor': 'Credit artist',
  'credit.role': 'Credit role',
  credits: 'Credits',
  genre: 'Genre',
  label: 'Label',
  'label releases': 'Label releases',
  medium: 'Media',
  name: 'Name',
  ownershipStatus: 'Ownership status',
  'release.type': 'Release type',
  tag: 'Tag',
  title: 'Title',
}

const genericGraphRelations = new Set([
  'artist',
  'artists',
  'artist links',
  'credit',
  'credits',
])

export function formatMatchedField(field: string) {
  return matchedFieldLabels[field] ?? humanizeIdentifier(field)
}

export function formatRoleFacet(
  role: string,
  dictionaries: CatalogDictionaries | undefined = activeDictionaries,
) {
  if (isCreditRoleValue(role, dictionaries)) {
    return creditRoleLabel(role, dictionaries)
  }

  if (isArtistRelationValue(role, dictionaries)) {
    return relationTypeLabel(role, 'artistRelationType', dictionaries)
  }

  if (isTrackRelationValue(role, dictionaries)) {
    return relationTypeLabel(role, 'trackRelationType', dictionaries)
  }

  return humanizeIdentifier(role)
}

export function roleFacetValue(
  role: string,
  dictionaries: CatalogDictionaries | undefined = activeDictionaries,
) {
  return isCreditRoleValue(role, dictionaries)
    ? toCreditRoleCode(role, dictionaries)
    : role
}

export function formatGraphRelation(
  relation: string,
  dictionaries: CatalogDictionaries | undefined = activeDictionaries,
) {
  return formatRoleFacet(relation, dictionaries)
}

export function isGraphArtistRole(
  value: string | null | undefined,
  dictionaries: CatalogDictionaries | undefined = activeDictionaries,
) {
  const normalized = value?.trim().toLowerCase()

  return Boolean(
    normalized &&
    !genericGraphRelations.has(normalized) &&
    (isCreditRoleValue(value ?? '', dictionaries) ||
      isArtistRelationValue(value ?? '', dictionaries) ||
      isTrackRelationValue(value ?? '', dictionaries)),
  )
}

function isCreditRoleValue(
  value: string,
  dictionaries: CatalogDictionaries | undefined = activeDictionaries,
) {
  const role = value.trim()
  const code = toCreditRoleCode(role, dictionaries)

  return (dictionaries ?? activeDictionaries).creditRole.some(
    (entry) => entry.code === code || entry.name === role,
  )
}

function isArtistRelationValue(
  value: string,
  dictionaries: CatalogDictionaries | undefined = activeDictionaries,
) {
  const relation = value.trim()

  return (dictionaries ?? activeDictionaries).artistRelationType.some(
    (entry) => entry.code === relation || entry.name === relation,
  )
}

function isTrackRelationValue(
  value: string,
  dictionaries: CatalogDictionaries | undefined = activeDictionaries,
) {
  const relation = value.trim()

  return (dictionaries ?? activeDictionaries).trackRelationType.some(
    (entry) => entry.code === relation || entry.name === relation,
  )
}

function humanizeIdentifier(value: string) {
  const words = value
    .replaceAll('.', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()

  if (!words) {
    return value
  }

  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}
