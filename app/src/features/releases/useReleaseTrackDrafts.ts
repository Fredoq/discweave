import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import {
  durationPartsToText,
  durationTextToParts,
  emptyDurationParts,
  normalizeDurationPart,
  type DurationParts,
} from '../catalog/durationFormat'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseArtistCredit, ReleaseRecord } from './releasesData'
import type {
  DraftTrackRow,
  EditableArtistCredit,
} from './ReleaseEntryFormTypes'
import {
  artistCreditName,
  draftTracksFromRelease,
  duplicateDraftExistingTrackIds,
  editableArtistCreditKey,
  existingTrackSuggestions,
  nextDraftTrackPosition,
  normalizedReleaseYear,
  releaseArtistCreditKey,
  renumberDraftTrackPositions,
} from './releaseFormHelpers'

type UseReleaseTrackDraftsArgs = {
  artists: ArtistRecord[]
  initialRelease?: ReleaseRecord
  isVariousArtists: boolean
  releaseYear: string
  releaseMainArtistCredits: ReleaseArtistCredit[]
  tracks: TrackRecord[]
}

export function useReleaseTrackDrafts({
  artists,
  initialRelease,
  isVariousArtists,
  releaseYear,
  releaseMainArtistCredits,
  tracks,
}: UseReleaseTrackDraftsArgs) {
  const initialDraftTracks = useMemo(
    () =>
      initialRelease
        ? draftTracksFromRelease(initialRelease, tracks)
        : ([] as DraftTrackRow[]),
    [initialRelease, tracks],
  )
  const [draftTracks, setDraftTracks] =
    useState<DraftTrackRow[]>(initialDraftTracks)
  const [selectedDraftTrackId, setSelectedDraftTrackId] = useState<
    string | null
  >(initialDraftTracks[0]?.id ?? null)
  const selectedDraftTrackTitleRef = useRef<HTMLInputElement>(null)
  const selectedDraftTrack =
    draftTracks.find((track) => track.id === selectedDraftTrackId) ??
    draftTracks[0]
  const selectedExistingTrack = selectedDraftTrack?.existingTrackId
    ? tracks.find((track) => track.id === selectedDraftTrack.existingTrackId)
    : undefined
  const unavailableExistingTrackIds = new Set(
    draftTracks
      .filter(
        (track) =>
          track.id !== selectedDraftTrack?.id && Boolean(track.existingTrackId),
      )
      .map((track) => track.existingTrackId ?? ''),
  )
  const selectedExistingTrackSuggestions = selectedDraftTrack
    ? existingTrackSuggestions(
        selectedDraftTrack,
        tracks,
        releaseMainArtistCredits,
      ).filter((track) => !unavailableExistingTrackIds.has(track.id))
    : []
  const selectedDraftTrackIndex = selectedDraftTrack
    ? draftTracks.findIndex((track) => track.id === selectedDraftTrack.id) + 1
    : 0
  const selectedCustomTrackCredits =
    selectedDraftTrack?.artistCredits.filter(
      (credit) =>
        !releaseMainArtistCredits.some(
          (releaseCredit) =>
            releaseArtistCreditKey(releaseCredit) ===
            editableArtistCreditKey(credit, artists),
        ),
    ) ?? []
  const duplicateExistingTrackIds = duplicateDraftExistingTrackIds(draftTracks)
  const selectedDraftTrackIdForFocus = selectedDraftTrack?.id

  useEffect(() => {
    if (selectedDraftTrackIdForFocus) {
      selectedDraftTrackTitleRef.current?.focus()
    }
  }, [selectedDraftTrackIdForFocus])

  function applyReleaseYearToInheritedTracks(nextReleaseYear: string) {
    const nextVersionYear = normalizedReleaseYear(nextReleaseYear)
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) => {
        if (
          !track.versionYearInheritedFromRelease &&
          track.versionYear.trim().length > 0
        ) {
          return track
        }

        return {
          ...track,
          versionYear: nextVersionYear,
          versionYearInheritedFromRelease: Boolean(nextVersionYear),
        }
      }),
    )
  }

  function handleDraftTrackChange(
    trackId: string,
    field: 'title' | 'existingTrackQuery' | 'disc' | 'side' | 'versionYear',
    value: string,
  ) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              [field]: value,
              ...(field === 'versionYear'
                ? { versionYearInheritedFromRelease: false }
                : {}),
            }
          : track,
      ),
    )
  }

  function selectExistingTrack(trackId: string, linkedTrack: TrackRecord) {
    const linkedVersionYear = linkedTrack.versionYear?.trim() ?? ''
    const inheritedVersionYear =
      linkedVersionYear || normalizedReleaseYear(releaseYear)

    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              existingTrackId: linkedTrack.id,
              releaseOnly: false,
              existingTrackQuery: linkedTrack.title,
              title: linkedTrack.title,
              durationParts: durationTextToParts(linkedTrack.duration),
              versionYear: inheritedVersionYear,
              versionYearInheritedFromRelease:
                linkedVersionYear.length === 0 &&
                inheritedVersionYear.length > 0,
              inheritReleaseArtistCredits: false,
              artistCredits: linkedTrack.credits.map((credit, index) => ({
                id: createManualRecordId(
                  'track-artist-credit',
                  `${linkedTrack.id}-${index + 1}`,
                ),
                artistId: credit.artistId ?? '',
                artist: credit.artistId ? '' : credit.artist,
                role: credit.role,
                roles:
                  credit.roles && credit.roles.length > 0
                    ? credit.roles
                    : [credit.role],
              })),
              draftArtist: '',
              draftArtistId: '',
            }
          : track,
      ),
    )
  }

  function clearExistingTrack(trackId: string) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              existingTrackId: undefined,
              existingTrackQuery: '',
            }
          : track,
      ),
    )
  }

  function handleDraftTrackDurationChange(
    trackId: string,
    field: keyof DurationParts,
    value: string,
    max: number,
  ) {
    const normalizedValue = normalizeDurationPart(value, max)
    if (normalizedValue === null) {
      return
    }

    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              durationParts: {
                ...track.durationParts,
                [field]: normalizedValue,
              },
            }
          : track,
      ),
    )
  }

  function handleTrackArtistChange(
    trackId: string,
    creditId: string,
    field: keyof Omit<EditableArtistCredit, 'id'>,
    value: string | string[],
  ) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              artistCredits: track.artistCredits.map((credit) =>
                credit.id === creditId
                  ? {
                      ...credit,
                      [field]: value,
                    }
                  : credit,
              ),
            }
          : track,
      ),
    )
  }

  function handleTrackDraftArtistChange(trackId: string, nextName: string) {
    const existingArtist = artists.find((artist) => artist.name === nextName)

    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              draftArtist: nextName,
              draftArtistId: existingArtist?.id ?? '',
            }
          : track,
      ),
    )
  }

  function addTrackArtist(trackId: string) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) => {
        if (track.id !== trackId) {
          return track
        }

        const artistName = track.draftArtist.trim()
        if (!artistName && !track.draftArtistId) {
          return track
        }

        return {
          ...track,
          draftArtist: '',
          draftArtistId: '',
          artistCredits: [
            ...track.artistCredits,
            {
              id: createManualRecordId(
                'track-artist-credit',
                `${track.artistCredits.length + 1}`,
              ),
              artistId: track.draftArtistId,
              artist: track.draftArtistId ? '' : artistName,
              role:
                isVariousArtists && track.artistCredits.length === 0
                  ? 'Main artist'
                  : '',
              roles:
                isVariousArtists && track.artistCredits.length === 0
                  ? ['Main artist']
                  : [],
            },
          ],
        }
      }),
    )
  }

  function removeTrackArtist(trackId: string, creditId: string) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              artistCredits: track.artistCredits.filter(
                (credit) => credit.id !== creditId,
              ),
            }
          : track,
      ),
    )
  }

  function setTrackArtistMode(
    trackId: string,
    inheritReleaseArtistCredits: boolean,
  ) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              inheritReleaseArtistCredits,
            }
          : track,
      ),
    )
  }

  function addDraftTrack() {
    const nextPosition = initialRelease
      ? nextDraftTrackPosition(draftTracks)
      : draftTracks.length + 1
    const nextTrack = createDraftTrack(
      nextPosition,
      isVariousArtists,
      releaseYear,
    )

    setDraftTracks((currentTracks) => [...currentTracks, nextTrack])
    setSelectedDraftTrackId(nextTrack.id)
  }

  function removeDraftTrack(trackId: string) {
    const removedIndex = draftTracks.findIndex((track) => track.id === trackId)
    const retainedTracks = draftTracks.filter((track) => track.id !== trackId)
    const nextTracks = initialRelease
      ? retainedTracks
      : renumberDraftTrackPositions(retainedTracks)

    setDraftTracks(nextTracks)
    if (selectedDraftTrackId === trackId) {
      setSelectedDraftTrackId(
        nextTracks[removedIndex]?.id ??
          nextTracks[removedIndex - 1]?.id ??
          nextTracks[0]?.id ??
          null,
      )
    }
  }

  function replaceDraftTracks(nextTracks: DraftTrackRow[]) {
    setDraftTracks(nextTracks)
    setSelectedDraftTrackId(nextTracks[0]?.id ?? null)
  }

  function draftTrackArtistSummary(track: DraftTrackRow) {
    if (track.existingTrackId) {
      const linkedTrack = tracks.find(
        (candidate) => candidate.id === track.existingTrackId,
      )

      return textOrFallback(
        (linkedTrack ? existingTrackArtistSummary(linkedTrack) : '') ||
          track.artistCredits
            .map((credit) => artistCreditName(credit, artists))
            .filter(Boolean)
            .join(', '),
        'Existing track',
      )
    }

    if (track.inheritReleaseArtistCredits && !isVariousArtists) {
      return textOrFallback(
        releaseMainArtistCredits.map((credit) => credit.artist).join(', '),
        'Release main artists',
      )
    }

    return textOrFallback(
      track.artistCredits
        .map((credit) => artistCreditName(credit, artists))
        .filter(Boolean)
        .join(', '),
      'Custom artists',
    )
  }

  function draftTrackMetaSummary(track: DraftTrackRow) {
    return [
      draftTrackPositionLabel(track),
      draftTrackArtistSummary(track),
      track.versionYear.trim(),
      durationPartsToText(track.durationParts),
    ]
      .filter(Boolean)
      .join(' · ')
  }

  return {
    addDraftTrack,
    addTrackArtist,
    applyReleaseYearToInheritedTracks,
    clearExistingTrack,
    draftTrackMetaSummary,
    draftTracks,
    duplicateExistingTrackIds,
    handleDraftTrackChange,
    handleDraftTrackDurationChange,
    handleTrackArtistChange,
    handleTrackDraftArtistChange,
    removeDraftTrack,
    removeTrackArtist,
    replaceDraftTracks,
    selectExistingTrack,
    selectedCustomTrackCredits,
    selectedDraftTrack,
    selectedDraftTrackIndex,
    selectedDraftTrackTitleRef,
    selectedExistingTrack,
    selectedExistingTrackSuggestions,
    setSelectedDraftTrackId,
    setTrackArtistMode,
  }
}

