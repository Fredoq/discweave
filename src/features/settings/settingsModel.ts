import type {
  DictionaryEntry,
  DictionaryKind,
  RatingTargetType,
} from '../catalog/catalogApi'

export type SettingsMode = 'dictionaries' | 'ratings' | 'importPatterns'

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
