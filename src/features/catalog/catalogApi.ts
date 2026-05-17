import type { ArtistRecord, ArtistType } from '../artists/artistsData'
import type {
  OwnedItemRecord,
  OwnedItemStatus,
} from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type {
  OwnedCopy,
  ReleaseArtistCredit,
  ReleaseCoverImage,
  ReleaseLabel,
  ReleaseRecord,
  ReleaseType,
} from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackCredit, TrackRecord } from '../tracks/tracksData'
import { isManualSessionRecord } from '../manualEntry/manualEntryUtils'
import { toCreditRole } from './creditRoles'
import { formatDurationSeconds, parseDurationText } from './durationFormat'

const pageSize = 100

export type DictionaryKind =
  | 'releaseType'
  | 'creditRole'
  | 'genre'
  | 'mediaType'
  | 'artistRelationType'
  | 'trackRelationType'

export type DictionaryEntry = {
  id: string
  kind: DictionaryKind
  code: string
  name: string
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
  isProtected: boolean
  mediaProfile?: string | null
}

export type RatingTargetType = 'artist' | 'release' | 'track' | 'label'

export type RatingCriterion = {
  id: string
  code: string
  name: string
  targetTypes: RatingTargetType[]
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
  isProtected: boolean
}

export type EntityRating = {
  id: string
  criterionId: string
  targetType: RatingTargetType
  targetId: string
  value: number
}

export type ImportPatternKind = 'releaseFolder' | 'trackFile'

export type ImportPattern = {
  id: string
  kind: ImportPatternKind
  template: string
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
}

export type ImportPatternRequest = {
  kind: ImportPatternKind
  template: string
  sortOrder?: number
  isActive?: boolean
}

export type ImportPatternTestResult = {
  matched: boolean
  fields: Record<string, string | null>
  issues: string[]
}

export type EntitySuggestion = {
  id: string
  name: string
  match: string
}

export type ImportIssue = {
  code: string
  message: string
  severity: string
}

export type ReleaseImportDraftTrack = {
  id: string
  filePath: string
  relativePath: string
  format: string
  sizeBytes: number
  lastModifiedAt: string
  durationSeconds?: number | null
  position?: number | null
  title: string
  artistNames: string[]
  artistCredits?: ReleaseImportArtistCredit[]
  artistSuggestions: EntitySuggestion[]
  trackSuggestions: EntitySuggestion[]
  isSkipped: boolean
  selectedTrackId?: string | null
  selectedArtistIds: string[]
  issues: ImportIssue[]
}

export type ReleaseImportArtistCredit = {
  artistId?: string | null
  name: string
  role: string
}

export type ReleaseImportLabel = {
  labelId?: string | null
  name: string
  catalogNumber?: string | null
  hasNoCatalogNumber: boolean
}

export type ReleaseImportDraft = {
  id: string
  sourcePath: string
  relativePath: string
  status: 'needsReview' | 'ready' | 'confirmed' | 'skipped'
  title: string
  type: string
  catalogNumber?: string | null
  labelName?: string | null
  releaseDate?: string | null
  year?: number | null
  isVariousArtists: boolean
  notOnLabel: boolean
  artistNames: string[]
  artistCredits?: ReleaseImportArtistCredit[]
  selectedArtistIds: string[]
  artistSuggestions: EntitySuggestion[]
  labels?: ReleaseImportLabel[]
  genres: string[]
  tags: string[]
  coverPath?: string | null
  issues: ImportIssue[]
  tracks: ReleaseImportDraftTrack[]
}

export type ReleaseImportSession = {
  id: string
  sourceRoot: string
  status: string
  draftCount: number
  trackCount: number
  ignoredFileCount: number
  createdAt: string
  updatedAt: string
  drafts?: ReleaseImportDraft[] | null
}

export type DesktopFolderScanRequest = {
  sourceRoot: string
  files: DesktopFolderScanFileRequest[]
  ignoredFileCount: number
}

export type DesktopFolderScanFileRequest = {
  filePath: string
  relativePath: string
  format?: string | null
  sizeBytes: number
  lastModifiedAt: string
  audioMetadata?: DesktopAudioMetadataRequest | null
  coverArtifact?: DesktopCoverArtifactRequest | null
}

export type DesktopAudioMetadataRequest = {
  title?: string | null
  artists?: string[] | null
  albumTitle?: string | null
  albumArtists?: string[] | null
  catalogNumber?: string | null
  releaseDate?: string | null
  year?: number | null
  durationSeconds?: number | null
  trackNumber?: number | null
}

export type DesktopCoverArtifactRequest = {
  fileName: string
  extension: string
  contentType: string
  sizeBytes: number
  contentBase64: string
}

export type CatalogDictionaries = Record<DictionaryKind, DictionaryEntry[]>

const dictionaryKinds: DictionaryKind[] = [
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

let activeDictionaries = defaultCatalogDictionaries

export type CatalogState = {
  artists: ArtistRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  ownedItems: OwnedItemRecord[]
  relations: RelationRecord[]
  playlists: PlaylistRecord[]
  dictionaries?: CatalogDictionaries
  ratingCriteria?: RatingCriterion[]
  ratings?: EntityRating[]
}

export const emptyCatalogState: CatalogState = {
  artists: [],
  releases: [],
  tracks: [],
  ownedItems: [],
  relations: [],
  playlists: [],
  dictionaries: defaultCatalogDictionaries,
  ratingCriteria: defaultRatingCriteria,
  ratings: [],
}

let testCatalogState: CatalogState | null = null
const mainArtistRoleCode = 'mainArtist'

export function seedCatalogForTests(state: CatalogState) {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('Test catalog seeding is only available in tests')
  }

  testCatalogState = withDefaultDictionaries(state)
  activeDictionaries =
    testCatalogState.dictionaries ?? defaultCatalogDictionaries
}

export function clearCatalogForTests() {
  if (import.meta.env.MODE === 'test') {
    testCatalogState = null
    activeDictionaries = defaultCatalogDictionaries
  }
}

export function getInitialCatalogStateForTests() {
  return import.meta.env.MODE === 'test' ? testCatalogState : null
}

function canUseTestCatalogMutation() {
  return (
    import.meta.env.MODE === 'test' &&
    testCatalogState !== null &&
    !('__cratebaseUseRealCatalogApi' in globalThis)
  )
}

function updateTestCatalogState(
  mutator: (state: CatalogState) => CatalogState,
) {
  if (!canUseTestCatalogMutation() || !testCatalogState) {
    return false
  }

  testCatalogState = withDefaultDictionaries(mutator(testCatalogState))
  activeDictionaries =
    testCatalogState.dictionaries ?? defaultCatalogDictionaries

  return true
}

