import { useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type {
  DictionaryEntry,
  ReleaseImportArtistCredit,
  ReleaseImportDraftTrack,
  ReleaseImportTrackMode,
} from '../catalog/catalogApi'
import {
  effectiveTrackArtistCredits,
  withTrackArtistCredits,
} from './importHelpers'
import {
  TrackDraftDetailPanel,
  TrackDraftMasterList,
} from './TrackDraftListPanels'

type TrackDraftListProps = Readonly<{
  artists: ArtistRecord[]
  createCatalogTracks: boolean
  creditRoleOptions: DictionaryEntry[]
  isVariousArtists: boolean
  releaseMainArtistCredits: ReleaseImportArtistCredit[]
  releaseYear?: number | null
  tracks: ReleaseImportDraftTrack[]
  onChange: (tracks: ReleaseImportDraftTrack[]) => void
}>

type TrackYearDraft = {
  trackId: string
  value: string
}

export function TrackDraftList({
  artists,
  createCatalogTracks,
  creditRoleOptions,
  isVariousArtists,
  releaseMainArtistCredits,
  releaseYear,
  tracks,
  onChange,
}: TrackDraftListProps) {
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const [draftArtist, setDraftArtist] = useState('')
  const [draftArtistId, setDraftArtistId] = useState('')
  const [trackYearDraft, setTrackYearDraft] = useState<TrackYearDraft | null>(
    null,
  )
  const selectedTrack =
    tracks.find((track) => track.id === selectedTrackId) ??
    tracks.find((track) => !track.isSkipped) ??
    tracks[0] ??
    null
  const selectedTrackIndex = selectedTrack
    ? tracks.findIndex((track) => track.id === selectedTrack.id)
    : -1
  const secondaryCreditRoleOptions = creditRoleOptions.filter(
    (role) => role.code !== 'mainArtist',
  )
  const canInheritReleaseMainArtists = isVariousArtists === false

  function updateTrack(
    trackId: string,
    patch: Partial<ReleaseImportDraftTrack>,
  ) {
    onChange(
      tracks.map((track) =>
        track.id === trackId ? { ...track, ...patch } : track,
      ),
    )
  }

  function updateTrackArtistCredits(
    trackId: string,
    credits: ReleaseImportArtistCredit[],
  ) {
    onChange(
      tracks.map((track) =>
        track.id === trackId ? withTrackArtistCredits(track, credits) : track,
      ),
    )
  }

  function updateTrackMode(trackId: string, trackMode: ReleaseImportTrackMode) {
    const track = tracks.find((item) => item.id === trackId)
    if (!track) {
      return
    }

    updateTrack(trackId, {
      trackMode,
      selectedTrackId:
        trackMode === 'link' ? (track.selectedTrackId ?? null) : null,
    })
  }

  function defaultTrackMode(): ReleaseImportTrackMode {
    return createCatalogTracks ? 'create' : 'releaseOnly'
  }

  function addTrackArtist(
    trackId: string,
    name = draftArtist,
    artistId = draftArtistId,
  ) {
    const artistName = name.trim()
    if (!artistName && !artistId) {
      return
    }

    const track = tracks.find((item) => item.id === trackId)
    if (!track) {
      return
    }

    const existingArtist = artists.find((artist) => artist.id === artistId)
    updateTrackArtistCredits(trackId, [
      ...effectiveTrackArtistCredits(track),
      {
        artistId: artistId || null,
        name: existingArtist?.name ?? artistName,
        role:
          isVariousArtists && effectiveTrackArtistCredits(track).length === 0
            ? 'mainArtist'
            : '',
      },
    ])
    setDraftArtist('')
    setDraftArtistId('')
  }

  if (!selectedTrack) {
    return (
      <div className="imports-tracklist-editor">
        <div className="release-tracklist-toolbar imports-tracklist-toolbar">
          <div>
            <strong>Tracklist</strong>
            <span>No tracks found.</span>
          </div>
        </div>
      </div>
    )
  }

  const selectedTrackCredits = effectiveTrackArtistCredits(selectedTrack)
  const selectedTrackMode = selectedTrack.trackMode ?? defaultTrackMode()
  const selectedTrackVersionYear = selectedTrack.versionYear ?? releaseYear
  const selectedTrackYearInputValue =
    trackYearDraft?.trackId === selectedTrack.id
      ? trackYearDraft.value
      : (selectedTrackVersionYear?.toString() ?? '')

  return (
    <div className="imports-tracklist-editor">
      <div className="release-tracklist-toolbar imports-tracklist-toolbar">
        <div>
          <strong>Tracklist</strong>
          <span>
            {tracks.length} tracks · selected track {selectedTrackIndex + 1}
          </span>
        </div>
      </div>
      <div className="release-tracklist-layout imports-tracklist-layout">
        <TrackDraftMasterList
          artists={artists}
          selectedTrackId={selectedTrack.id}
          tracks={tracks}
          onSelectTrack={setSelectedTrackId}
        />
        <TrackDraftDetailPanel
          artists={artists}
          canInheritReleaseMainArtists={canInheritReleaseMainArtists}
          creditRoleOptions={creditRoleOptions}
          defaultTrackMode={defaultTrackMode}
          draftArtist={draftArtist}
          isVariousArtists={isVariousArtists}
          releaseMainArtistCredits={releaseMainArtistCredits}
          secondaryCreditRoleOptions={secondaryCreditRoleOptions}
          selectedTrack={selectedTrack}
          selectedTrackCredits={selectedTrackCredits}
          selectedTrackIndex={selectedTrackIndex}
          selectedTrackMode={selectedTrackMode}
          selectedTrackVersionYear={selectedTrackVersionYear}
          selectedTrackYearInputValue={selectedTrackYearInputValue}
          onAddTrackArtist={addTrackArtist}
          onDraftArtistChange={setDraftArtist}
          onDraftArtistIdChange={setDraftArtistId}
          onTrackArtistCreditsChange={updateTrackArtistCredits}
          onTrackModeChange={updateTrackMode}
          onTrackPatch={updateTrack}
          onTrackYearDraftChange={setTrackYearDraft}
        />
      </div>
    </div>
  )
}
