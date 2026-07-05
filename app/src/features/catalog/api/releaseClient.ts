import type {
  ReleaseRecord,
  ReleaseTracklistSubmissionRow,
} from '../../releases/releasesData'
import type { TrackRecord } from '../../tracks/tracksData'
import {
  CatalogApiError,
  assertNoCollectionIds,
  getAllPages,
  getJson,
  readJsonBody,
  sendDelete,
  sendJson,
} from './httpClient'
import { updateTestCatalogState } from './testCatalogStore'
import { unlinkRelationRecord } from './stateMutationHelpers'
import {
  applyReleaseCoverToState,
  mergeReleaseTracklist,
  replaceReleaseTracklist,
  updateReleaseMetadataOnTrack,
} from './releaseTrackState'
import {
  missingOwnedItemConditionLabel,
  missingOwnedItemStorageLabel,
  releaseArtistCreditsFromDisplay,
  releaseLabelsFromDisplay,
  toReleaseCoverImageFromFile,
} from './catalogValueMappers'
import {
  parseYear,
  toConditionCode,
  toMediumRequest,
  toOwnershipStatusCode,
  toReleaseArtistCreditRequest,
  toReleaseLabelRequest,
  toReleaseTracklistSubmissionRequest,
  toReleaseTracklistRequest,
  toReleaseTypeCode,
} from './catalogRequestMappers'
import type {
  CreditDto,
  ReleaseCoverImageDto,
  ReleaseDto,
} from './catalogTypes'

export async function createRelease(
  release: ReleaseRecord,
  tracks: TrackRecord[],
  tracklist?: ReleaseTracklistSubmissionRow[],
) {
  const ownedCopies = release.ownedCopies.map((copy) =>
    toReleaseOwnedCopyRequest(copy, false),
  )

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
    ...(release.externalSources === undefined
      ? {}
      : { externalSources: release.externalSources }),
    tracklist: tracklist
      ? tracklist.map((tracklistRow, index) =>
          toReleaseTracklistSubmissionRequest(tracklistRow, index),
        )
      : tracks.map((track, index) =>
          toReleaseTracklistRequest(track, index, release.id),
        ),
    ownedCopy: ownedCopies[0] ?? null,
    ownedCopies,
  })
}

function toReleaseOwnedCopyRequest(
  copy: ReleaseRecord['ownedCopies'][number],
  includeId: boolean,
) {
  const medium = toMediumRequest(copy.medium)
  const isDigital = medium.type === 'digital'

  return {
    ...(includeId && isUuid(copy.id) ? { id: copy.id } : {}),
    status: toOwnershipStatusCode(copy.status),
    medium,
    condition: isDigital ? null : toConditionCode(copy.condition),
    storageLocation: isDigital ? null : textOrNull(copy.storage),
    note: copy.note.trim(),
  }
}

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  if (
    trimmed === missingOwnedItemStorageLabel ||
    trimmed === missingOwnedItemConditionLabel
  ) {
    return null
  }

  return trimmed.length > 0 ? trimmed : null
}

export async function loadRelease(releaseId: string) {
  return getJson<ReleaseDto>(`/api/releases/${encodeURIComponent(releaseId)}`)
}

export async function updateRelease(
  release: ReleaseRecord,
  tracks?: TrackRecord[],
  tracklist?: ReleaseTracklistSubmissionRow[],
) {
  const ownedCopies = release.ownedCopies.map((copy) =>
    toReleaseOwnedCopyRequest(copy, true),
  )

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
    ...(release.externalSources === undefined
      ? {}
      : { externalSources: release.externalSources }),
    ownedCopies,
    ...(tracks === undefined && tracklist === undefined
      ? {}
      : {
          tracklist: tracklist
            ? tracklist.map((tracklistRow, index) =>
                toReleaseTracklistSubmissionRequest(tracklistRow, index),
              )
            : (tracks ?? []).map((track, index) =>
                toReleaseTracklistRequest(track, index, release.id),
              ),
        }),
  })

  if (!release.artistCredits) {
    await syncMainArtistCredit('release', release.id, release.artistId)
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
    value,
  )
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

  const responseBody = await readJsonBody<ReleaseCoverImageDto>(response)
  if (responseBody !== null) {
    assertNoCollectionIds(responseBody)
  }
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
