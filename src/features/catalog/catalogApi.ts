import type { ArtistRecord, ArtistType } from '../artists/artistsData'
import type {
  OwnedItemRecord,
  OwnedItemStatus,
} from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord, ReleaseType } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackCredit, TrackRecord } from '../tracks/tracksData'

const pageSize = 100

export type CatalogState = {
  artists: ArtistRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  ownedItems: OwnedItemRecord[]
  relations: RelationRecord[]
  playlists: PlaylistRecord[]
}

export const emptyCatalogState: CatalogState = {
  artists: [],
  releases: [],
  tracks: [],
  ownedItems: [],
  relations: [],
  playlists: [],
}

let testCatalogState: CatalogState | null = null

export function seedCatalogForTests(state: CatalogState) {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('Test catalog seeding is only available in tests')
  }

  testCatalogState = state
}

export function clearCatalogForTests() {
  if (import.meta.env.MODE === 'test') {
    testCatalogState = null
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

  testCatalogState = mutator(testCatalogState)

  return true
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
  genres: string[]
  tags: string[]
}

type TrackDto = {
  id: string
  title: string
  durationSeconds?: number | null
  genres: string[]
  tags: string[]
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
  ] = await Promise.all([
    getAllPages<ArtistDto>('/api/artists'),
    getAllPages<LabelDto>('/api/labels'),
    getAllPages<ReleaseDto>('/api/releases'),
    getAllPages<TrackDto>('/api/tracks'),
    getAllPages<OwnedItemDto>('/api/owned-items'),
    getAllPages<CreditDto>('/api/credits'),
    getAllPages<ArtistRelationDto>('/api/artist-relations'),
    getAllPages<TrackRelationDto>('/api/track-relations'),
  ])

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
    ),
  )
  const releases = releasesResponse.items.map((release) =>
    toReleaseRecord(
      release,
      labelsById,
      creditsByTarget,
      artistsById,
      ownedItemsResponse.items,
    ),
  )
  const tracks = tracksResponse.items.map((track) =>
    toTrackRecord(track, creditsByTarget, artistsById),
  )
  const ownedItems = ownedItemsResponse.items.map((item) =>
    toOwnedItemRecord(item, releaseDtosById, trackDtosById, releases, tracks),
  )
  const relations = [
    ...artistRelationsResponse.items.map((relation) =>
      toArtistRelationRecord(relation, artistsById),
    ),
    ...trackRelationsResponse.items.map((relation) =>
      toTrackRelationRecord(relation, trackDtosById),
    ),
  ]

  return {
    artists,
    releases,
    tracks,
    ownedItems,
    relations,
    playlists: [],
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
      tracks: [
        ...state.tracks,
        ...tracks.map((track) => ({
          ...track,
          release: { ...track.release, id: release.id, title: release.title },
        })),
      ],
    }))
  ) {
    return
  }

  const releaseDto = await sendJson<ReleaseDto>('/api/releases', 'POST', {
    title: release.title,
    type: toReleaseTypeCode(release.type),
    labelId: await createLabelId(release.label),
    year: parseYear(release.year),
    genres: release.genres,
    tags: release.tags,
  })
  const createdCreditIds: string[] = []
  const createdOwnedItemIds: string[] = []
  const createdTrackIds: string[] = []

  try {
    if (release.artistId) {
      const credit = await createCredit(
        release.artistId,
        'release',
        releaseDto.id,
        'mainArtist',
      )
      createdCreditIds.push(credit.id)
    }

    for (const copy of release.ownedCopies) {
      const ownedItem = await createOwnedItemForRelease(
        releaseDto.id,
        copy.medium,
        copy.status,
        copy.condition,
        copy.storage,
      )
      createdOwnedItemIds.push(ownedItem.id)
    }

    for (const track of tracks) {
      const trackDto = await createTrackRecord({
        ...track,
        release: { ...track.release, id: releaseDto.id },
      })
      createdTrackIds.push(trackDto.id)
    }
  } catch (error) {
    for (const trackId of [...createdTrackIds].reverse()) {
      await deleteTrackBestEffort(trackId)
    }
    for (const ownedItemId of [...createdOwnedItemIds].reverse()) {
      await deleteOwnedItemBestEffort(ownedItemId)
    }
    for (const creditId of [...createdCreditIds].reverse()) {
      await deleteCreditBestEffort(creditId)
    }
    await deleteReleaseBestEffort(releaseDto.id)
    throw error
  }
}

