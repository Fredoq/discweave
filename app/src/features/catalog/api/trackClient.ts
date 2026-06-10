import type { TrackRecord } from '../../tracks/tracksData'
import { activeGenreLabelSet } from './catalogDefaults'
import { sendDelete, sendJson } from './httpClient'
import { updateTestCatalogState } from './testCatalogStore'
import { unlinkRelationRecord } from './stateMutationHelpers'
import {
  parseDuration,
  toTrackAppearanceRequest,
  toTrackCreditRequest,
} from './catalogRequestMappers'
import type { TrackDto } from './catalogTypes'

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
    ...(track.externalSources === undefined
      ? {}
      : { externalSources: track.externalSources }),
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
    ...(track.externalSources === undefined
      ? {}
      : { externalSources: track.externalSources }),
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