function entry(
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

function withDefaultDictionaries(state: CatalogState): CatalogState {
  const ratings = state.ratings ?? []

  return {
    ...state,
    dictionaries: state.dictionaries ?? defaultCatalogDictionaries,
    ratingCriteria: state.ratingCriteria ?? defaultRatingCriteria,
    ratings,
    artists: state.artists.map((artist) => ({
      ...artist,
      ratings: targetRatings(ratings, 'artist', artist.id),
    })),
    releases: state.releases.map((release) => ({
      ...release,
      ratings: targetRatings(ratings, 'release', release.id),
    })),
    tracks: state.tracks.map((track) => ({
      ...track,
      ratings: targetRatings(ratings, 'track', track.id),
    })),
  }
}

function buildCatalogDictionaries(
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

function dictionaryCode(
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

function activeGenreLabelSet() {
  return new Set(activeDictionaries.genre.map((entry) => entry.name))
}

function mediaEntryByLabelOrCode(labelOrCode: string) {
  const value = labelOrCode.trim()
  return activeDictionaries.mediaType.find(
    (entry) => entry.code === value || entry.name === value,
  )
}

function findArtistName(state: CatalogState, artistId: string) {
  return state.artists.find((artist) => artist.id === artistId)?.name ?? ''
}

function unlinkRelationRecord(
  relation: RelationRecord,
  kind: NonNullable<RelationRecord['sourceLink']>['kind'],
  id: string,
): RelationRecord {
  return {
    ...relation,
    sourceLink:
      relation.sourceLink?.kind === kind && relation.sourceLink.id === id
        ? undefined
        : relation.sourceLink,
    targetLink:
      relation.targetLink?.kind === kind && relation.targetLink.id === id
        ? undefined
        : relation.targetLink,
    linkedEntityLink:
      relation.linkedEntityLink?.kind === kind &&
      relation.linkedEntityLink.id === id
        ? undefined
        : relation.linkedEntityLink,
  }
}

type ListResponse<T> = {
  items: T[]
  limit: number
  offset: number
  total: number
}

type ArtistDto = {
  id: string
  type: string
  name: string
}

type LabelDto = {
  id: string
  name: string
}

type ReleaseDto = {
  id: string
  title: string
  type: string
  labelId?: string | null
  year?: number | null
  releaseDate?: string | null
  genres: string[]
  tags: string[]
  coverImage?: ReleaseCoverImageDto | null
  isVariousArtists?: boolean
  notOnLabel?: boolean
  artistCredits?: ReleaseArtistCreditDto[]
  labels?: ReleaseLabelDto[]
  tracklist?: ReleaseTracklistItemDto[]
}

type ReleaseCoverImageDto = {
  url: string
  contentType: string
  originalFileName: string
  sizeBytes: number
  sourceType: string
}

type ReleaseArtistCreditDto = {
  artistId: string
  artistName: string
  role: string
}

type ReleaseLabelDto = {
  labelId?: string | null
  name: string
  catalogNumber?: string | null
  hasNoCatalogNumber: boolean
}

type ReleaseTracklistItemDto = {
  trackId: string
  title: string
  position: number
  durationSeconds?: number | null
  artistCredits: ReleaseArtistCreditDto[]
  versionNote?: string | null
}

type TrackDto = {
  id: string
  title: string
  durationSeconds?: number | null
  genres: string[]
  tags: string[]
  credits?: TrackCreditDto[]
  releaseAppearances?: TrackReleaseAppearanceDto[]
}

type TrackCreditDto = {
  artistId: string
  artistName: string
  role: string
}

type TrackReleaseAppearanceDto = {
  releaseId: string
  releaseTitle: string
  releaseArtist: string
  year?: number | null
  label?: string | null
  position: number
  durationSeconds?: number | null
  versionNote?: string | null
}

type ReleaseTrackContext = {
  release: ReleaseDto
  track: ReleaseTracklistItemDto
}

type MediumDto = {
  type: string
  description?: string | null
  path?: string | null
  format?: string | null
  discCount?: number | null
}

type OwnedItemDto = {
  id: string
  targetType: string
  targetId: string
  status: string
  medium: MediumDto
  condition?: string | null
  storageLocation?: string | null
}

type CreditDto = {
  id: string
  contributorArtistId: string
  contributorName: string
  targetType: string
  targetId: string
  role: string
}

type ArtistRelationDto = {
  id: string
  sourceArtistId: string
  targetArtistId: string
  type: string
  startYear?: number | null
  endYear?: number | null
}

type TrackRelationDto = {
  id: string
  sourceTrackId: string
  targetTrackId: string
  type: string
}

type DictionaryEntryDto = DictionaryEntry

type RatingCriterionDto = RatingCriterion

type RatingValueDto = EntityRating

type ErrorResponseDto = {
  code?: string | null
  message?: string | null
}

export async function loadCatalog(): Promise<CatalogState> {
  if (testCatalogState) {
    return testCatalogState
  }

  const [
    artistsResponse,
    labelsResponse,
    releasesResponse,
    tracksResponse,
    ownedItemsResponse,
    creditsResponse,
    artistRelationsResponse,
    trackRelationsResponse,
    dictionariesResponse,
    ratingCriteriaResponse,
    ratingValuesResponse,
  ] = await Promise.all([
    getAllPages<ArtistDto>('/api/artists'),
    getAllPages<LabelDto>('/api/labels'),
    getAllPages<ReleaseDto>('/api/releases'),
    getAllPages<TrackDto>('/api/tracks'),
    getAllPages<OwnedItemDto>('/api/owned-items'),
    getAllPages<CreditDto>('/api/credits'),
    getAllPages<ArtistRelationDto>('/api/artist-relations'),
    getAllPages<TrackRelationDto>('/api/track-relations'),
    getAllPages<DictionaryEntryDto>('/api/settings/dictionaries'),
    getAllPages<RatingCriterionDto>('/api/rating-criteria'),
    getAllPages<RatingValueDto>('/api/ratings'),
  ])
  const dictionaries = buildCatalogDictionaries(dictionariesResponse.items)
  activeDictionaries = dictionaries
  const ratingsByTarget = groupRatingsByTarget(ratingValuesResponse.items)

  const labelsById = new Map(
    labelsResponse.items.map((label) => [label.id, label]),
  )
  const artistsById = new Map(
    artistsResponse.items.map((artist) => [artist.id, artist]),
  )
  const creditsByTarget = groupCreditsByTarget(creditsResponse.items)
  const releaseDtosById = new Map(
    releasesResponse.items.map((release) => [release.id, release]),
  )
  const releaseTrackByTrackId = new Map<string, ReleaseTrackContext[]>()
  for (const release of releasesResponse.items) {
    for (const track of release.tracklist ?? []) {
      releaseTrackByTrackId.set(track.trackId, [
        ...(releaseTrackByTrackId.get(track.trackId) ?? []),
        { release, track },
      ])
    }
  }
  const trackDtosById = new Map(
    tracksResponse.items.map((track) => [track.id, track]),
  )

  const artists = artistsResponse.items.map((artist) =>
    toArtistRecord(
      artist,
      creditsResponse.items,
      artistRelationsResponse.items,
      artistsById,
      releaseDtosById,
      trackDtosById,
      dictionaries,
      ratingsByTarget,
    ),
  )
  const releases = releasesResponse.items.map((release) =>
    toReleaseRecord(
      release,
      labelsById,
      creditsByTarget,
      artistsById,
      ownedItemsResponse.items,
      dictionaries,
      ratingsByTarget,
    ),
  )
  const tracks = tracksResponse.items.map((track) =>
    toTrackRecord(
      track,
      creditsByTarget,
      releaseDtosById,
      releaseTrackByTrackId,
      ownedItemsResponse.items,
      dictionaries,
      ratingsByTarget,
    ),
  )
  const ownedItems = ownedItemsResponse.items.map((item) =>
    toOwnedItemRecord(
      item,
      releaseDtosById,
      trackDtosById,
      releases,
      tracks,
      dictionaries,
    ),
  )
  const relations = [
    ...artistRelationsResponse.items.map((relation) =>
      toArtistRelationRecord(relation, artistsById, dictionaries),
    ),
    ...trackRelationsResponse.items.map((relation) =>
      toTrackRelationRecord(relation, trackDtosById, dictionaries),
    ),
  ]

  return {
    artists,
    releases,
    tracks,
    ownedItems,
    relations,
    playlists: [],
    dictionaries,
    ratingCriteria: ratingCriteriaResponse.items,
    ratings: ratingValuesResponse.items,
  }
}

async function getAllPages<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<ListResponse<T>> {
  let offset = 0
  let total: number | undefined
  const items: T[] = []

  while (true) {
    const pageParams = new URLSearchParams(params)
    pageParams.set('limit', String(pageSize))
    pageParams.set('offset', String(offset))

    const page = await getList<T>(`${path}?${pageParams.toString()}`)

    items.push(...page.items)
    total = page.total

    if (page.items.length === 0 || items.length >= page.total) {
      break
    }

    offset += page.items.length
  }

  return {
    items,
    limit: pageSize,
    offset: 0,
    total: total ?? items.length,
  }
}

async function getList<T>(path: string): Promise<ListResponse<T>> {
  const response = await fetch(path, {
    credentials: 'include',
    method: 'GET',
  })

  if (!response.ok) {
    if (response.status === 404) {
      return { items: [], limit: 0, offset: 0, total: 0 }
    }

    throw await CatalogApiError.fromResponse(response)
  }

  const body = (await response.json()) as ListResponse<T>
  assertNoCollectionIds(body)

  return body
}

async function getJson<T>(path: string): Promise<T | null> {
  const response = await fetch(path, {
    credentials: 'include',
    method: 'GET',
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }

    throw await CatalogApiError.fromResponse(response)
  }

  const body = (await response.json()) as T
  assertNoCollectionIds(body)

  return body
}

export async function createArtist(artist: ArtistRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      artists: [...state.artists, artist],
    }))
  ) {
    return
  }

  await sendJson('/api/artists', 'POST', {
    name: artist.name,
    type: toArtistTypeCode(artist.type),
  })
}

export async function updateArtist(artist: ArtistRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      artists: state.artists.map((record) =>
        record.id === artist.id ? artist : record,
      ),
      ownedItems: state.ownedItems.map((item) =>
        item.artist === findArtistName(state, artist.id)
          ? { ...item, artist: artist.name }
          : item,
      ),
      releases: state.releases.map((release) =>
        release.artistId === artist.id
          ? { ...release, artist: artist.name }
          : release,
      ),
      tracks: state.tracks.map((track) =>
        track.artistId === artist.id
          ? {
              ...track,
              artist: artist.name,
              release: { ...track.release, artist: artist.name },
            }
          : track,
      ),
      relations: state.relations.map((relation) => ({
        ...relation,
        source:
          relation.sourceLink?.kind === 'artist' &&
          relation.sourceLink.id === artist.id
            ? artist.name
            : relation.source,
        target:
          relation.targetLink?.kind === 'artist' &&
          relation.targetLink.id === artist.id
            ? artist.name
            : relation.target,
        linkedEntity:
          relation.linkedEntityLink?.kind === 'artist' &&
          relation.linkedEntityLink.id === artist.id
            ? artist.name
            : relation.linkedEntity,
      })),
    }))
  ) {
    return
  }

  await sendJson(`/api/artists/${artist.id}`, 'PUT', {
    name: artist.name,
  })
}

export async function deleteArtist(artistId: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      artists: state.artists.filter((artist) => artist.id !== artistId),
      relations: state.relations.filter(
        (relation) =>
          relation.sourceLink?.id !== artistId &&
          relation.targetLink?.id !== artistId &&
          relation.linkedEntityLink?.id !== artistId,
      ),
    }))
  ) {
    return
  }

  await sendDelete(`/api/artists/${artistId}`, `artist:${artistId}`)
}

export async function createRelease(
  release: ReleaseRecord,
  tracks: TrackRecord[],
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      releases: [...state.releases, release],
      tracks: mergeReleaseTracklist(state.tracks, release, tracks),
    }))
  ) {
    return
  }

  await sendJson<ReleaseDto>('/api/releases', 'POST', {
    title: release.title,
    type: toReleaseTypeCode(release.type),
    isVariousArtists: Boolean(release.isVariousArtists),
    artistCredits: release.isVariousArtists
      ? []
      : (release.artistCredits ?? releaseArtistCreditsFromDisplay(release)).map(
          toReleaseArtistCreditRequest,
        ),
    notOnLabel: Boolean(release.notOnLabel),
    labels: release.notOnLabel
      ? []
      : (release.labels ?? releaseLabelsFromDisplay(release)).map(
          toReleaseLabelRequest,
        ),
    year: parseYear(release.year),
    releaseDate: release.releaseDate ?? null,
    genres: release.genres,
    tags: release.tags,
    tracklist: tracks.map(toReleaseTracklistRequest),
    ownedCopy: release.ownedCopies[0]
      ? {
          status: toOwnershipStatusCode(release.ownedCopies[0].status),
          medium: toMediumRequest(release.ownedCopies[0].medium),
          condition: toConditionCode(release.ownedCopies[0].condition),
          storageLocation: release.ownedCopies[0].storage,
        }
      : null,
  })
}

