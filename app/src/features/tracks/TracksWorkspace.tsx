import { useEffect, useMemo, useState } from 'react'
import { uniqueValues } from '../catalog/catalogGraph'
import { createStackRelation } from '../catalog/api/ownedRelationsClient'
import { loadTrackStackSettings } from '../catalog/api/settingsClient'
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
import { LocalFileEditPanel } from '../localFiles/LocalFileEditPanel'
import {
  isLocalEditsAvailable,
  localEditableFileFromTrackDigitalFile,
  type LocalEditableFile,
} from '../localFiles/localFileEditModel'
import { LocalFileOpenPanel } from '../localFiles/LocalFileOpenPanel'
import {
  isLocalFileOpenAvailable,
  openableFilesFromStackTracks,
  openableFilesFromTrack,
  openLocalFile,
  type LocalFileOpenResult,
  type LocalOpenableFile,
} from '../localFiles/localFileOpenModel'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import { EmptyDetailPanel, TrackDetail } from './TrackDetail'
import { TrackEntryForm } from './TrackEntryForm'
import { hasRealLocalFile } from './trackDisplayHelpers'
import {
  TrackStacksPanel,
  type StackRelationMutation,
} from './TrackStacksPanel'
import { TrackSearchField } from './TrackSearchField'
import { defaultTrackStackRelationTypeCodes } from './trackStackModel'
import { filterVisibleTracks, type TrackFilters } from './trackWorkspaceFilters'
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
  const [localOpenPanel, setLocalOpenPanel] = useState<{
    files: LocalOpenableFile[]
    initialResults?: Record<string, LocalFileOpenResult>
    title: string
  } | null>(null)
  const [serverStacks, setServerStacks] = useState<TrackStackDto[] | null>(null)
  const [stackRefreshNonce, setStackRefreshNonce] = useState(0)
  const [expandedStackIds, setExpandedStackIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [stackRelationTypeCodes, setStackRelationTypeCodes] = useState<
    string[]
  >(() => [...defaultTrackStackRelationTypeCodes])
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
  const creditRoleLabelsByCode = useMemo(
    () =>
      new Map(dictionaries.creditRole.map((entry) => [entry.code, entry.name])),
    [dictionaries],
  )
  const canUseDiscogs = discogsIntegrationStatus?.configured !== false

  useEffect(() => {
    let isActive = true

    if (!serverBackedCatalog) {
      return () => {
        isActive = false
      }
    }

    void loadTrackStacks()
      .then((response) => {
        if (isActive) {
          setServerStacks(response.items)
        }
      })
      .catch(() => {
        if (isActive) {
          setServerStacks(null)
        }
      })

    return () => {
      isActive = false
    }
  }, [serverBackedCatalog, stackRefreshKey, stackRefreshNonce])

  useEffect(() => {
    let isActive = true

    if (!serverBackedCatalog) {
      return () => {
        isActive = false
      }
    }

    void loadTrackStackSettings()
      .then((settings) => {
        if (isActive && settings) {
          const legacySettings = settings as { relationTypeCodes?: string[] }
          setStackRelationTypeCodes(
            settings.defaultRelationTypeCodes ??
              legacySettings.relationTypeCodes ?? [
                ...defaultTrackStackRelationTypeCodes,
              ],
          )
        }
      })
      .catch(() => {
        if (isActive) {
          setStackRelationTypeCodes([...defaultTrackStackRelationTypeCodes])
        }
      })

    return () => {
      isActive = false
    }
  }, [serverBackedCatalog])

  const activeServerStacks = serverBackedCatalog ? serverStacks : null
  const activeStackRelationTypeCodes = serverBackedCatalog
    ? stackRelationTypeCodes
    : defaultTrackStackRelationTypeCodes

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
    await createStackRelation({
      sourceTrackId: sourceTrack.id,
      targetTrackId: targetRootTrack.id,
      type: relationTypeCode,
      markTargetAsOriginal: targetWasStandalone && !targetRootTrack.isOriginal,
    })

    setExpandedStackIds((current) => new Set(current).add(targetRootTrack.id))
    setStackRefreshNonce((current) => current + 1)
    selectTrack(sourceTrack.id)
    onCatalogChanged?.()
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
            values={['Linked', 'Unlinked']}
            onChange={(releaseLink) =>
              setFilters((current) => ({ ...current, releaseLink }))
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
        {isManualEntryOpen ? (
          <TrackEntryForm
            artists={artists}
            dictionaries={dictionaries}
            onCancel={onManualEntryClose}
            releases={releases}
            tracks={tracks}
            onSubmit={handleAddTrack}
          />
        ) : null}
        {editingTrack ? (
          <TrackEntryForm
            artists={artists}
            dictionaries={dictionaries}
            initialTrack={editingTrack}
            initialShowDiscogsLookup={editingTrack.id === discogsLookupTrackId}
            key={editingTrack.id}
            onCancel={() => {
              setEditingTrackId('')
              setDiscogsLookupTrackId('')
            }}
            releases={releases}
            tracks={tracks}
            onSubmit={handleUpdateTrack}
          />
        ) : null}
        {localEditFiles.length > 0 ? (
          <LocalFileEditPanel
            files={localEditFiles}
            key={localEditPanelKey(localEditFiles)}
            onApplied={onCatalogChanged}
            onClose={() => setLocalEditFiles([])}
          />
        ) : null}
        {localOpenPanel ? (
          <LocalFileOpenPanel
            files={localOpenPanel.files}
            initialResults={localOpenPanel.initialResults}
            title={localOpenPanel.title}
            onClose={() => setLocalOpenPanel(null)}
          />
        ) : null}
        <TrackStacksPanel
          ratingCriteria={trackRatingCriteria.filter((criterion) =>
            selectedRatingColumnIds.includes(criterion.id),
          )}
          dictionaries={dictionaries}
          expandedStackIds={expandedStackIds}
          selectedTrackId={selectedTrack?.id ?? ''}
          serverStacks={activeServerStacks}
          stackRelationTypeCodes={activeStackRelationTypeCodes}
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

      {selectedTrack ? (
        <TrackDetail
          onEdit={() => {
            setEditingTrackId(selectedTrack.id)
            setDiscogsLookupTrackId('')
          }}
          onUpdateViaDiscogs={() => {
            setEditingTrackId(selectedTrack.id)
            setDiscogsLookupTrackId(selectedTrack.id)
          }}
          canUpdateViaDiscogs={canUseDiscogs}
          onDelete={() => handleDeleteTrack(selectedTrack.id)}
          playlists={playlists}
          relations={relations}
          releases={releases}
          ratingCriteria={ratingCriteria}
          onDeleteRating={onDeleteRating}
          onEditLocalFile={
            canEditLocalFiles
              ? (track, file) => {
                  void handleEditLocalFile(track, file)
                }
              : undefined
          }
          localFileCount={
            canOpenLocalFiles ? openableFilesFromTrack(selectedTrack).length : 0
          }
          onOpenLocalFiles={
            canOpenLocalFiles
              ? () => {
                  void handleOpenTrackLocalFiles(selectedTrack)
                }
              : undefined
          }
          onRateTarget={onRateTarget}
          track={selectedTrack}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

function localEditPanelKey(files: LocalEditableFile[]) {
  return files.map((file) => `${file.rowId}:${file.currentPath}`).join('|')
}
