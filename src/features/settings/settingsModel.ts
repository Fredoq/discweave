import type {
  DictionaryEntry,
  DictionaryKind,
  NamingProfile,
  TagRoleMapping,
  RatingTargetType,
} from '../catalog/catalogApi'

export type SettingsMode =
  | 'dictionaries'
  | 'ratings'
  | 'importPatterns'
  | 'namingProfiles'
  | 'tagRoleMappings'

export const dictionaryKindLabels: Record<DictionaryKind, string> = {
  releaseType: 'Release types',
  creditRole: 'Artist roles',
  genre: 'Genres',
  mediaType: 'Media types',
  artistRelationType: 'Artist relation types',
  trackRelationType: 'Track relation types',
}

export const dictionaryKinds = Object.keys(
  dictionaryKindLabels,
) as DictionaryKind[]
export const mediaProfiles = ['digital', 'vinyl', 'cd', 'cassette', 'other']
export const ratingTargetTypes: RatingTargetType[] = [
  'artist',
  'release',
  'track',
  'label',
]

const ratingTargetTypeLabels: Record<RatingTargetType, string> = {
  artist: 'Artists',
  release: 'Releases',
  track: 'Tracks',
  label: 'Labels',
}

export function parseSortOrder(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  return Number.isNaN(parsed) ? fallback : parsed
}

export function dictionarySearchText(entry: DictionaryEntry) {
  return [
    entry.name,
    entry.code,
    dictionaryKindLabels[entry.kind],
    entry.isActive ? 'active' : 'inactive',
    entry.isBuiltin ? 'builtin' : 'custom',
    entry.mediaProfile ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

export function ratingTargetTypeLabel(targetType: RatingTargetType) {
  return ratingTargetTypeLabels[targetType]
}

export function namingProfileSearchText(profile: NamingProfile) {
  return [
    profile.name,
    profile.releaseFolderTemplate,
    profile.trackFileTemplate,
    profile.trackFileWithArtistTemplate,
    profile.isDefault ? 'default' : '',
    profile.isActive ? 'active' : 'inactive',
    profile.isBuiltin ? 'builtin' : 'custom',
  ]
    .join(' ')
    .toLowerCase()
}

export const standardTagRoleMappingFields = [
  { value: 'composer', label: 'Composer' },
  { value: 'producer', label: 'Producer' },
  { value: 'remixer', label: 'Remixer' },
  { value: 'lyricist', label: 'Lyricist' },
  { value: 'conductor', label: 'Conductor' },
  { value: 'involvedPeople', label: 'Involved people' },
] as const

export function isStandardTagRoleMappingField(tagField: string) {
  return standardTagRoleMappingFields.some((field) => field.value === tagField)
}

export function tagRoleMappingFieldLabel(tagField: string) {
  return (
    standardTagRoleMappingFields.find((field) => field.value === tagField)
      ?.label ?? tagField
  )
}

export function tagRoleMappingSearchText(
  mapping: TagRoleMapping,
  roleName: string,
) {
  return [
    roleName,
    mapping.creditRoleCode,
    mapping.tagField,
    tagRoleMappingFieldLabel(mapping.tagField),
    mapping.isActive ? 'active' : 'inactive',
    mapping.isBuiltin ? 'builtin' : 'custom',
  ]
    .join(' ')
    .toLowerCase()
}