export async function updateRelease(
  release: ReleaseRecord,
  tracks?: TrackRecord[],
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      releases: state.releases.map((record) =>
        record.id === release.id ? release : record,
      ),
      tracks:
        tracks === undefined
          ? state.tracks.map((track) =>
              updateReleaseMetadataOnTrack(track, release),
            )
          : replaceReleaseTracklist(state.tracks, release, tracks),
      ownedItems: state.ownedItems.map((item) =>
        item.releaseId === release.id
          ? {
              ...item,
              releaseTitle: release.title,
              artist: release.artist,
            }
          : item,
      ),
      relations: state.relations.map((relation) => ({
        ...relation,
        source:
          relation.sourceLink?.kind === 'release' &&
          relation.sourceLink.id === release.id
            ? release.title
            : relation.source,
        target:
          relation.targetLink?.kind === 'release' &&
          relation.targetLink.id === release.id
            ? release.title
            : relation.target,
        linkedEntity:
          relation.linkedEntityLink?.kind === 'release' &&
          relation.linkedEntityLink.id === release.id
            ? release.title
            : relation.linkedEntity,
      })),
    }))
  ) {
    return
  }

  await sendJson(`/api/releases/${release.id}`, 'PUT', {
    title: release.title,
    type: toReleaseTypeCode(release.type),
    isVariousArtists: Boolean(release.isVariousArtists),
    artistCredits: release.isVariousArtists
      ? []
      : (release.artistCredits ?? releaseArtistCreditsFromDisplay(release)).map(
          toReleaseArtistCreditRequest,
        ),
    notOnLabel: Boolean(release.notOnLabel),
    labels: release.notOnLabel
      ? []
      : (release.labels ?? releaseLabelsFromDisplay(release)).map(
          toReleaseLabelRequest,
        ),
    year: parseYear(release.year),
    releaseDate: release.releaseDate ?? null,
    genres: release.genres,
    tags: release.tags,
    ...(tracks === undefined
      ? {}
      : { tracklist: tracks.map(toReleaseTracklistRequest) }),
  })

  if (!release.artistCredits) {
    await syncMainArtistCredit('release', release.id, release.artistId)
  }
}

function mergeReleaseTracklist(
  existingTracks: TrackRecord[],
  release: ReleaseRecord,
  tracks: TrackRecord[],
) {
  const desiredById = new Map(tracks.map((track) => [track.id, track]))
  const existingIds = new Set(existingTracks.map((track) => track.id))
  const updatedTracks = existingTracks.map((track) => {
    const desiredTrack = desiredById.get(track.id)

    return desiredTrack
      ? withReleaseAppearance(track, release, desiredTrack)
      : track
  })
  const createdTracks = tracks
    .filter((track) => !existingIds.has(track.id))
    .map((track) => withReleaseAppearance(track, release, track))

  return [...updatedTracks, ...createdTracks]
}

function replaceReleaseTracklist(
  existingTracks: TrackRecord[],
  release: ReleaseRecord,
  tracks: TrackRecord[],
) {
  const desiredById = new Map(tracks.map((track) => [track.id, track]))
  const existingIds = new Set(existingTracks.map((track) => track.id))
  const updatedTracks = existingTracks.map((track) => {
    const desiredTrack = desiredById.get(track.id)
    if (desiredTrack) {
      return withReleaseAppearance(track, release, desiredTrack)
    }

    return removeReleaseAppearance(track, release.id)
  })
  const createdTracks = tracks
    .filter((track) => !existingIds.has(track.id))
    .map((track) => withReleaseAppearance(track, release, track))

  return [...updatedTracks, ...createdTracks]
}

function withReleaseAppearance(
  track: TrackRecord,
  release: ReleaseRecord,
  sourceTrack: TrackRecord,
): TrackRecord {
  const appearance = releaseAppearanceForTrack(release, sourceTrack)
  const releaseAppearances = [
    ...track.releaseAppearances.filter(
      (candidate) => candidate.releaseId !== release.id,
    ),
    appearance,
  ]

  return {
    ...track,
    release:
      track.release.id && track.release.id !== release.id
        ? track.release
        : releaseSummaryForTrack(release, track),
    trackNumber:
      track.release.id === release.id ? appearance.position : track.trackNumber,
    duration:
      track.release.id === release.id ? appearance.duration : track.duration,
    versionHint:
      track.release.id === release.id
        ? appearance.versionNote
        : track.versionHint,
    releaseAppearances,
  }
}

function removeReleaseAppearance(
  track: TrackRecord,
  releaseId: string,
): TrackRecord {
  const releaseAppearances = track.releaseAppearances.filter(
    (appearance) => appearance.releaseId !== releaseId,
  )
  if (track.release.id !== releaseId) {
    return { ...track, releaseAppearances }
  }

  const primaryAppearance = releaseAppearances[0]

  return {
    ...track,
    release: primaryAppearance
      ? releaseSummaryFromAppearance(primaryAppearance)
      : {
          id: undefined,
          title: 'Unlinked release',
          artist: track.artist,
          year: 'Unknown year',
          label: 'Unknown label',
        },
    trackNumber: primaryAppearance?.position ?? 'Unnumbered',
    duration: primaryAppearance?.duration ?? track.duration,
    versionHint:
      primaryAppearance?.versionNote ?? 'No version relation recorded',
    releaseAppearances,
  }
}

function updateReleaseMetadataOnTrack(
  track: TrackRecord,
  release: ReleaseRecord,
): TrackRecord {
  if (
    track.release.id !== release.id &&
    !track.releaseAppearances.some(
      (appearance) => appearance.releaseId === release.id,
    )
  ) {
    return track
  }

  return {
    ...track,
    release:
      track.release.id === release.id
        ? releaseSummaryForTrack(release, track)
        : track.release,
    releaseAppearances: track.releaseAppearances.map((appearance) =>
      appearance.releaseId === release.id
        ? {
            ...appearance,
            coverImage: release.coverImage,
            releaseTitle: release.title,
            releaseArtist: release.artist,
            year: release.year,
            label: release.label,
          }
        : appearance,
    ),
  }
}

function releaseAppearanceForTrack(
  release: ReleaseRecord,
  track: TrackRecord,
): TrackRecord['releaseAppearances'][number] {
  const existingAppearance = track.releaseAppearances.find(
    (appearance) => appearance.releaseId === release.id,
  )

  return {
    releaseId: release.id,
    coverImage: release.coverImage,
    releaseTitle: release.title,
    releaseArtist: release.artist,
    year: release.year,
    label: release.label,
    position: existingAppearance?.position ?? track.trackNumber,
    duration: existingAppearance?.duration ?? track.duration,
    versionNote:
      existingAppearance?.versionNote ??
      textOrDefault(track.versionHint, 'No version relation recorded'),
  }
}

function releaseSummaryForTrack(release: ReleaseRecord, track: TrackRecord) {
  return {
    ...track.release,
    id: release.id,
    title: release.title,
    artist: release.artist,
    year: release.year,
    label: release.label,
  }
}

function releaseSummaryFromAppearance(
  appearance: TrackRecord['releaseAppearances'][number],
) {
  return {
    id: appearance.releaseId,
    title: appearance.releaseTitle,
    artist: appearance.releaseArtist,
    year: appearance.year,
    label: appearance.label,
  }
}

function textOrDefault(value: string, fallback: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : fallback
}

export async function deleteRelease(releaseId: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      releases: state.releases.filter((release) => release.id !== releaseId),
      tracks: state.tracks.map((track) =>
        track.release.id === releaseId
          ? {
              ...track,
              release: { ...track.release, id: undefined },
              releaseAppearances: track.releaseAppearances.map((appearance) =>
                appearance.releaseId === releaseId
                  ? { ...appearance, releaseId: undefined }
                  : appearance,
              ),
            }
          : track,
      ),
      ownedItems: state.ownedItems.filter(
        (item) => item.releaseId !== releaseId,
      ),
      relations: state.relations.map((relation) =>
        unlinkRelationRecord(relation, 'release', releaseId),
      ),
    }))
  ) {
    return
  }

  await sendDelete(`/api/releases/${releaseId}`, `release:${releaseId}`)
}

export async function uploadReleaseCover(releaseId: string, file: File) {
  const coverImage = toReleaseCoverImageFromFile(releaseId, file)
  if (
    updateTestCatalogState((state) =>
      applyReleaseCoverToState(state, releaseId, coverImage),
    )
  ) {
    return
  }

  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`/api/releases/${releaseId}/cover-image`, {
    body: formData,
    credentials: 'include',
    method: 'PUT',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  const responseBody = (await response.json()) as ReleaseCoverImageDto
  assertNoCollectionIds(responseBody)
}

export async function removeReleaseCover(releaseId: string) {
  if (
    updateTestCatalogState((state) =>
      applyReleaseCoverToState(state, releaseId, undefined),
    )
  ) {
    return
  }

  await sendDelete(
    `/api/releases/${releaseId}/cover-image`,
    `release-cover:${releaseId}`,
  )
}

function applyReleaseCoverToState(
  state: CatalogState,
  releaseId: string,
  coverImage: ReleaseCoverImage | undefined,
): CatalogState {
  const releases = state.releases.map((release) =>
    release.id === releaseId ? { ...release, coverImage } : release,
  )
  const updatedRelease = releases.find((release) => release.id === releaseId)

  return {
    ...state,
    releases,
    tracks: updatedRelease
      ? state.tracks.map((track) =>
          updateReleaseMetadataOnTrack(track, updatedRelease),
        )
      : state.tracks,
  }
}

export async function createTrack(track: TrackRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      tracks: [...state.tracks, track],
    }))
  ) {
    return
  }

  await createTrackRecord(track)
}