export async function updateRelease(release: ReleaseRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      releases: state.releases.map((record) =>
        record.id === release.id ? release : record,
      ),
      tracks: state.tracks.map((track) =>
        track.release.id === release.id
          ? {
              ...track,
              release: {
                ...track.release,
                title: release.title,
                artist: release.artist,
                year: release.year,
                label: release.label,
              },
            }
          : track,
      ),
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
    labelId: await createLabelId(release.label),
    year: parseYear(release.year),
    genres: release.genres,
    tags: release.tags,
  })

  await syncMainArtistCredit('release', release.id, release.artistId)
}

export async function deleteRelease(releaseId: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      releases: state.releases.filter((release) => release.id !== releaseId),
      tracks: state.tracks.map((track) =>
        track.release.id === releaseId
          ? { ...track, release: { ...track.release, id: undefined } }
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
  const trackDto = await sendJson<TrackDto>('/api/tracks', 'POST', {
    title: track.title,
    durationSeconds: parseDuration(track.duration),
    genres: [],
    tags: track.tags,
  })

  try {
    if (track.artistId) {
      await createCredit(track.artistId, 'track', trackDto.id, 'mainArtist')
    }
  } catch (error) {
    await deleteTrackBestEffort(trackDto.id)
    throw error
  }

  return trackDto
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

  await sendJson(`/api/tracks/${track.id}`, 'PUT', {
    title: track.title,
    durationSeconds: parseDuration(track.duration),
    genres: [],
    tags: track.tags,
  })

  await syncMainArtistCredit('track', track.id, track.artistId)
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

async function createLabelId(name: string) {
  const trimmedName = name.trim()
  if (!trimmedName || trimmedName === 'Unknown label') {
    return null
  }

  const label = await sendJson<LabelDto>('/api/labels', 'POST', {
    name: trimmedName,
  })

  return label.id
}

async function createCredit(
  contributorArtistId: string,
  targetType: 'release' | 'track',
  targetId: string,
  role: string,
) {
  return sendJson<CreditDto>('/api/credits', 'POST', {
    contributorArtistId,
    targetType,
    targetId,
    role,
  })
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

async function deleteReleaseBestEffort(releaseId: string) {
  try {
    await sendDelete(`/api/releases/${releaseId}`, `release:${releaseId}`)
  } catch {
    // Preserve the original downstream failure for the UI.
  }
}

async function deleteTrackBestEffort(trackId: string) {
  try {
    await sendDelete(`/api/tracks/${trackId}`, `track:${trackId}`)
  } catch {
    // Preserve the original downstream failure for the UI.
  }
}

async function deleteOwnedItemBestEffort(ownedItemId: string) {
  try {
    await sendDelete(
      `/api/owned-items/${ownedItemId}`,
      `owned-item:${ownedItemId}`,
    )
  } catch {
    // Preserve the original downstream failure for the UI.
  }
}

async function deleteCreditBestEffort(creditId: string) {
  try {
    await sendDelete(`/api/credits/${creditId}`, `credit:${creditId}`)
  } catch {
    // Preserve the original downstream failure for the UI.
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

function toArtistRecord(
  artist: ArtistDto,
  credits: CreditDto[],
  relations: ArtistRelationDto[],
  artistsById: Map<string, ArtistDto>,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
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
        .map((relation) => relationTypeLabel(relation.type))
        .join(', ') || 'No relations recorded',
    creditHint:
      artistCredits.map((credit) => creditRoleLabel(credit.role)).join(', ') ||
      'No credits recorded',
    relations: artistRelations.map((relation) => {
      const isSource = relation.sourceArtistId === artist.id
      const target = artistsById.get(
        isSource ? relation.targetArtistId : relation.sourceArtistId,
      )

      return {
        type: relationTypeLabel(relation.type),
        target: target?.name ?? 'Unknown artist',
        detail: relationPeriodText(relation),
      }
    }),
    credits: artistCredits.map((credit) => ({
      role: creditRoleLabel(credit.role),
      target:
        credit.targetType === 'release'
          ? (releasesById.get(credit.targetId)?.title ?? 'Unknown release')
          : (tracksById.get(credit.targetId)?.title ?? 'Unknown track'),
      scope: credit.targetType === 'release' ? 'Release' : 'Track',
    })),
    tags: [],
    summary: 'Catalog artist loaded from the authenticated collection API.',
  }
}

function toReleaseRecord(
  release: ReleaseDto,
  labelsById: Map<string, LabelDto>,
  creditsByTarget: Map<string, CreditDto[]>,
  artistsById: Map<string, ArtistDto>,
  ownedItems: OwnedItemDto[],
): ReleaseRecord {
  const credits = targetCredits(creditsByTarget, 'release', release.id)
  const mainCredit =
    credits.find((credit) => credit.role === 'mainArtist') ?? credits[0]
  const artist = mainCredit
    ? artistsById.get(mainCredit.contributorArtistId)
    : undefined

  return {
    id: release.id,
    title: release.title,
    artistId: artist?.id,
    artist: artist?.name ?? 'Unknown artist',
    type: toReleaseType(release.type),
    year: release.year?.toString() ?? 'Unknown year',
    label: release.labelId
      ? (labelsById.get(release.labelId)?.name ?? 'Unknown label')
      : 'Unknown label',
    genres: release.genres,
    tags: release.tags,
    releaseNotes: 'Release loaded from the authenticated collection API.',
    ownedCopies: ownedItems
      .filter(
        (item) => item.targetType === 'release' && item.targetId === release.id,
      )
      .map((item) => ({
        id: item.id,
        medium: mediumLabel(item.medium),
        status: ownedCopyStatusLabel(item.status),
        storage: item.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.condition),
        note: 'Owned item linked to this release.',
      })),
  }
}

function toTrackRecord(
  track: TrackDto,
  creditsByTarget: Map<string, CreditDto[]>,
  artistsById: Map<string, ArtistDto>,
): TrackRecord {
  const credits = targetCredits(creditsByTarget, 'track', track.id)
  const mainCredit =
    credits.find((credit) => credit.role === 'mainArtist') ?? credits[0]
  const artist = mainCredit
    ? artistsById.get(mainCredit.contributorArtistId)
    : undefined

  return {
    id: track.id,
    title: track.title,
    artistId: artist?.id,
    artist: artist?.name ?? 'Unknown artist',
    release: {
      title: 'Unlinked release',
      artist: artist?.name ?? 'Unknown artist',
      year: 'Unknown year',
      label: 'Unknown label',
    },
    trackNumber: 'Unnumbered',
    duration: formatDuration(track.durationSeconds),
    versionHint: 'No version relation recorded',
    relationHint: 'Track loaded from the authenticated collection API.',
    tags: [...track.genres, ...track.tags],
    credits: credits.map(toTrackCredit),
    relations: [],
    fileMetadata: {
      format: 'None recorded',
      path: 'No file linked',
      bitrate: 'Not recorded',
      sampleRate: 'Not recorded',
      channels: 'Not recorded',
      importedAt: 'Not recorded',
      checksum: 'Not recorded',
    },
  }
}

function toOwnedItemRecord(
  item: OwnedItemDto,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
  releases: ReleaseRecord[],
  tracks: TrackRecord[],
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
    medium: mediumLabel(item.medium),
    status,
    statusTone: statusToneFor(status),
    storage: item.storageLocation ?? 'No storage recorded',
    condition: conditionLabel(item.condition),
    acquisition: 'Collection API',
    copyNotes: 'Owned item loaded from the authenticated collection API.',
    linkedType: item.targetType === 'track' ? 'Track' : 'Release',
    fileFormat: item.medium.format
      ? item.medium.format.toUpperCase()
      : 'None recorded',
    digitalState:
      item.medium.type === 'digital'
        ? 'Digital file recorded'
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
): RelationRecord {
  const source = artistsById.get(relation.sourceArtistId)
  const target = artistsById.get(relation.targetArtistId)
  const type = relationTypeLabel(relation.type)

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
): RelationRecord {
  const source = tracksById.get(relation.sourceTrackId)
  const target = tracksById.get(relation.targetTrackId)
  const type = relationTypeLabel(relation.type)

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
    context: 'Track relation loaded from the authenticated collection API.',
    evidence: 'Track relation loaded from the authenticated collection API.',
    linkedEntity: target?.title ?? 'Unknown track',
    linkedEntityLink: { kind: 'track', id: relation.targetTrackId },
    linkedEntityType: 'Track',
    direction: 'Track relation',
    searchHints: [source?.title ?? '', target?.title ?? '', type],
  }
}

function toTrackCredit(credit: CreditDto): TrackCredit {
  return {
    role: creditRoleLabel(credit.role),
    artist: credit.contributorName,
    scope: 'Track credit from the authenticated collection API.',
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

function toReleaseType(type: string): ReleaseType {
  switch (type) {
    case 'album':
      return 'Album'
    case 'ep':
      return 'EP'
    case 'compilation':
      return 'Compilation'
    case 'standalone':
      return 'Single'
    default:
      return 'Other'
  }
}

function toReleaseTypeCode(type: ReleaseType) {
  switch (type) {
    case 'Album':
      return 'album'
    case 'EP':
      return 'ep'
    case 'Compilation':
      return 'compilation'
    case 'Single':
      return 'standalone'
    default:
      return 'other'
  }
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

function mediumLabel(medium: MediumDto) {
  switch (medium.type) {
    case 'digital':
      return medium.format ? medium.format.toUpperCase() : 'Digital'
    case 'vinyl':
      return medium.description ?? 'Vinyl'
    case 'cd':
      return medium.discCount && medium.discCount > 1
        ? `${medium.discCount}xCD`
        : 'CD'
    case 'cassette':
      return medium.description ?? 'Cassette'
    default:
      return medium.description ?? 'Other'
  }
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

function creditRoleLabel(role: string) {
  const labels: Record<string, string> = {
    mainArtist: 'Main artist',
    featuredArtist: 'Featured artist',
    remixer: 'Remixer',
    producer: 'Producer',
    composer: 'Composer',
    performer: 'Performer',
    engineer: 'Engineer',
  }

  return labels[role] ?? role
}

function relationTypeLabel(type: string) {
  const labels: Record<string, string> = {
    alias: 'Alias',
    memberOf: 'Member of',
    soloProject: 'Solo project',
    collaboration: 'Collaboration',
    remixOf: 'Remix of',
    versionOf: 'Version of',
    editOf: 'Edit of',
  }

  return labels[type] ?? type
}

function toArtistRelationTypeCode(type: string) {
  const normalized = type.toLowerCase()
  if (normalized.includes('alias')) {
    return 'alias'
  }
  if (normalized.includes('solo')) {
    return 'soloProject'
  }
  if (normalized.includes('collaboration')) {
    return 'collaboration'
  }

  return 'memberOf'
}

function toTrackRelationTypeCode(type: string) {
  const normalized = type.toLowerCase()
  if (normalized.includes('remix')) {
    return 'remixOf'
  }
  if (normalized.includes('edit')) {
    return 'editOf'
  }

  return 'versionOf'
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

  return 'Relation loaded from the authenticated collection API.'
}

function formatDuration(durationSeconds: number | null | undefined) {
  if (!durationSeconds || durationSeconds < 1) {
    return 'Unknown duration'
  }

  const minutes = Math.floor(durationSeconds / 60)
  const seconds = String(durationSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function parseYear(value: string) {
  const year = Number.parseInt(value, 10)

  return Number.isInteger(year) ? year : null
}

function parseDuration(value: string) {
  const trimmed = value.trim()
  const match = /^(\d+):(\d{2})$/.exec(trimmed)
  if (match) {
    return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10)
  }

  const seconds = Number.parseInt(trimmed, 10)

  return Number.isInteger(seconds) && seconds > 0 ? seconds : null
}

function toMediumRequest(value: string): MediumDto {
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
