import type { ArtistRecord } from '../../artists/artistsData'
import type { LabelRecord } from '../../labels/labelsData'
import { sendDelete, sendJson } from './httpClient'
import { updateTestCatalogState } from './testCatalogStore'
import {
  findArtistName,
  releaseHasLabelId,
  updateReleaseLabelName,
} from './stateMutationHelpers'
import { toArtistTypeCode } from './catalogRequestMappers'

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
    ...(artist.externalSources === undefined
      ? {}
      : { externalSources: artist.externalSources }),
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
    ...(artist.externalSources === undefined
      ? {}
      : { externalSources: artist.externalSources }),
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

export async function createLabel(label: LabelRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      labels: [...(state.labels ?? []), label],
    }))
  ) {
    return
  }

  await sendJson('/api/labels', 'POST', {
    name: label.name,
  })
}

export async function updateLabel(label: LabelRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      labels: (state.labels ?? []).map((record) =>
        record.id === label.id ? label : record,
      ),
      releases: state.releases.map((release) =>
        updateReleaseLabelName(release, label),
      ),
      tracks: state.tracks.map((track) => ({
        ...track,
        release:
          track.release.id && releaseHasLabelId(track.release.id, state, label)
            ? { ...track.release, label: label.name }
            : track.release,
        releaseAppearances: track.releaseAppearances.map((appearance) =>
          appearance.releaseId &&
          releaseHasLabelId(appearance.releaseId, state, label)
            ? { ...appearance, label: label.name }
            : appearance,
        ),
      })),
    }))
  ) {
    return
  }

  await sendJson(`/api/labels/${label.id}`, 'PUT', {
    name: label.name,
  })
}

export async function deleteLabel(labelId: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      labels: (state.labels ?? []).filter((label) => label.id !== labelId),
    }))
  ) {
    return
  }

  await sendDelete(`/api/labels/${labelId}`, `label:${labelId}`)
}