async function createTrackRecord(track: TrackRecord) {
  const genreSet = activeGenreLabelSet()

  return sendJson<TrackDto>('/api/tracks', 'POST', {
    title: track.title,
    durationSeconds: parseDuration(track.duration),
    genres: track.tags.filter((tag) => genreSet.has(tag)),
    tags: track.tags.filter((tag) => !genreSet.has(tag)),
    credits: track.credits.map(toTrackCreditRequest),
    releaseAppearances: track.releaseAppearances
      .filter((appearance) => appearance.releaseId)
      .map(toTrackAppearanceRequest),
  })
}

export async function updateTrack(track: TrackRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      tracks: state.tracks.map((record) =>
        record.id === track.id ? track : record,
      ),
      relations: state.relations.map((relation) => ({
        ...relation,
        source:
          relation.sourceLink?.kind === 'track' &&
          relation.sourceLink.id === track.id
            ? track.title
            : relation.source,
        target:
          relation.targetLink?.kind === 'track' &&
          relation.targetLink.id === track.id
            ? track.title
            : relation.target,
        linkedEntity:
          relation.linkedEntityLink?.kind === 'track' &&
          relation.linkedEntityLink.id === track.id
            ? track.title
            : relation.linkedEntity,
      })),
    }))
  ) {
    return
  }

  const genreSet = activeGenreLabelSet()

  await sendJson(`/api/tracks/${track.id}`, 'PUT', {
    title: track.title,
    durationSeconds: parseDuration(track.duration),
    genres: track.tags.filter((tag) => genreSet.has(tag)),
    tags: track.tags.filter((tag) => !genreSet.has(tag)),
    credits: track.credits.map(toTrackCreditRequest),
    releaseAppearances: track.releaseAppearances
      .filter((appearance) => appearance.releaseId)
      .map(toTrackAppearanceRequest),
  })
}

export async function deleteTrack(trackId: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      tracks: state.tracks.filter((track) => track.id !== trackId),
      relations: state.relations.map((relation) =>
        unlinkRelationRecord(relation, 'track', trackId),
      ),
    }))
  ) {
    return
  }

  await sendDelete(`/api/tracks/${trackId}`, `track:${trackId}`)
}

export async function createOwnedItem(item: OwnedItemRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ownedItems: [...state.ownedItems, item],
    }))
  ) {
    return
  }

  if (!item.releaseId) {
    throw new Error(
      'Owned items must be linked to an existing release before saving.',
    )
  }

  await createOwnedItemForRelease(
    item.releaseId,
    item.medium,
    item.status,
    item.condition,
    item.storage,
  )
}

export async function updateOwnedItem(item: OwnedItemRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ownedItems: state.ownedItems.map((record) =>
        record.id === item.id ? item : record,
      ),
    }))
  ) {
    return
  }

  await sendJson(`/api/owned-items/${item.id}`, 'PUT', {
    status: toOwnershipStatusCode(item.status),
    condition: toConditionCode(item.condition),
    storageLocation: item.storage,
  })
}

export async function deleteOwnedItem(itemId: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ownedItems: state.ownedItems.filter((item) => item.id !== itemId),
      relations: state.relations.map((relation) =>
        unlinkRelationRecord(relation, 'ownedItem', itemId),
      ),
    }))
  ) {
    return
  }

  await sendDelete(`/api/owned-items/${itemId}`, `owned-item:${itemId}`)
}

export async function createRelation(relation: RelationRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      relations: [...state.relations, relation],
    }))
  ) {
    return
  }

  if (
    relation.sourceLink?.kind === 'artist' &&
    relation.targetLink?.kind === 'artist'
  ) {
    await sendJson('/api/artist-relations', 'POST', {
      sourceArtistId: relation.sourceLink.id,
      targetArtistId: relation.targetLink.id,
      type: toArtistRelationTypeCode(relation.relationType),
      startYear: null,
      endYear: null,
    })
    return
  }

  if (
    relation.sourceLink?.kind === 'track' &&
    relation.targetLink?.kind === 'track'
  ) {
    await sendJson('/api/track-relations', 'POST', {
      sourceTrackId: relation.sourceLink.id,
      targetTrackId: relation.targetLink.id,
      type: toTrackRelationTypeCode(relation.relationType),
    })
    return
  }

  throw new Error(
    'Relations must link two existing artists or two existing tracks before saving.',
  )
}

export async function updateRelation(relation: RelationRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      relations: state.relations.map((record) =>
        record.id === relation.id ? relation : record,
      ),
    }))
  ) {
    return
  }

  if (
    relation.sourceLink?.kind === 'artist' &&
    relation.targetLink?.kind === 'artist'
  ) {
    await sendJson(`/api/artist-relations/${relation.id}`, 'PUT', {
      sourceArtistId: relation.sourceLink.id,
      targetArtistId: relation.targetLink.id,
      type: toArtistRelationTypeCode(relation.relationType),
      startYear: null,
      endYear: null,
    })
    return
  }

  if (
    relation.sourceLink?.kind === 'track' &&
    relation.targetLink?.kind === 'track'
  ) {
    await sendJson(`/api/track-relations/${relation.id}`, 'PUT', {
      sourceTrackId: relation.sourceLink.id,
      targetTrackId: relation.targetLink.id,
      type: toTrackRelationTypeCode(relation.relationType),
    })
    return
  }

  throw new Error(
    'Relations must link two existing artists or two existing tracks before saving.',
  )
}

export async function deleteRelation(relation: RelationRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      relations: state.relations
        .filter((record) => record.id !== relation.id)
        .map((record) => unlinkRelationRecord(record, 'relation', relation.id)),
    }))
  ) {
    return
  }

  if (
    relation.sourceLink?.kind === 'artist' &&
    relation.targetLink?.kind === 'artist'
  ) {
    await sendDelete(
      `/api/artist-relations/${relation.id}`,
      `artist-relation:${relation.id}`,
    )
    return
  }

  if (
    relation.sourceLink?.kind === 'track' &&
    relation.targetLink?.kind === 'track'
  ) {
    await sendDelete(
      `/api/track-relations/${relation.id}`,
      `track-relation:${relation.id}`,
    )
    return
  }

  throw new Error(
    'Only artist and track relations can be deleted through the API.',
  )
}

export type DictionaryEntryRequest = {
  kind: DictionaryKind
  code: string
  name: string
  sortOrder?: number
  isActive?: boolean
  mediaProfile?: string | null
}

export type DictionaryEntryUpdateRequest = {
  name: string
  sortOrder?: number
  isActive?: boolean
  mediaProfile?: string | null
}

export async function createDictionaryEntry(request: DictionaryEntryRequest) {
  if (
    updateDictionaryState((dictionaries) => ({
      ...dictionaries,
      [request.kind]: [
        ...dictionaries[request.kind],
        {
          id: `${request.kind}:${request.code}`,
          kind: request.kind,
          code: request.code,
          name: request.name,
          sortOrder: request.sortOrder ?? 100,
          isActive: request.isActive ?? true,
          isBuiltin: false,
          isProtected: false,
          mediaProfile: request.mediaProfile,
        },
      ],
    }))
  ) {
    return
  }

  const created = await sendJson<DictionaryEntry>(
    '/api/settings/dictionaries',
    'POST',
    request,
  )
  updateDictionaryState((dictionaries) => ({
    ...dictionaries,
    [created.kind]: [...dictionaries[created.kind], created],
  }))
}

export async function updateDictionaryEntry(
  entryId: string,
  request: DictionaryEntryUpdateRequest,
) {
  if (
    updateDictionaryState((dictionaries) => {
      for (const kind of dictionaryKinds) {
        if (dictionaries[kind].some((entry) => entry.id === entryId)) {
          return {
            ...dictionaries,
            [kind]: dictionaries[kind].map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    name: request.name,
                    sortOrder: request.sortOrder ?? entry.sortOrder,
                    isActive: request.isActive ?? entry.isActive,
                    mediaProfile:
                      entry.kind === 'mediaType'
                        ? request.mediaProfile
                        : entry.mediaProfile,
                  }
                : entry,
            ),
          }
        }
      }

      return dictionaries
    })
  ) {
    return
  }

  const updated = await sendJson<DictionaryEntry>(
    `/api/settings/dictionaries/${entryId}`,
    'PUT',
    request,
  )
  updateDictionaryState((dictionaries) => ({
    ...dictionaries,
    [updated.kind]: dictionaries[updated.kind].map((entry) =>
      entry.id === updated.id ? updated : entry,
    ),
  }))
}

export async function deleteDictionaryEntry(entry: DictionaryEntry) {
  if (
    updateDictionaryState((dictionaries) => ({
      ...dictionaries,
      [entry.kind]: dictionaries[entry.kind].filter(
        (currentEntry) => currentEntry.id !== entry.id,
      ),
    }))
  ) {
    return
  }

  await sendDelete(
    `/api/settings/dictionaries/${entry.id}`,
    `dictionary-entry:${entry.id}`,
  )
  updateDictionaryState((dictionaries) => ({
    ...dictionaries,
    [entry.kind]: dictionaries[entry.kind].filter(
      (currentEntry) => currentEntry.id !== entry.id,
    ),
  }))
}

export async function replaceDictionaryEntry(
  entry: DictionaryEntry,
  replacementCode: string,
) {
  if (
    updateDictionaryState((dictionaries) => ({
      ...dictionaries,
      [entry.kind]: dictionaries[entry.kind].filter(
        (currentEntry) => currentEntry.id !== entry.id,
      ),
    }))
  ) {
    return
  }

  await sendJson<DictionaryEntry>(
    `/api/settings/dictionaries/${entry.id}/replace`,
    'POST',
    { replacementCode },
  )
  updateDictionaryState((dictionaries) => ({
    ...dictionaries,
    [entry.kind]: dictionaries[entry.kind].filter(
      (currentEntry) => currentEntry.id !== entry.id,
    ),
  }))
}

export type RatingCriterionRequest = {
  code: string
  name: string
  targetTypes: RatingTargetType[]
  sortOrder?: number
  isActive?: boolean
}

