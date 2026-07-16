import { useEffect, useMemo, useState } from 'react'
import { uniqueValues } from '../catalog/catalogGraph'
import {
  defaultCatalogDictionaries,
  loadTrackStacks,
  loadTagRoleMappings,
  type CatalogDictionaries,
  type DiscogsIntegrationStatus,
  type RatingCriterion,
  type RatingTargetType,
  type TrackStackDto,
} from '../catalog/catalogApi'
import { RatingColumnSelector } from '../ratings/RatingsPanel'
import { readRatingColumnIds } from '../ratings/ratingUtils'
import { FilterSelect } from '../catalog/FilterSelect'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { ArtistRecord } from '../artists/artistsData'
import {
  isLocalEditsAvailable,
  localEditableFileFromTrackDigitalFile,
  type LocalEditableFile,
} from '../localFiles/localFileEditModel'
import {
  isLocalFileOpenAvailable,
  openableFilesFromStackTracks,
  openableFilesFromTrack,
  openLocalFile,
} from '../localFiles/localFileOpenModel'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import { hasRealLocalFile } from './trackDisplayHelpers'
import {
  TrackStacksPanel,
  type StackRelationMutation,
} from './TrackStacksPanel'
import { TrackSearchField } from './TrackSearchField'
import {
  buildStackRelationCommand,
  buildTrackStackRows,
  stackRelationTypeOptions,
} from './trackStackModel'
import { TrackStackPickerDialog } from './TrackStackPickerDialog'
import {
  TrackWorkspaceDetail,
  TrackWorkspaceFormsAndPanels,
  type LocalOpenPanelState,
} from './TracksWorkspacePanels'
import { useTrackStackAssignment } from './useTrackStackAssignment'
import { useTrackStackRelationTypeState } from './useTrackStackRelationTypeState'
import {
  filterVisibleTracks,
  trackReleaseLinkFilter,
  trackReleaseLinkFilterValues,
  type TrackFilters,
} from './trackWorkspaceFilters'
import type { TrackDigitalFile, TrackRecord } from './tracksData'

type TracksWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddTrack?: (track: TrackRecord) => void
  onCatalogChanged?: () => void
  onDeleteTrack?: (trackId: string) => void
  onUpdateTrack?: (track: TrackRecord) => void
  onManualEntryClose?: () => void
  playlists?: PlaylistRecord[]
  releases?: ReleaseRecord[]
  relations?: RelationRecord[]
  serverBackedCatalog?: boolean
  tracks?: TrackRecord[]
  dictionaries?: CatalogDictionaries
  discogsIntegrationStatus?: DiscogsIntegrationStatus
  ratingCriteria?: RatingCriterion[]
  onDeleteRating?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
  ) => void
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
  ) => void
}

