import type { ReleaseRecord } from '../../releases/releasesData'
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
    ...(release.externalSources === undefined
      ? {}
      : { externalSources: release.externalSources }),
    tracklist: tracks.map((track, index) =>
      toReleaseTracklistRequest(track, index, release.id),
    ),
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

export async function loadRelease(releaseId: string) {
  return getJson<ReleaseDto>(`/api/releases/${encodeURIComponent(releaseId)}`)
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
    ...(release.externalSources === undefined
      ? {}
      : { externalSources: release.externalSources }),
    ...(tracks === undefined
      ? {}
      : {
          tracklist: tracks.map((track, index) =>
            toReleaseTracklistRequest(track, index, release.id),
          ),
        }),
  })

  if (!release.artistCredits) {
    await syncMainArtistCredit('release', release.id, release.artistId)
  }
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