export type RatingCriterionUpdateRequest = {
  name: string
  targetTypes: RatingTargetType[]
  sortOrder?: number
  isActive?: boolean
}

export async function createRatingCriterion(request: RatingCriterionRequest) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ratingCriteria: [
        ...(state.ratingCriteria ?? defaultRatingCriteria),
        {
          id: `rating-criterion:${request.code}`,
          code: request.code,
          name: request.name,
          targetTypes: request.targetTypes,
          sortOrder: request.sortOrder ?? 100,
          isActive: request.isActive ?? true,
          isBuiltin: false,
          isProtected: false,
        },
      ],
    }))
  ) {
    return
  }

  await sendJson<RatingCriterion>('/api/rating-criteria', 'POST', request)
}

export async function updateRatingCriterion(
  criterionId: string,
  request: RatingCriterionUpdateRequest,
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ratingCriteria: (state.ratingCriteria ?? defaultRatingCriteria).map(
        (criterion) =>
          criterion.id === criterionId
            ? {
                ...criterion,
                name: request.name,
                targetTypes: request.targetTypes,
                sortOrder: request.sortOrder ?? criterion.sortOrder,
                isActive: request.isActive ?? criterion.isActive,
              }
            : criterion,
      ),
    }))
  ) {
    return
  }

  await sendJson<RatingCriterion>(
    `/api/rating-criteria/${criterionId}`,
    'PUT',
    request,
  )
}

export async function deleteRatingCriterion(criterion: RatingCriterion) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ratingCriteria: (state.ratingCriteria ?? defaultRatingCriteria).filter(
        (item) => item.id !== criterion.id,
      ),
      ratings: (state.ratings ?? []).filter(
        (rating) => rating.criterionId !== criterion.id,
      ),
    }))
  ) {
    return
  }

  await sendDelete(
    `/api/rating-criteria/${criterion.id}`,
    `rating-criterion:${criterion.id}`,
  )
}

export async function upsertRating(
  targetType: RatingTargetType,
  targetId: string,
  criterionId: string,
  value: number,
) {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error('Rating value must be an integer from 1 to 10')
  }

  if (
    updateTestCatalogState((state) => {
      const ratings = state.ratings ?? []
      const existing = ratings.find(
        (rating) =>
          rating.targetType === targetType &&
          rating.targetId === targetId &&
          rating.criterionId === criterionId,
      )
      const nextRating: EntityRating = {
        id: existing?.id ?? `rating:${criterionId}:${targetType}:${targetId}`,
        criterionId,
        targetType,
        targetId,
        value,
      }

      return {
        ...state,
        ratings: existing
          ? ratings.map((rating) =>
              rating.id === existing.id ? nextRating : rating,
            )
          : [...ratings, nextRating],
      }
    })
  ) {
    return
  }

  await sendJson<RatingValueDto>(
    `/api/ratings/${targetType}/${targetId}/${criterionId}`,
    'PUT',
    { value },
  )
}

export async function deleteRating(
  targetType: RatingTargetType,
  targetId: string,
  criterionId: string,
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ratings: (state.ratings ?? []).filter(
        (rating) =>
          !(
            rating.targetType === targetType &&
            rating.targetId === targetId &&
            rating.criterionId === criterionId
          ),
      ),
    }))
  ) {
    return
  }

  const response = await fetch(
    `/api/ratings/${targetType}/${targetId}/${criterionId}`,
    {
      credentials: 'include',
      method: 'DELETE',
    },
  )

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }
}

export async function loadImportSessions() {
  return getAllPages<ReleaseImportSession>('/api/imports')
}

export async function getImportSession(sessionId: string) {
  return getJson<ReleaseImportSession>(`/api/imports/${sessionId}`)
}

export async function createDesktopFolderScan(
  request: DesktopFolderScanRequest,
) {
  return sendJson<ReleaseImportSession>(
    '/api/imports/desktop-folder-scans',
    'POST',
    request,
  )
}

export async function updateImportDraft(
  sessionId: string,
  draft: ReleaseImportDraft,
) {
  return sendJson<ReleaseImportSession>(
    `/api/imports/${sessionId}/drafts/${draft.id}`,
    'PUT',
    {
      title: draft.title,
      type: draft.type,
      catalogNumber: draft.catalogNumber,
      labelName: draft.labelName,
      releaseDate: draft.releaseDate,
      year: draft.year,
      isVariousArtists: draft.isVariousArtists,
      notOnLabel: draft.notOnLabel,
      artistNames: draft.artistNames,
      artistCredits: draft.artistCredits ?? [],
      labels: draft.labels ?? [],
      selectedArtistIds: draft.selectedArtistIds,
      genres: draft.genres,
      tags: draft.tags,
      coverPath: draft.coverPath,
      tracks: draft.tracks.map((track) => ({
        id: track.id,
        position: track.position,
        title: track.title,
        durationSeconds: track.durationSeconds,
        artistNames: track.artistNames,
        artistCredits: track.artistCredits ?? [],
        selectedArtistIds: track.selectedArtistIds,
        selectedTrackId: track.selectedTrackId,
        isSkipped: track.isSkipped,
      })),
    },
  )
}

export async function confirmImportDraft(sessionId: string, draftId: string) {
  return postEmpty<ReleaseImportSession>(
    `/api/imports/${sessionId}/drafts/${draftId}/confirm`,
  )
}

export async function skipImportDraft(sessionId: string, draftId: string) {
  return postEmpty<ReleaseImportSession>(
    `/api/imports/${sessionId}/drafts/${draftId}/skip`,
  )
}

export async function loadImportPatterns() {
  return getAllPages<ImportPattern>('/api/settings/import-patterns')
}

export async function createImportPattern(request: ImportPatternRequest) {
  return sendJson<ImportPattern>(
    '/api/settings/import-patterns',
    'POST',
    request,
  )
}

export async function updateImportPattern(
  patternId: string,
  request: ImportPatternRequest,
) {
  return sendJson<ImportPattern>(
    `/api/settings/import-patterns/${patternId}`,
    'PUT',
    request,
  )
}

export async function deleteImportPattern(patternId: string) {
  const response = await fetch(`/api/settings/import-patterns/${patternId}`, {
    credentials: 'include',
    method: 'DELETE',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }
}

export async function testImportPattern(
  kind: ImportPatternKind,
  template: string,
  input: string,
) {
  return sendJson<ImportPatternTestResult>(
    '/api/settings/import-patterns/test',
    'POST',
    { kind, template, input },
  )
}

function updateDictionaryState(
  mutator: (dictionaries: CatalogDictionaries) => CatalogDictionaries,
) {
  if (canUseTestCatalogMutation() && testCatalogState?.dictionaries) {
    updateTestCatalogState((state) => ({
      ...state,
      dictionaries: mutator(state.dictionaries ?? defaultCatalogDictionaries),
    }))
    return true
  }

  return false
}

async function syncMainArtistCredit(
  targetType: 'release' | 'track',
  targetId: string,
  artistId: string | undefined,
) {
  if (!artistId) {
    return
  }

  const credits = await getAllPages<CreditDto>('/api/credits', {
    role: 'mainArtist',
    targetId,
    targetType,
  })
  const existingCredit = credits.items[0]
  const body = {
    contributorArtistId: artistId,
    targetId,
    targetType,
    role: 'mainArtist',
  }

  if (!existingCredit) {
    await sendJson('/api/credits', 'POST', body)
    return
  }

  if (existingCredit.contributorArtistId !== artistId) {
    await sendJson(`/api/credits/${existingCredit.id}`, 'PUT', body)
  }
}

async function createOwnedItemForRelease(
  releaseId: string,
  medium: string,
  status: string,
  condition: string,
  storageLocation: string,
) {
  return sendJson<OwnedItemDto>('/api/owned-items', 'POST', {
    targetType: 'release',
    targetId: releaseId,
    status: toOwnershipStatusCode(status),
    medium: toMediumRequest(medium),
    condition: toConditionCode(condition),
    storageLocation,
  })
}

async function sendJson<T = unknown>(
  path: string,
  method: 'POST' | 'PUT',
  body: unknown,
): Promise<T> {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method,
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  const responseBody = (await response.json()) as T
  assertNoCollectionIds(responseBody)

  return responseBody
}

async function postEmpty<T = unknown>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  const responseBody = (await response.json()) as T
  assertNoCollectionIds(responseBody)

  return responseBody
}

async function sendDelete(path: string, confirmation: string) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'X-Cratebase-Confirm-Delete': confirmation },
    method: 'DELETE',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }
}

function assertNoCollectionIds(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoCollectionIds)
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'collectionId' || key === 'defaultCollectionId') {
      throw new Error('Catalog responses must not expose collection ids.')
    }

    assertNoCollectionIds(child)
  }
}

export class CatalogApiError extends Error {
  readonly status: number
  readonly code: string | null

  private constructor(status: number, code: string | null, message: string) {
    super(message)
    this.status = status
    this.code = code
  }

  static async fromResponse(response: Response) {
    const body = await readOptionalJson<ErrorResponseDto>(response)

    return new CatalogApiError(
      response.status,
      body?.code ?? null,
      body?.message ??
        `Catalog API request failed with HTTP ${response.status}.`,
    )
  }
}

async function readOptionalJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

function groupCreditsByTarget(credits: CreditDto[]) {
  const result = new Map<string, CreditDto[]>()

  for (const credit of credits) {
    const key = `${credit.targetType}:${credit.targetId}`
    result.set(key, [...(result.get(key) ?? []), credit])
  }

  return result
}

function targetCredits(
  creditsByTarget: Map<string, CreditDto[]>,
  targetType: string,
  targetId: string,
) {
  return creditsByTarget.get(`${targetType}:${targetId}`) ?? []
}

function groupRatingsByTarget(ratings: EntityRating[]) {
  const result = new Map<string, EntityRating[]>()

  for (const rating of ratings) {
    const key = `${rating.targetType}:${rating.targetId}`
    result.set(key, [...(result.get(key) ?? []), rating])
  }

  return result
}