export function TracksWorkspace({
  artists = [],
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddTrack,
  onCatalogChanged,
  onDeleteTrack,
  onUpdateTrack,
  onManualEntryClose = () => {},
  playlists = [],
  releases = [],
  relations = [],
  serverBackedCatalog = false,
  tracks: providedTracks,
  dictionaries = defaultCatalogDictionaries,
  discogsIntegrationStatus,
  ratingCriteria = [],
  onDeleteRating,
  onRateTarget,
}: TracksWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<TrackFilters>({
    format: '',
    creditRole: '',
    relationType: '',
    releaseLink: '',
  })
  const [manualTracks, setManualTracks] = useState<TrackRecord[]>([])
  const [editingTrackId, setEditingTrackId] = useState('')
  const [discogsLookupTrackId, setDiscogsLookupTrackId] = useState('')
  const [localEditFiles, setLocalEditFiles] = useState<LocalEditableFile[]>([])
  const [localOpenPanel, setLocalOpenPanel] =
    useState<LocalOpenPanelState | null>(null)
  const [stackRefreshNonce, setStackRefreshNonce] = useState(0)
  const [expandedStackIds, setExpandedStackIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [ratingColumnIds, setRatingColumnIds] = useState(() =>
    readRatingColumnIds('discweave.trackRatingColumns'),
  )
  const tracks = useMemo(() => {
    return [...(providedTracks ?? []), ...manualTracks]
  }, [manualTracks, providedTracks])
  const stackRefreshKey = useMemo(
    () =>
      tracks
        .map(
          (track) =>
            `${track.id}:${track.isOriginal ? '1' : '0'}:${track.versionYear ?? ''}`,
        )
        .join('|'),
    [tracks],
  )
  const stackProjection = useServerTrackStacks(
    serverBackedCatalog,
    stackRefreshKey,
    stackRefreshNonce,
  )
  const activeServerStacks = stackProjection.stacks
  const stackProjectionReady = stackProjection.status === 'ready'
  const stackRelationTypes = useTrackStackRelationTypeState(serverBackedCatalog)
  const creditRoleLabelsByCode = useMemo(
    () =>
      new Map(dictionaries.creditRole.map((entry) => [entry.code, entry.name])),
    [dictionaries],
  )
  const canUseDiscogs = discogsIntegrationStatus?.configured !== false

  const visibleTracks = useMemo(
    () => filterVisibleTracks(tracks, query, filters),
    [filters, query, tracks],
  )
  const { selectedRecord: selectedTrack, selectRecord: selectTrack } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'track',
      records: tracks,
      routePath: '/tracks',
      visibleRecords: visibleTracks,
    })
  const unfilteredStackRows = useMemo(
    () =>
      buildTrackStackRows({
        dictionaries,
        relations,
        serverStacks: activeServerStacks,
        stackRelationTypeCodes: stackRelationTypes.codes,
        tracks,
      }),
    [
      activeServerStacks,
      dictionaries,
      relations,
      stackRelationTypes.codes,
      tracks,
    ],
  )
  const enabledStackRelationTypeOptions = useMemo(
    () => stackRelationTypeOptions(stackRelationTypes.codes, dictionaries),
    [dictionaries, stackRelationTypes.codes],
  )
  const {
    actionStatus,
    canOpenPicker,
    entryButtonRef,
    pickerSource,
    closePicker,
    handleAssigned,
    handleDropCommand,
    handlePickerCommand,
    handleSourceInvalid,
    openPicker,
  } = useTrackStackAssignment({
    selectedTrack: selectedTrack ?? null,
    stackRows: unfilteredStackRows,
    relationTypeOptions: enabledStackRelationTypeOptions,
    relationTypesReady: stackRelationTypes.status === 'ready',
    stackProjectionReady,
    onCatalogChanged,
    onExpandDropTarget: (trackId) => {
      setExpandedStackIds((current) => new Set(current).add(trackId))
    },
    onRefreshStacks: () => {
      setStackRefreshNonce((current) => current + 1)
    },
  })

  function handleAddTrack(track: TrackRecord) {
    if (onAddTrack) {
      onAddTrack(track)
    } else {
      setManualTracks((currentTracks) => [...currentTracks, track])
    }

    setQuery('')
    selectTrack(track.id)
    onManualEntryClose()
    setDiscogsLookupTrackId('')
  }

  function handleUpdateTrack(track: TrackRecord) {
    if (onUpdateTrack) {
      onUpdateTrack(track)
    } else {
      setManualTracks((currentTracks) =>
        currentTracks.map((currentTrack) =>
          currentTrack.id === track.id ? track : currentTrack,
        ),
      )
    }

    setQuery('')
    selectTrack(track.id)
    setEditingTrackId('')
    setDiscogsLookupTrackId('')
  }

  async function handleCreateStackRelation({
    sourceTrack,
    targetRootTrack,
    relationTypeCode,
    targetWasStandalone,
  }: StackRelationMutation) {
    await handleDropCommand(
      buildStackRelationCommand(
        sourceTrack.id,
        targetRootTrack.id,
        relationTypeCode,
        targetWasStandalone && !targetRootTrack.isOriginal,
      ),
    )
    selectTrack(sourceTrack.id)
  }

  function handleDeleteTrack(trackId: string) {
    if (onDeleteTrack) {
      onDeleteTrack(trackId)
    } else {
      setManualTracks((currentTracks) =>
        currentTracks.filter((track) => track.id !== trackId),
      )
    }

    setQuery('')
    setEditingTrackId('')
    setDiscogsLookupTrackId('')
  }

  async function handleEditLocalFile(
    track: TrackRecord,
    file: TrackDigitalFile,
  ) {
    const mappings = await loadTagRoleMappings()
    const editableFile = localEditableFileFromTrackDigitalFile(
      track,
      file,
      mappings.items,
      creditRoleLabelsByCode,
    )
    if (editableFile) {
      setLocalEditFiles([editableFile])
    }
  }

  async function handleOpenTrackLocalFiles(track: TrackRecord) {
    selectTrack(track.id)
    const files = openableFilesFromTrack(track)
    if (files.length === 0) {
      return
    }

    if (files.length === 1) {
      const result = await openLocalFile(files[0])
      if (!result.ok) {
        setLocalOpenPanel({
          files,
          initialResults: { [files[0].id]: result },
          title: 'Track local files',
        })
      }
      return
    }

    setLocalOpenPanel({ files, title: 'Track local files' })
  }

  function handleOpenStackLocalFiles(
    stackTitle: string,
    stackTracks: TrackRecord[],
  ) {
    const files = openableFilesFromStackTracks(stackTracks)
    if (files.length > 0) {
      setLocalOpenPanel({
        files,
        title: stackTitle ? `${stackTitle} local files` : 'Stack local files',
      })
    }
  }

  const editingTrack = tracks.find((track) => track.id === editingTrackId)
  const canEditLocalFiles = isLocalEditsAvailable()
  const canOpenLocalFiles = isLocalFileOpenAvailable()
  const trackRatingCriteria = ratingCriteria.filter(
    (criterion) =>
      criterion.targetTypes.includes('track') && criterion.isActive,
  )
  const selectedRatingColumnIds =
    ratingColumnIds.length > 0
      ? ratingColumnIds
      : trackRatingCriteria
          .filter((criterion) => criterion.code === 'overall')
          .map((criterion) => criterion.id)

  return (
    <section
      className="catalog-layout tracks-layout"
      aria-label="Tracks workspace"
    >
      <div className="catalog-main">
        <TrackSearchField
          label="Search tracks"
          placeholder="Title, artist, release, duration, role, version or format"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="filter-bar">
          <FilterSelect
            label="File format"
            value={filters.format}
            values={uniqueValues(
              tracks
                .filter(hasRealLocalFile)
                .flatMap((track) =>
                  track.digitalFiles.map((file) => file.format),
                ),
            )}
            onChange={(format) =>
              setFilters((current) => ({ ...current, format }))
            }
          />
          <FilterSelect
            label="Credit role"
            value={filters.creditRole}
            values={uniqueValues(
              tracks.flatMap((track) =>
                track.credits.flatMap((credit) =>
                  credit.roles && credit.roles.length > 0
                    ? credit.roles
                    : [credit.role],
                ),
              ),
            )}
            onChange={(creditRole) =>
              setFilters((current) => ({ ...current, creditRole }))
            }
          />
          <FilterSelect
            label="Relation type"
            value={filters.relationType}
            values={uniqueValues(
              tracks.flatMap((track) =>
                track.relations.map((relation) => relation.type),
              ),
            )}
            onChange={(relationType) =>
              setFilters((current) => ({ ...current, relationType }))
            }
          />
          <FilterSelect
            label="Release link"
            value={filters.releaseLink}
            values={trackReleaseLinkFilterValues}
            onChange={(releaseLink) =>
              setFilters((current) => ({
                ...current,
                releaseLink: trackReleaseLinkFilter(releaseLink),
              }))
            }
          />
          <RatingColumnSelector
            criteria={trackRatingCriteria}
            selectedIds={selectedRatingColumnIds}
            storageKey="discweave.trackRatingColumns"
            onChange={setRatingColumnIds}
          />
          <span className="result-count">{visibleTracks.length} shown</span>
        </div>
        <TrackWorkspaceFormsAndPanels
          artists={artists}
          dictionaries={dictionaries}
          discogsLookupTrackId={discogsLookupTrackId}
          editingTrack={editingTrack}
          isManualEntryOpen={isManualEntryOpen}
          localEditFiles={localEditFiles}
          localOpenPanel={localOpenPanel}
          releases={releases}
          tracks={tracks}
          onAddTrack={handleAddTrack}
          onCatalogChanged={onCatalogChanged}
          onCloseLocalEditFiles={() => setLocalEditFiles([])}
          onCloseLocalOpenPanel={() => setLocalOpenPanel(null)}
          onManualEntryClose={onManualEntryClose}
          onOpenLocalFile={(file) => selectTrack(file.trackId)}
          onStopEditing={() => {
            setEditingTrackId('')
            setDiscogsLookupTrackId('')
          }}
          onUpdateTrack={handleUpdateTrack}
        />
        <TrackStacksPanel
          ratingCriteria={trackRatingCriteria.filter((criterion) =>
            selectedRatingColumnIds.includes(criterion.id),
          )}
          dictionaries={dictionaries}
          expandedStackIds={expandedStackIds}
          selectedTrackId={selectedTrack?.id ?? ''}
          serverStacks={activeServerStacks}
          stackRelationTypeCodes={stackRelationTypes.codes}
          visibleTracks={visibleTracks}
          relations={relations}
          tracks={tracks}
          onCreateStackRelation={(mutation) => {
            return handleCreateStackRelation(mutation)
          }}
          onOpenStackLocalFiles={
            canOpenLocalFiles ? handleOpenStackLocalFiles : undefined
          }
          onOpenTrackLocalFiles={
            canOpenLocalFiles
              ? (track) => {
                  void handleOpenTrackLocalFiles(track)
                }
              : undefined
          }
          onSelectTrack={selectTrack}
          onToggleStack={(stackId) =>
            setExpandedStackIds((current) => {
              const next = new Set(current)
              if (next.has(stackId)) {
                next.delete(stackId)
              } else {
                next.add(stackId)
              }
              return next
            })
          }
        />
      </div>

      <TrackWorkspaceDetail
        addToStackButtonRef={entryButtonRef}
        canEditLocalFiles={canEditLocalFiles}
        canOpenLocalFiles={canOpenLocalFiles}
        canUpdateViaDiscogs={canUseDiscogs}
        playlists={playlists}
        ratingCriteria={ratingCriteria}
        relations={relations}
        releases={releases}
        selectedTrack={selectedTrack}
        onAddToStack={canOpenPicker ? openPicker : undefined}
        onDeleteRating={onDeleteRating}
        onDeleteTrack={handleDeleteTrack}
        onEditLocalFile={handleEditLocalFile}
        onOpenTrackLocalFiles={handleOpenTrackLocalFiles}
        onRateTarget={onRateTarget}
        onStartDiscogsLookup={(trackId) => {
          setEditingTrackId(trackId)
          setDiscogsLookupTrackId(trackId)
        }}
        onStartEditing={(trackId) => {
          setEditingTrackId(trackId)
          setDiscogsLookupTrackId('')
        }}
      />
      {pickerSource ? (
        <TrackStackPickerDialog
          relationTypeOptions={enabledStackRelationTypeOptions}
          returnFocusRef={entryButtonRef}
          sourceTrack={pickerSource}
          onAssigned={handleAssigned}
          onClose={closePicker}
          onSourceInvalid={handleSourceInvalid}
          onSubmit={handlePickerCommand}
        />
      ) : null}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="visually-hidden"
        role="status"
      >
        {actionStatus}
      </div>
    </section>
  )
}

