import type {
  CatalogDictionaries,
  DictionaryEntry,
  DictionaryKind,
  RatingCriterion,
} from './catalogTypes'

export const dictionaryKinds: DictionaryKind[] = [
  'releaseType',
  'creditRole',
  'genre',
  'mediaType',
  'artistRelationType',
  'trackRelationType',
]

export const defaultCatalogDictionaries: CatalogDictionaries = {
  releaseType: [
    entry('releaseType', 'unknown', 'Unknown', 0, true),
    entry('releaseType', 'album', 'Album', 10),
    entry('releaseType', 'ep', 'EP', 20),
    entry('releaseType', 'standalone', 'Single', 30),
    entry('releaseType', 'compilation', 'Compilation', 40),
    entry('releaseType', 'bootleg', 'Bootleg', 50),
    entry('releaseType', 'mixtape', 'Mixtape', 60),
    entry('releaseType', 'promo', 'Promo', 70),
    entry('releaseType', 'other', 'Other', 80),
  ],
  creditRole: [
    entry('creditRole', 'mainArtist', 'Main artist', 10, true),
    entry('creditRole', 'featuredArtist', 'Featured artist', 20),
    entry('creditRole', 'remixer', 'Remixer', 30),
    entry('creditRole', 'producer', 'Producer', 40),
    entry('creditRole', 'composer', 'Composer', 50),
    entry('creditRole', 'performer', 'Performer', 60),
    entry('creditRole', 'engineer', 'Engineer', 70),
  ],
  genre: [
    entry('genre', 'Ambient', 'Ambient', 10),
    entry('genre', 'Electronic', 'Electronic', 20),
    entry('genre', 'IDM', 'IDM', 30),
    entry('genre', 'Techno', 'Techno', 40),
    entry('genre', 'House', 'House', 50),
    entry('genre', 'Synth-pop', 'Synth-pop', 60),
    entry('genre', 'Post-punk', 'Post-punk', 70),
    entry('genre', 'Remix', 'Remix', 80),
  ],
  mediaType: [
    entry('mediaType', 'digital', 'Digital', 10, true, 'digital'),
    entry('mediaType', 'vinyl', 'Vinyl', 20, false, 'vinyl'),
    entry('mediaType', 'cd', 'CD', 30, false, 'cd'),
    entry('mediaType', 'cassette', 'Cassette', 40, false, 'cassette'),
    entry('mediaType', 'other', 'Other', 50, true, 'other'),
  ],
  artistRelationType: [
    entry('artistRelationType', 'alias', 'Alias', 10),
    entry('artistRelationType', 'memberOf', 'Member of', 20),
    entry('artistRelationType', 'soloProject', 'Solo project', 30),
    entry('artistRelationType', 'collaboration', 'Collaboration', 40),
  ],
  trackRelationType: [
    entry('trackRelationType', 'remixOf', 'Remix of', 10),
    entry('trackRelationType', 'versionOf', 'Version of', 20),
    entry('trackRelationType', 'editOf', 'Edit of', 30),
  ],
}

export const defaultRatingCriteria: RatingCriterion[] = [
  {
    id: 'rating-criterion:overall',
    code: 'overall',
    name: 'Overall',
    targetTypes: ['release', 'track'],
    sortOrder: 10,
    isActive: true,
    isBuiltin: true,
    isProtected: true,
  },
]

export let activeDictionaries = defaultCatalogDictionaries

export const mainArtistRoleCode = 'mainArtist'

export function setActiveDictionaries(dictionaries: CatalogDictionaries) {
  activeDictionaries = dictionaries
}

export function resetActiveDictionaries() {
  activeDictionaries = defaultCatalogDictionaries
}

export function entry(
  kind: DictionaryKind,
  code: string,
  name: string,
  sortOrder: number,
  isProtected = false,
  mediaProfile?: string,
): DictionaryEntry {
  return {
    id: `${kind}:${code}`,
    kind,
    code,
    name,
    sortOrder,
    isActive: true,
    isBuiltin: true,
    isProtected,
    mediaProfile,
  }
}

export function buildCatalogDictionaries(
  entries: DictionaryEntry[],
): CatalogDictionaries {
  const dictionaries = Object.fromEntries(
    dictionaryKinds.map((kind) => [kind, []]),
  ) as unknown as CatalogDictionaries

  for (const item of entries) {
    dictionaries[item.kind].push(item)
  }

  for (const kind of dictionaryKinds) {
    dictionaries[kind].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    )
  }

  return dictionaries
}

export function dictionaryLabel(
  dictionaries: CatalogDictionaries | undefined,
  kind: DictionaryKind,
  code: string,
) {
  return (
    (dictionaries ?? activeDictionaries)[kind].find(
      (entry) => entry.code === code,
    )?.name ?? code
  )
}

export function dictionaryCode(
  kind: DictionaryKind,
  labelOrCode: string,
  dictionaries = activeDictionaries,
) {
  const value = labelOrCode.trim()
  const entry = dictionaries[kind].find(
    (item) => item.code === value || item.name === value,
  )

  return entry?.code ?? value
}

export function activeDictionaryLabels(
  dictionaries: CatalogDictionaries | undefined,
  kind: DictionaryKind,
) {
  return (dictionaries ?? activeDictionaries)[kind]
    .filter((entry) => entry.isActive)
    .map((entry) => entry.name)
}

export function activeGenreLabelSet() {
  return new Set(activeDictionaries.genre.map((entry) => entry.name))
}

export function mediaEntryByLabelOrCode(labelOrCode: string) {
  const value = labelOrCode.trim()
  return activeDictionaries.mediaType.find(
    (entry) => entry.code === value || entry.name === value,
  )
}