function targetRatings(
  ratings: EntityRating[] | Map<string, EntityRating[]>,
  targetType: RatingTargetType,
  targetId: string,
) {
  if (ratings instanceof Map) {
    return ratings.get(`${targetType}:${targetId}`) ?? []
  }

  return ratings.filter(
    (rating) =>
      rating.targetType === targetType && rating.targetId === targetId,
  )
}

function toArtistRecord(
  artist: ArtistDto,
  credits: CreditDto[],
  relations: ArtistRelationDto[],
  artistsById: Map<string, ArtistDto>,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
  dictionaries: CatalogDictionaries,
  ratingsByTarget: Map<string, EntityRating[]>,
): ArtistRecord {
  const artistCredits = credits.filter(
    (credit) => credit.contributorArtistId === artist.id,
  )
  const artistRelations = relations.filter(
    (relation) =>
      relation.sourceArtistId === artist.id ||
      relation.targetArtistId === artist.id,
  )

  return {
    id: artist.id,
    name: artist.name,
    type: toArtistType(artist.type),
    aliases: [],
    members: artistRelations
      .filter(
        (relation) =>
          relation.type === 'memberOf' && relation.targetArtistId === artist.id,
      )
      .map(
        (relation) =>
          artistsById.get(relation.sourceArtistId)?.name ?? 'Unknown artist',
      ),
    relationHint:
      artistRelations
        .map((relation) =>
          relationTypeLabel(relation.type, 'artistRelationType', dictionaries),
        )
        .join(', ') || 'No relations recorded',
    creditHint:
      artistCredits
        .map((credit) => creditRoleLabel(credit.role, dictionaries))
        .join(', ') || 'No credits recorded',
    relations: artistRelations.map((relation) => {
      const isSource = relation.sourceArtistId === artist.id
      const target = artistsById.get(
        isSource ? relation.targetArtistId : relation.sourceArtistId,
      )

      return {
        type: relationTypeLabel(
          relation.type,
          'artistRelationType',
          dictionaries,
        ),
        target: target?.name ?? 'Unknown artist',
        detail: relationPeriodText(relation),
      }
    }),
    credits: artistCredits.map((credit) => ({
      role: creditRoleLabel(credit.role, dictionaries),
      target:
        credit.targetType === 'release'
          ? (releasesById.get(credit.targetId)?.title ?? 'Unknown release')
          : (tracksById.get(credit.targetId)?.title ?? 'Unknown track'),
      scope: credit.targetType === 'release' ? 'Release' : 'Track',
    })),
    tags: [],
    summary: '',
    ratings: targetRatings(ratingsByTarget, 'artist', artist.id),
  }
}

function toReleaseRecord(
  release: ReleaseDto,
  labelsById: Map<string, LabelDto>,
  creditsByTarget: Map<string, CreditDto[]>,
  artistsById: Map<string, ArtistDto>,
  ownedItems: OwnedItemDto[],
  dictionaries: CatalogDictionaries,
  ratingsByTarget: Map<string, EntityRating[]>,
): ReleaseRecord {
  const credits = targetCredits(creditsByTarget, 'release', release.id)
  const responseCredits = release.artistCredits ?? []
  const releaseCredits: ReleaseArtistCredit[] =
    responseCredits.length > 0
      ? responseCredits.map((credit) =>
          toReleaseArtistCredit(credit, dictionaries),
        )
      : credits.map((credit) => ({
          artistId: credit.contributorArtistId,
          artist:
            artistsById.get(credit.contributorArtistId)?.name ??
            credit.contributorName,
          role: creditRoleLabel(credit.role, dictionaries),
        }))
  const mainCredits = releaseCredits.filter((credit) =>
    isMainArtistRole(credit.role, dictionaries),
  )
  const artistDisplay = release.isVariousArtists
    ? 'Various Artists'
    : (mainCredits.length > 0 ? mainCredits : releaseCredits)
        .map((credit) => credit.artist)
        .join(', ') || 'Unknown artist'
  const releaseLabels = (release.labels ?? []).map(toReleaseLabel)
  const labelDisplay = release.notOnLabel
    ? 'Not On Label'
    : releaseLabels.length > 0
      ? releaseLabels.map(releaseLabelDisplay).join(', ')
      : release.labelId
        ? (labelsById.get(release.labelId)?.name ?? 'Unknown label')
        : 'Unknown label'
  const mainCredit = mainCredits[0] ?? releaseCredits[0]

  return {
    id: release.id,
    title: release.title,
    artistId: mainCredit?.artistId,
    artist: artistDisplay,
    artistCredits: releaseCredits,
    type: toReleaseType(release.type, dictionaries),
    year: release.year?.toString() ?? 'Unknown year',
    releaseDate: release.releaseDate ?? undefined,
    label: labelDisplay,
    labels: releaseLabels,
    isVariousArtists: Boolean(release.isVariousArtists),
    notOnLabel: Boolean(release.notOnLabel),
    genres: release.genres,
    tags: release.tags,
    releaseNotes: '',
    coverImage: release.coverImage
      ? toReleaseCoverImage(release.coverImage)
      : undefined,
    ownedCopies: [
      ...ownedItems
        .filter(
          (item) =>
            item.targetType === 'release' && item.targetId === release.id,
        )
        .map((item) => ({
          id: item.id,
          medium: mediumLabel(item.medium, dictionaries),
          status: ownedCopyStatusLabel(item.status),
          storage: item.storageLocation ?? 'No storage recorded',
          condition: conditionLabel(item.condition),
          note: '',
        })),
      ...releaseTrackDigitalCopies(release, ownedItems),
    ],
    ratings: targetRatings(ratingsByTarget, 'release', release.id),
  }
}

function toReleaseCoverImage(
  coverImage: ReleaseCoverImageDto,
): ReleaseCoverImage {
  return {
    url: coverImage.url,
    contentType: coverImage.contentType,
    originalFileName: coverImage.originalFileName,
    sizeBytes: coverImage.sizeBytes,
    sourceType: coverImage.sourceType,
  }
}

function toReleaseCoverImageFromFile(
  releaseId: string,
  file: File,
): ReleaseCoverImage {
  return {
    url: `/api/releases/${releaseId}/cover-image`,
    contentType: file.type,
    originalFileName: file.name,
    sizeBytes: file.size,
    sourceType: 'localUpload',
  }
}

function releaseTrackDigitalCopies(
  release: ReleaseDto,
  ownedItems: OwnedItemDto[],
): OwnedCopy[] {
  const trackIds = new Set(
    (release.tracklist ?? []).map((track) => track.trackId),
  )
  const digitalItems = ownedItems.filter(
    (item) =>
      item.targetType === 'track' &&
      trackIds.has(item.targetId) &&
      isDigitalFileMedium(item.medium),
  )

  if (digitalItems.length === 0) {
    return []
  }

  const formats = [
    ...new Set(
      digitalItems
        .map((item) => item.medium.format?.toUpperCase())
        .filter((format): format is string => Boolean(format)),
    ),
  ]

  return [
    {
      id: `${release.id}:track-digital-files`,
      medium: 'Digital',
      status: 'Owned',
      storage: `${digitalItems.length} track file${digitalItems.length === 1 ? '' : 's'}`,
      condition: formats.length > 0 ? formats.join(', ') : 'Files recorded',
      note: 'Track-level digital ownership',
    },
  ]
}