type TrackStackProjection = Readonly<{
  stacks: TrackStackDto[] | null
  status: 'loading' | 'ready' | 'error'
}>

type TrackStackProjectionResolution = Readonly<{
  requestKey: string
  stacks: TrackStackDto[] | null
  status: 'ready' | 'error'
}>

function useServerTrackStacks(
  serverBackedCatalog: boolean,
  stackRefreshKey: string,
  stackRefreshNonce: number,
): TrackStackProjection {
  const requestKey = `${stackRefreshNonce}:${stackRefreshKey}`
  const [resolution, setResolution] =
    useState<TrackStackProjectionResolution | null>(null)

  useEffect(() => {
    if (!serverBackedCatalog) {
      return
    }

    let isActive = true
    void loadTrackStacks()
      .then((response) => {
        if (isActive) {
          setResolution({
            requestKey,
            stacks: response.items,
            status: 'ready',
          })
        }
      })
      .catch(() => {
        if (isActive) {
          setResolution((current) => ({
            requestKey,
            stacks: current?.stacks ?? null,
            status: 'error',
          }))
        }
      })

    return () => {
      isActive = false
    }
  }, [requestKey, serverBackedCatalog])

  if (!serverBackedCatalog) {
    return { stacks: null, status: 'ready' }
  }

  if (resolution?.requestKey !== requestKey) {
    return {
      stacks: resolution?.stacks ?? null,
      status: 'loading',
    }
  }

  return {
    stacks: resolution.stacks,
    status: resolution.status,
  }
}
