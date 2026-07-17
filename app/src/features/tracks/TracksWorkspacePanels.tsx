import type { Ref } from 'react'
import type {
  CatalogDictionaries,
  RatingCriterion,
  RatingTargetType,
} from '../catalog/catalogApi'
import type { ArtistRecord } from '../artists/artistsData'
import type { LocalEditableFile } from '../localFiles/localFileEditModel'
import { LocalFileEditPanel } from '../localFiles/LocalFileEditPanel'
import { LocalFileOpenPanel } from '../localFiles/LocalFileOpenPanel'
import type {
  LocalFileOpenResult,
  LocalOpenableFile,
} from '../localFiles/localFileOpenModel'
import { openableFilesFromTrack } from '../localFiles/localFileOpenModel'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import { EmptyDetailPanel, TrackDetail } from './TrackDetail'
import { TrackEntryForm } from './TrackEntryForm'
import type { TrackDigitalFile, TrackRecord } from './tracksData'

export type LocalOpenPanelState = {
  files: LocalOpenableFile[]
  initialResults?: Record<string, LocalFileOpenResult>
  title: string
}

type TrackWorkspaceFormsAndPanelsProps = Readonly<{
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  discogsLookupTrackId: string
  editingTrack: TrackRecord | undefined
  isManualEntryOpen: boolean
  localEditFiles: LocalEditableFile[]
  localOpenPanel: LocalOpenPanelState | null
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onAddTrack: (track: TrackRecord) => void
  onCatalogChanged?: () => void
  onCloseLocalEditFiles: () => void
  onCloseLocalOpenPanel: () => void
  onManualEntryClose: () => void
  onOpenLocalFile: (file: LocalOpenableFile) => void
  onStopEditing: () => void
  onUpdateTrack: (track: TrackRecord) => void
}>

type TrackWorkspaceDetailProps = Readonly<{
  addToStackButtonRef?: Ref<HTMLButtonElement>
  canEditLocalFiles: boolean
  canOpenLocalFiles: boolean
  canUpdateViaDiscogs: boolean
  playlists: PlaylistRecord[]
  ratingCriteria: RatingCriterion[]
  relations: RelationRecord[]
  releases: ReleaseRecord[]
  selectedTrack: TrackRecord | undefined
  onAddToStack?: () => void
  onDeleteRating?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
  ) => void
  onDeleteTrack: (trackId: string) => void
  onEditLocalFile: (track: TrackRecord, file: TrackDigitalFile) => Promise<void>
  onOpenTrackLocalFiles: (track: TrackRecord) => Promise<void>
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
  ) => void
  onStartDiscogsLookup: (trackId: string) => void
  onStartEditing: (trackId: string) => void
}>

export function TrackWorkspaceFormsAndPanels({
  artists,
  dictionaries,
  discogsLookupTrackId,
  editingTrack,
  isManualEntryOpen,
  localEditFiles,
  localOpenPanel,
  releases,
  tracks,
  onAddTrack,
  onCatalogChanged,
  onCloseLocalEditFiles,
  onCloseLocalOpenPanel,
  onManualEntryClose,
  onOpenLocalFile,
  onStopEditing,
  onUpdateTrack,
}: TrackWorkspaceFormsAndPanelsProps) {
  return (
    <>
      {isManualEntryOpen ? (
        <TrackEntryForm
          artists={artists}
          dictionaries={dictionaries}
          onCancel={onManualEntryClose}
          releases={releases}
          tracks={tracks}
          onSubmit={onAddTrack}
        />
      ) : null}
      {editingTrack ? (
        <TrackEntryForm
          artists={artists}
          dictionaries={dictionaries}
          initialTrack={editingTrack}
          initialShowDiscogsLookup={editingTrack.id === discogsLookupTrackId}
          key={editingTrack.id}
          onCancel={onStopEditing}
          releases={releases}
          tracks={tracks}
          onSubmit={onUpdateTrack}
        />
      ) : null}
      {localEditFiles.length > 0 ? (
        <LocalFileEditPanel
          files={localEditFiles}
          key={localEditPanelKey(localEditFiles)}
          onApplied={onCatalogChanged}
          onClose={onCloseLocalEditFiles}
        />
      ) : null}
      {localOpenPanel ? (
        <LocalFileOpenPanel
          files={localOpenPanel.files}
          initialResults={localOpenPanel.initialResults}
          title={localOpenPanel.title}
          onClose={onCloseLocalOpenPanel}
          onOpenFile={onOpenLocalFile}
        />
      ) : null}
    </>
  )
}

export function TrackWorkspaceDetail({
  addToStackButtonRef,
  canEditLocalFiles,
  canOpenLocalFiles,
  canUpdateViaDiscogs,
  playlists,
  ratingCriteria,
  relations,
  releases,
  selectedTrack,
  onAddToStack,
  onDeleteRating,
  onDeleteTrack,
  onEditLocalFile,
  onOpenTrackLocalFiles,
  onRateTarget,
  onStartDiscogsLookup,
  onStartEditing,
}: TrackWorkspaceDetailProps) {
  if (!selectedTrack) {
    return <EmptyDetailPanel />
  }

  return (
    <TrackDetail
      addToStackButtonRef={addToStackButtonRef}
      canUpdateViaDiscogs={canUpdateViaDiscogs}
      localFileCount={
        canOpenLocalFiles ? openableFilesFromTrack(selectedTrack).length : 0
      }
      playlists={playlists}
      ratingCriteria={ratingCriteria}
      relations={relations}
      releases={releases}
      track={selectedTrack}
      onAddToStack={onAddToStack}
      onDelete={() => onDeleteTrack(selectedTrack.id)}
      onDeleteRating={onDeleteRating}
      onEdit={() => onStartEditing(selectedTrack.id)}
      onEditLocalFile={
        canEditLocalFiles
          ? (track, file) => {
              void onEditLocalFile(track, file)
            }
          : undefined
      }
      onOpenLocalFiles={
        canOpenLocalFiles
          ? () => {
              void onOpenTrackLocalFiles(selectedTrack)
            }
          : undefined
      }
      onRateTarget={onRateTarget}
      onUpdateViaDiscogs={() => onStartDiscogsLookup(selectedTrack.id)}
    />
  )
}

function localEditPanelKey(files: LocalEditableFile[]) {
  return files.map((file) => `${file.rowId}:${file.currentPath}`).join('|')
}