function toTrackRecord(
  track: TrackDto,
  creditsByTarget: Map<string, CreditDto[]>,
  releasesById: Map<string, ReleaseDto>,
  releaseTrackByTrackId: Map<string, ReleaseTrackContext[]>,
  ownedItems: OwnedItemDto[],
  dictionaries: CatalogDictionaries,
  ratingsByTarget: Map<string, EntityRating[]>,
): TrackRecord {
  const credits = targetCredits(creditsByTarget, 'track', track.id)
  const releaseTracks = releaseTrackByTrackId.get(track.id) ?? []
  const primaryReleaseTrack = releaseTracks[0]
  const releaseAppearances =
    track.releaseAppearances?.map((appearance) => {
      const appearanceRelease = releasesById.get(appearance.releaseId)

      return {
        releaseId: appearance.releaseId,
        coverImage: appearanceRelease?.coverImage
          ? toReleaseCoverImage(appearanceRelease.coverImage)
          : undefined,
        releaseTitle: appearance.releaseTitle,
        releaseArtist: appearance.releaseArtist,
        year: appearance.year?.toString() ?? 'Unknown year',
        label: appearance.label ?? 'Unknown label',
        position: appearance.position.toString(),
        duration: formatDuration(
          appearance.durationSeconds ?? track.durationSeconds,
        ),
        versionNote: appearance.versionNote ?? 'No version relation recorded',
      }
    }) ??
    releaseTracks.map(({ release: releaseContext, track: releaseTrack }) => {
      const appearanceRelease = releasesById.get(releaseContext.id)

      return {
        releaseId: appearanceRelease?.id,
        coverImage: appearanceRelease?.coverImage
          ? toReleaseCoverImage(appearanceRelease.coverImage)
          : undefined,
        releaseTitle: appearanceRelease?.title ?? releaseContext.title,
        releaseArtist: appearanceRelease
          ? releaseArtistDisplay(appearanceRelease)
          : 'Unknown artist',
        year: appearanceRelease?.year?.toString() ?? 'Unknown year',
        label: appearanceRelease
          ? releaseLabelDisplayFromDto(appearanceRelease)
          : 'Unknown label',
        position: releaseTrack.position.toString(),
        duration: formatDuration(
          releaseTrack.durationSeconds ?? track.durationSeconds,
        ),
        versionNote: releaseTrack.versionNote ?? 'No version relation recorded',
      }
    })
  const primaryAppearance = primaryReleaseTrack
    ? undefined
    : releaseAppearances[0]
  const trackCredits = track.credits
    ? track.credits.map((credit) =>
        toTrackCreditFromTrackCreditDto(credit, dictionaries),
      )
    : primaryReleaseTrack?.track.artistCredits &&
        primaryReleaseTrack.track.artistCredits.length > 0
      ? primaryReleaseTrack.track.artistCredits.map((credit) =>
          toTrackCreditFromReleaseCredit(credit, dictionaries),
        )
      : credits.map((credit) => toTrackCredit(credit, dictionaries))
  const mainCredit =
    trackCredits.find((credit) =>
      isMainArtistRole(credit.role, dictionaries),
    ) ?? trackCredits[0]
  const release = primaryReleaseTrack?.release
    ? releasesById.get(primaryReleaseTrack.release.id)
    : primaryAppearance?.releaseId
      ? releasesById.get(primaryAppearance.releaseId)
      : undefined
  const releaseTitle =
    release?.title ?? primaryAppearance?.releaseTitle ?? 'Unlinked release'
  const releaseArtist = release
    ? releaseArtistDisplay(release)
    : primaryAppearance?.releaseArtist
  const releaseYear =
    release?.year?.toString() ?? primaryAppearance?.year ?? 'Unknown year'
  const releaseLabel = release
    ? releaseLabelDisplayFromDto(release)
    : (primaryAppearance?.label ?? 'Unknown label')
  const trackNumber =
    primaryReleaseTrack?.track.position.toString() ??
    primaryAppearance?.position ??
    'Unnumbered'
  const trackDuration =
    primaryReleaseTrack?.track.durationSeconds !== undefined
      ? formatDuration(primaryReleaseTrack.track.durationSeconds)
      : (primaryAppearance?.duration ?? formatDuration(track.durationSeconds))
  const versionHint =
    primaryReleaseTrack?.track.versionNote ??
    primaryAppearance?.versionNote ??
    'No version relation recorded'
  const trackArtist = mainCredit?.artist ?? releaseArtist ?? 'Unknown artist'
  const digitalFileItem = ownedItems.find(
    (item) =>
      item.targetType === 'track' &&
      item.targetId === track.id &&
      isDigitalFileMedium(item.medium),
  )

  return {
    id: track.id,
    title: track.title,
    artistId: mainCredit?.artistId,
    artist: trackArtist,
    release: {
      id: release?.id,
      title: releaseTitle,
      artist: releaseArtist ?? trackArtist,
      year: releaseYear,
      label: releaseLabel,
    },
    trackNumber,
    duration: trackDuration,
    versionHint,
    relationHint: '',
    tags: [...track.genres, ...track.tags],
    credits: trackCredits,
    releaseAppearances,
    relations: [],
    fileMetadata: {
      format: digitalFileItem?.medium.format?.toUpperCase() ?? 'None recorded',
      path: digitalFileItem?.medium.path ?? 'No file linked',
      bitrate: 'Not recorded',
      sampleRate: 'Not recorded',
      channels: 'Not recorded',
      importedAt: digitalFileItem ? 'Imported file' : 'Not recorded',
      checksum: 'Not recorded',
    },
    ratings: targetRatings(ratingsByTarget, 'track', track.id),
  }
}

function toOwnedItemRecord(
  item: OwnedItemDto,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
  releases: ReleaseRecord[],
  tracks: TrackRecord[],
  dictionaries: CatalogDictionaries,
): OwnedItemRecord {
  const release =
    item.targetType === 'release' ? releasesById.get(item.targetId) : undefined
  const track =
    item.targetType === 'track' ? tracksById.get(item.targetId) : undefined
  const releaseRecord = release
    ? releases.find((record) => record.id === release.id)
    : undefined
  const trackRecord = track
    ? tracks.find((record) => record.id === track.id)
    : undefined
  const status = ownershipStatusLabel(item.status)

  return {
    id: item.id,
    title: release?.title ?? track?.title ?? 'Owned item',
    releaseId: release?.id,
    releaseTitle:
      release?.title ?? trackRecord?.release.title ?? 'Unlinked release',
    artist: releaseRecord?.artist ?? trackRecord?.artist ?? 'Unknown artist',
    medium: mediumLabel(item.medium, dictionaries),
    status,
    statusTone: statusToneFor(status),
    storage: item.storageLocation ?? 'No storage recorded',
    condition: conditionLabel(item.condition),
    acquisition: 'Not recorded',
    copyNotes: '',
    linkedType: item.targetType === 'track' ? 'Track' : 'Release',
    fileFormat:
      item.medium.format && !isManualDigitalPlaceholder(item.medium)
        ? item.medium.format.toUpperCase()
        : 'None recorded',
    digitalState:
      item.medium.type === 'digital'
        ? isManualDigitalPlaceholder(item.medium)
          ? 'Digital copy recorded'
          : 'Digital file recorded'
        : 'No digital file recorded',
    digitizationState:
      status === 'Needs digitization'
        ? 'Needs digitization'
        : 'No digitization state recorded',
    tags: [],
  }
}

function toArtistRelationRecord(
  relation: ArtistRelationDto,
  artistsById: Map<string, ArtistDto>,
  dictionaries: CatalogDictionaries,
): RelationRecord {
  const source = artistsById.get(relation.sourceArtistId)
  const target = artistsById.get(relation.targetArtistId)
  const type = relationTypeLabel(
    relation.type,
    'artistRelationType',
    dictionaries,
  )

  return {
    id: relation.id,
    source: source?.name ?? 'Unknown artist',
    sourceLink: { kind: 'artist', id: relation.sourceArtistId },
    sourceType: source ? toArtistType(source.type) : 'Artist',
    target: target?.name ?? 'Unknown artist',
    targetLink: { kind: 'artist', id: relation.targetArtistId },
    targetType: target ? toArtistType(target.type) : 'Artist',
    relationType: type,
    role: type,
    context: relationPeriodText(relation),
    evidence: relationPeriodText(relation),
    linkedEntity: target?.name ?? 'Unknown artist',
    linkedEntityLink: { kind: 'artist', id: relation.targetArtistId },
    linkedEntityType: 'Artist',
    direction: 'Artist relation',
    searchHints: [source?.name ?? '', target?.name ?? '', type],
  }
}

function toTrackRelationRecord(
  relation: TrackRelationDto,
  tracksById: Map<string, TrackDto>,
  dictionaries: CatalogDictionaries,
): RelationRecord {
  const source = tracksById.get(relation.sourceTrackId)
  const target = tracksById.get(relation.targetTrackId)
  const type = relationTypeLabel(
    relation.type,
    'trackRelationType',
    dictionaries,
  )

  return {
    id: relation.id,
    source: source?.title ?? 'Unknown track',
    sourceLink: { kind: 'track', id: relation.sourceTrackId },
    sourceType: 'Track',
    target: target?.title ?? 'Unknown track',
    targetLink: { kind: 'track', id: relation.targetTrackId },
    targetType: 'Track',
    relationType: type,
    role: type,
    context: '',
    evidence: '',
    linkedEntity: target?.title ?? 'Unknown track',
    linkedEntityLink: { kind: 'track', id: relation.targetTrackId },
    linkedEntityType: 'Track',
    direction: 'Track relation',
    searchHints: [source?.title ?? '', target?.title ?? '', type],
  }
}

function toTrackCredit(
  credit: CreditDto,
  dictionaries = activeDictionaries,
): TrackCredit {
  return {
    artistId: credit.contributorArtistId,
    role: creditRoleLabel(credit.role, dictionaries),
    artist: credit.contributorName,
    scope: 'Track credit.',
  }
}

function toTrackCreditFromTrackCreditDto(
  credit: TrackCreditDto,
  dictionaries = activeDictionaries,
): TrackCredit {
  return {
    artistId: credit.artistId,
    role: creditRoleLabel(credit.role, dictionaries),
    artist: credit.artistName,
    scope: 'Track credit.',
  }
}

function toTrackCreditFromReleaseCredit(
  credit: ReleaseArtistCreditDto,
  dictionaries = activeDictionaries,
): TrackCredit {
  return {
    artistId: credit.artistId,
    role: creditRoleLabel(credit.role, dictionaries),
    artist: credit.artistName,
    scope: 'Tracklist credit.',
  }
}

function toReleaseArtistCredit(
  credit: ReleaseArtistCreditDto,
  dictionaries = activeDictionaries,
): ReleaseArtistCredit {
  return {
    artistId: credit.artistId,
    artist: credit.artistName,
    role: creditRoleLabel(credit.role, dictionaries),
  }
}

function toReleaseLabel(label: ReleaseLabelDto): ReleaseLabel {
  return {
    labelId: label.labelId ?? undefined,
    name: label.name,
    catalogNumber: label.catalogNumber ?? undefined,
    hasNoCatalogNumber: label.hasNoCatalogNumber,
  }
}

function releaseArtistDisplay(release: ReleaseDto) {
  if (release.isVariousArtists) {
    return 'Various Artists'
  }

  const credits = release.artistCredits ?? []
  const mainCredits = credits.filter(
    (credit) => credit.role === mainArtistRoleCode,
  )
  const visibleCredits = mainCredits.length > 0 ? mainCredits : credits

  return (
    visibleCredits.map((credit) => credit.artistName).join(', ') ||
    'Unknown artist'
  )
}

function releaseLabelDisplayFromDto(release: ReleaseDto) {
  if (release.notOnLabel) {
    return 'Not On Label'
  }

  return (
    release.labels
      ?.map((label) => releaseLabelDisplay(toReleaseLabel(label)))
      .join(', ') || 'Unknown label'
  )
}

function releaseLabelDisplay(label: ReleaseLabel) {
  if (label.catalogNumber) {
    return `${label.name} ${label.catalogNumber}`
  }

  if (label.hasNoCatalogNumber) {
    return `${label.name} (No catalog number)`
  }

  return label.name
}

function releaseArtistCreditsFromDisplay(
  release: ReleaseRecord,
): ReleaseArtistCredit[] {
  const artist = release.artist.trim()
  if (!artist || artist === 'Unknown artist') {
    return []
  }

  return [{ artistId: release.artistId, artist, role: mainArtistRoleLabel() }]
}

