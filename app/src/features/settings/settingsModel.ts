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
  | 'integrations'

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

export const tagRoleMappingFieldCapabilities = [
  {
    value: 'composer',
    label: 'Composer',
    compatibility: 'Standard field',
    note: 'Writes the normalized composer tag. Composer is one of the most portable contributor fields across supported formats.',
  },
  {
    value: 'producer',
    label: 'Producer',
    compatibility: 'Standard field, format-specific storage',
    note: 'Writes the normalized producer tag. FLAC and OGG store it as a Vorbis comment; MP3 and M4A use their format-specific metadata frames or atoms.',
  },
  {
    value: 'remixer',
    label: 'Remixer',
    compatibility: 'Standard field',
    note: 'Writes the normalized remixer tag. This is a common field in library managers and maps cleanly to FLAC, OGG, MP3 and M4A adapters.',
  },
] as const

export const standardTagRoleMappingFields = tagRoleMappingFieldCapabilities.map(
  ({ label, value }) => ({ label, value }),
)

export function isStandardTagRoleMappingField(tagField: string) {
  return standardTagRoleMappingFields.some((field) => field.value === tagField)
}

export function tagRoleMappingFieldLabel(tagField: string) {
  return (
    tagRoleMappingFieldCapabilities.find((field) => field.value === tagField)
      ?.label ?? tagField
  )
}

export function tagRoleMappingCompatibilityText(tagField: string) {
  return (
    tagRoleMappingFieldCapabilities.find((field) => field.value === tagField)
      ?.compatibility ?? 'Custom field, best-effort storage'
  )
}

export function tagRoleMappingCompatibilityNote(tagField: string) {
  return (
    tagRoleMappingFieldCapabilities.find((field) => field.value === tagField)
      ?.note ??
    'Writes a custom PropertyMap field with the exact key shown here. FLAC and OGG usually preserve custom Vorbis comments well; MP3 and M4A store custom fields through format-specific metadata and may not be visible in every app.'
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