function createDraftTrack(
  position: number,
  isVariousArtists: boolean,
  releaseYear: string,
): DraftTrackRow {
  const versionYear = normalizedReleaseYear(releaseYear)

  return {
    id: createManualRecordId('draft-track', String(position)),
    existingTrackQuery: '',
    position: String(position),
    disc: '',
    side: '',
    title: '',
    durationParts: { ...emptyDurationParts },
    versionYear,
    versionYearInheritedFromRelease: Boolean(versionYear),
    inheritReleaseArtistCredits: !isVariousArtists,
    artistCredits: [],
    draftArtist: '',
    draftArtistId: '',
  }
}

function draftTrackPositionContext(track: DraftTrackRow) {
  return [
    track.disc.trim(),
    track.side.trim() ? `Side ${track.side.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function existingTrackArtistSummary(track: TrackRecord) {
  const creditSummary = track.credits
    .map((credit) => {
      const roles = (
        credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role]
      )
        .filter(Boolean)
        .join(', ')

      return roles ? `${credit.artist} (${roles})` : credit.artist
    })
    .filter(Boolean)
    .join(', ')

  return creditSummary || track.artist
}

function draftTrackPositionLabel(track: DraftTrackRow) {
  return [
    draftTrackPositionContext(track),
    track.position.trim() ? `Track ${track.position.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