function releaseLabelsFromDisplay(release: ReleaseRecord): ReleaseLabel[] {
  const label = release.label.trim()
  if (!label || label === 'Unknown label' || label === 'Not On Label') {
    return []
  }

  return [{ name: label, hasNoCatalogNumber: false }]
}

function toReleaseArtistCreditRequest(credit: ReleaseArtistCredit) {
  return {
    artistId: credit.artistId,
    name: credit.artistId ? null : credit.artist,
    role: toCreditRoleCode(credit.role),
  }
}

function toTrackCreditRequest(credit: TrackCredit) {
  return {
    artistId: credit.artistId,
    name: credit.artistId ? null : credit.artist,
    role: toCreditRoleCode(credit.role),
  }
}

function toTrackAppearanceRequest(
  appearance: TrackRecord['releaseAppearances'][number],
) {
  return {
    releaseId: appearance.releaseId,
    position: parseTrackPosition(appearance.position),
    versionNote:
      appearance.versionNote === 'No version relation recorded'
        ? null
        : appearance.versionNote,
  }
}

function toReleaseTracklistRequest(track: TrackRecord, index: number) {
  const position = parseTrackPosition(track.trackNumber, index + 1)
  const versionNote = isEmptyVersionNote(track.versionHint)
    ? null
    : track.versionHint

  if (isExistingTrackForReleaseRequest(track)) {
    return {
      trackId: track.id,
      position,
      versionNote,
    }
  }

  return {
    title: track.title,
    position,
    durationSeconds: parseDuration(track.duration),
    artistCredits: track.credits.map((credit) =>
      toReleaseArtistCreditRequest({
        artistId: credit.artistId,
        artist: credit.artist,
        role: credit.role,
      }),
    ),
    versionNote,
  }
}

function isExistingTrackForReleaseRequest(track: TrackRecord) {
  return !isManualSessionRecord(track.id) && isUuid(track.id)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function parseTrackPosition(position: string, fallback?: number) {
  const trimmed = position.trim()
  if (
    fallback !== undefined &&
    (trimmed.length === 0 || trimmed === 'Unnumbered')
  ) {
    return fallback
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      'Track position must be a positive number before saving to the API.',
    )
  }

  const parsed = Number.parseInt(trimmed, 10)
  if (parsed < 1) {
    throw new Error(
      'Track position must be a positive number before saving to the API.',
    )
  }

  return parsed
}

function isEmptyVersionNote(note: string) {
  return (
    note === 'No version relation recorded' ||
    note === 'No version note recorded'
  )
}

function toReleaseLabelRequest(label: ReleaseLabel) {
  return {
    labelId: label.labelId,
    name: label.labelId ? null : label.name,
    catalogNumber: label.catalogNumber ?? null,
    hasNoCatalogNumber: label.hasNoCatalogNumber,
  }
}

function toArtistType(type: string): ArtistType {
  return type === 'group' ? 'Band' : 'Person'
}

function toArtistTypeCode(type: ArtistType) {
  return type === 'Band' || type === 'Collective' || type === 'Project'
    ? 'group'
    : 'person'
}

function toReleaseType(
  type: string,
  dictionaries = activeDictionaries,
): ReleaseType {
  return dictionaryLabel(dictionaries, 'releaseType', type)
}

function toReleaseTypeCode(type: ReleaseType) {
  return dictionaryCode('releaseType', type)
}

function ownershipStatusLabel(status: string): OwnedItemStatus {
  switch (status) {
    case 'owned':
      return 'Owned'
    case 'wanted':
      return 'Wanted'
    case 'sold':
      return 'Sold'
    case 'needsDigitization':
      return 'Needs digitization'
    default:
      return 'Not recorded'
  }
}

function ownedCopyStatusLabel(status: string) {
  const label = ownershipStatusLabel(status)

  return label === 'Not recorded' ? 'Owned' : label
}

function toOwnershipStatusCode(status: string) {
  switch (status) {
    case 'Wanted':
      return 'wanted'
    case 'Sold':
      return 'sold'
    case 'Needs digitization':
      return 'needsDigitization'
    default:
      return 'owned'
  }
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

function mediumLabel(medium: MediumDto, dictionaries = activeDictionaries) {
  switch (medium.type) {
    case 'digital':
      return medium.format && !isManualDigitalPlaceholder(medium)
        ? medium.format.toUpperCase()
        : dictionaryLabel(dictionaries, 'mediaType', medium.type)
    case 'vinyl':
      return (
        medium.description ??
        dictionaryLabel(dictionaries, 'mediaType', medium.type)
      )
    case 'cd':
      return medium.discCount && medium.discCount > 1
        ? `${medium.discCount}xCD`
        : dictionaryLabel(dictionaries, 'mediaType', medium.type)
    case 'cassette':
      return (
        medium.description ??
        dictionaryLabel(dictionaries, 'mediaType', medium.type)
      )
    default:
      return (
        medium.description ??
        dictionaryLabel(dictionaries, 'mediaType', medium.type)
      )
  }
}

function isManualDigitalPlaceholder(medium: MediumDto) {
  return (
    medium.type === 'digital' &&
    medium.path === '/cratebase/manual-entry-placeholder'
  )
}

function isDigitalFileMedium(medium: MediumDto) {
  return (
    medium.type === 'digital' &&
    Boolean(medium.path) &&
    !isManualDigitalPlaceholder(medium)
  )
}

function conditionLabel(condition: string | null | undefined) {
  switch (condition) {
    case 'mint':
      return 'Mint'
    case 'nearMint':
      return 'Near Mint'
    case 'veryGoodPlus':
      return 'Very Good Plus'
    case 'veryGood':
      return 'Very Good'
    case 'good':
      return 'Good'
    case 'fair':
      return 'Fair'
    case 'poor':
      return 'Poor'
    default:
      return 'No condition recorded'
  }
}

function toConditionCode(condition: string | null | undefined) {
  const normalized = condition?.trim().toLowerCase() ?? ''
  if (normalized.includes('mint') && normalized.includes('near')) {
    return 'nearMint'
  }
  if (normalized.includes('mint')) {
    return 'mint'
  }
  if (normalized.includes('plus')) {
    return 'veryGoodPlus'
  }
  if (normalized.includes('very')) {
    return 'veryGood'
  }
  if (normalized.includes('good')) {
    return 'good'
  }
  if (normalized.includes('fair')) {
    return 'fair'
  }
  if (normalized.includes('poor')) {
    return 'poor'
  }

  return null
}

function creditRoleLabel(role: string, dictionaries = activeDictionaries) {
  return toCreditRole(dictionaryLabel(dictionaries, 'creditRole', role))
}

function mainArtistRoleLabel(dictionaries = activeDictionaries) {
  return creditRoleLabel(mainArtistRoleCode, dictionaries)
}

function isMainArtistRole(role: string, dictionaries = activeDictionaries) {
  return toCreditRoleCode(role, dictionaries) === mainArtistRoleCode
}

function toCreditRoleCode(role: string, dictionaries = activeDictionaries) {
  return dictionaryCode('creditRole', role, dictionaries)
}

function relationTypeLabel(
  type: string,
  kind: 'artistRelationType' | 'trackRelationType' = 'artistRelationType',
  dictionaries = activeDictionaries,
) {
  return dictionaryLabel(dictionaries, kind, type)
}

function toArtistRelationTypeCode(type: string) {
  return dictionaryCode('artistRelationType', type)
}

function toTrackRelationTypeCode(type: string) {
  return dictionaryCode('trackRelationType', type)
}

function relationPeriodText(relation: ArtistRelationDto) {
  if (relation.startYear && relation.endYear) {
    return `Recorded from ${relation.startYear} to ${relation.endYear}.`
  }

  if (relation.startYear) {
    return `Recorded from ${relation.startYear}.`
  }

  if (relation.endYear) {
    return `Recorded until ${relation.endYear}.`
  }

  return ''
}

function formatDuration(durationSeconds: number | null | undefined) {
  return formatDurationSeconds(durationSeconds)
}

function parseYear(value: string) {
  const year = Number.parseInt(value, 10)

  return Number.isInteger(year) ? year : null
}

function parseDuration(value: string) {
  return parseDurationText(value)
}

function toMediumRequest(value: string): MediumDto {
  const dictionaryEntry = mediaEntryByLabelOrCode(value)
  if (dictionaryEntry) {
    return mediumRequestForDictionaryEntry(dictionaryEntry, value)
  }

  const normalized = value.trim().toLowerCase()
  if (
    normalized.includes('digital') ||
    normalized.includes('flac') ||
    normalized.includes('mp3')
  ) {
    return {
      type: 'digital',
      path: '/cratebase/manual-entry-placeholder',
      format: normalized.includes('mp3') ? 'mp3' : 'flac',
    }
  }

  if (
    normalized.includes('vinyl') ||
    normalized.includes('inch') ||
    normalized.includes('lp')
  ) {
    return { type: 'vinyl', description: value || 'Vinyl' }
  }

  if (normalized.includes('cd')) {
    return { type: 'cd', discCount: 1 }
  }

  if (normalized.includes('cassette')) {
    return { type: 'cassette', description: value || 'Cassette' }
  }

  return { type: 'other', description: value || 'Other' }
}

function mediumRequestForDictionaryEntry(
  entry: DictionaryEntry,
  value: string,
): MediumDto {
  const profile = entry.mediaProfile ?? 'other'
  switch (profile) {
    case 'digital':
      return {
        type: entry.code,
        path: '/cratebase/manual-entry-placeholder',
        format: value.toLowerCase().includes('mp3') ? 'mp3' : 'flac',
      }
    case 'vinyl':
      return { type: entry.code, description: value || entry.name }
    case 'cd':
      return { type: entry.code, discCount: 1 }
    case 'cassette':
      return { type: entry.code, description: value || entry.name }
    default:
      return { type: entry.code, description: value || entry.name }
  }
}
