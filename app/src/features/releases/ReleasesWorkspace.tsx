import { useMemo, useState } from 'react'
import { uniqueValues } from '../catalog/catalogGraph'
import {
  defaultCatalogDictionaries,
  loadTagRoleMappings,
  type CatalogDictionaries,
  type DiscogsIntegrationStatus,
  type RatingCriterion,
  type RatingTargetType,
} from '../catalog/catalogApi'
import { RatingColumnSelector } from '../ratings/RatingsPanel'
import { readRatingColumnIds } from '../ratings/ratingUtils'
import { FilterSelect } from '../catalog/FilterSelect'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { ArtistRecord } from '../artists/artistsData'
import { LocalFileEditPanel } from '../localFiles/LocalFileEditPanel'
import {
  isLocalEditsAvailable,
  localEditableFileFromTrack,
  type LocalEditableFile,
} from '../localFiles/localFileEditModel'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseRecord } from './releasesData'
import { ReleaseEntryForm } from './ReleaseEntryForm'
import { EmptyDetailPanel, ReleaseDetail } from './ReleaseDetail'
import { ReleaseTable, SearchField } from './ReleaseTable'
import {
  objectUrlForFile,
  queryTerms,
  releaseHasLabel,
  releaseLabelNames,
  releaseSearchText,
} from './releaseFormHelpers'

export type { ReleaseEntryFormProps } from './ReleaseEntryFormTypes'
export { ReleaseEntryForm } from './ReleaseEntryForm'

type ReleasesWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddRelease?: (release: ReleaseRecord, tracks: TrackRecord[]) => void
  onCatalogChanged?: () => void
  onDeleteRelease?: (releaseId: string) => void
  onRemoveReleaseCover?: (releaseId: string) => Promise<void> | void
  onUpdateRelease?: (release: ReleaseRecord, tracks?: TrackRecord[]) => void
  onUploadReleaseCover?: (releaseId: string, file: File) => Promise<void> | void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  playlists?: PlaylistRecord[]
  releases?: ReleaseRecord[]
  relations?: RelationRecord[]
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

export function ReleasesWorkspace({
  artists = [],
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddRelease,
  onCatalogChanged,
  onDeleteRelease,
  onRemoveReleaseCover,
  onUpdateRelease,
  onUploadReleaseCover,
  onManualEntryClose = () => {},
  ownedItems = [],
  playlists = [],
  releases: providedReleases,
  relations = [],
  tracks = [],
  dictionaries = defaultCatalogDictionaries,
  discogsIntegrationStatus,
  ratingCriteria = [],
  onDeleteRating,
  onRateTarget,
}: ReleasesWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    medium: '',
    label: '',
    year: '',
    tag: '',
  })
  const [manualReleases, setManualReleases] = useState<ReleaseRecord[]>([])
  const [editingReleaseId, setEditingReleaseId] = useState('')
  const [discogsLookupReleaseId, setDiscogsLookupReleaseId] = useState('')
  const [localEditFiles, setLocalEditFiles] = useState<LocalEditableFile[]>([])
  const [ratingColumnIds, setRatingColumnIds] = useState(() =>
    readRatingColumnIds('discweave.releaseRatingColumns'),
  )
  const releases = useMemo(() => {
    return [...(providedReleases ?? []), ...manualReleases]
  }, [manualReleases, providedReleases])
  const creditRoleLabelsByCode = useMemo(
    () =>
      new Map(dictionaries.creditRole.map((entry) => [entry.code, entry.name])),
    [dictionaries],
  )
  const canUseDiscogs = discogsIntegrationStatus?.configured !== false

  const visibleReleases = useMemo(() => {
    const terms = queryTerms(query)

    return releases.filter(
      (release) =>
        terms.every((term) => releaseSearchText(release).includes(term)) &&
        (!filters.medium ||
          release.ownedCopies.some((copy) => copy.medium === filters.medium)) &&
        (!filters.label || releaseHasLabel(release, filters.label)) &&
        (!filters.year || release.year === filters.year) &&
        (!filters.tag ||
          [...release.genres, ...release.tags].includes(filters.tag)),
    )
  }, [filters, query, releases])
  const { selectedRecord: selectedRelease, selectRecord: selectRelease } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'release',
      records: releases,
      routePath: '/releases',
      visibleRecords: visibleReleases,
    })

  function handleAddRelease(
    release: ReleaseRecord,
    createdTracks: TrackRecord[],
  ) {
    if (onAddRelease) {
      onAddRelease(release, createdTracks)
    } else {
      setManualReleases((currentReleases) => [...currentReleases, release])
    }

    setQuery('')
    selectRelease(release.id)
    onManualEntryClose()
  }

  function handleUpdateRelease(release: ReleaseRecord, tracks: TrackRecord[]) {
    if (onUpdateRelease) {
      onUpdateRelease(release, tracks)
    } else {
      setManualReleases((currentReleases) =>
        currentReleases.map((currentRelease) =>
          currentRelease.id === release.id ? release : currentRelease,
        ),
      )
    }

    setQuery('')
    selectRelease(release.id)
    setEditingReleaseId('')
    setDiscogsLookupReleaseId('')
  }

  function handleDeleteRelease(releaseId: string) {
    if (onDeleteRelease) {
      onDeleteRelease(releaseId)
    } else {
      setManualReleases((currentReleases) =>
        currentReleases.filter((release) => release.id !== releaseId),
      )
    }

    setQuery('')
    setEditingReleaseId('')
    setDiscogsLookupReleaseId('')
  }

  async function handleUploadReleaseCover(releaseId: string, file: File) {
    if (onUploadReleaseCover) {
      await onUploadReleaseCover(releaseId, file)
      return
    }

    setManualReleases((currentReleases) =>
      currentReleases.map((release) =>
        release.id === releaseId
          ? {
              ...release,
              coverImage: {
                url: objectUrlForFile(file),
                contentType: file.type,
                originalFileName: file.name,
                sizeBytes: file.size,
                sourceType: 'localUpload',
              },
            }
          : release,
      ),
    )
  }

  async function handleRemoveReleaseCover(releaseId: string) {
    if (onRemoveReleaseCover) {
      await onRemoveReleaseCover(releaseId)
      return
    }

    setManualReleases((currentReleases) =>
      currentReleases.map((release) =>
        release.id === releaseId
          ? { ...release, coverImage: undefined }
          : release,
      ),
    )
  }

  async function handleEditLocalFiles(localTracks: TrackRecord[]) {
    const mappings = await loadTagRoleMappings()
    const editableFiles = localTracks
      .map((track) =>
        localEditableFileFromTrack(
          track,
          mappings.items,
          creditRoleLabelsByCode,
        ),
      )
      .filter((file): file is LocalEditableFile => Boolean(file))

    if (editableFiles.length > 0) {
      setLocalEditFiles(editableFiles)
    }
  }

  const editingRelease = releases.find(
    (release) => release.id === editingReleaseId,
  )
  const canEditLocalFiles = isLocalEditsAvailable()
  const releaseRatingCriteria = ratingCriteria.filter(
    (criterion) =>
      criterion.targetTypes.includes('release') && criterion.isActive,
  )
  const selectedRatingColumnIds =
    ratingColumnIds.length > 0
      ? ratingColumnIds
      : releaseRatingCriteria
          .filter((criterion) => criterion.code === 'overall')
          .map((criterion) => criterion.id)

  return (
    <section className="catalog-layout" aria-label="Releases workspace">
      <div className="catalog-main">
        <SearchField
          label="Search releases"
          placeholder="Title, artist, label, catalog number, year, medium or ownership status"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="filter-bar">
          <FilterSelect
            label="Medium"
            value={filters.medium}
            values={uniqueValues(
              releases.flatMap((release) =>
                release.ownedCopies.map((copy) => copy.medium),
              ),
            )}
            onChange={(medium) =>
              setFilters((current) => ({ ...current, medium }))
            }
          />
          <FilterSelect
            label="Label"
            value={filters.label}
            values={uniqueValues(releases.flatMap(releaseLabelNames))}
            onChange={(label) =>
              setFilters((current) => ({ ...current, label }))
            }
          />
          <FilterSelect
            label="Year or date"
            value={filters.year}
            values={uniqueValues(releases.map((release) => release.year))}
            onChange={(year) => setFilters((current) => ({ ...current, year }))}
          />
          <FilterSelect
            label="Tag"
            value={filters.tag}
            values={uniqueValues(
              releases.flatMap((release) => [
                ...release.genres,
                ...release.tags,
              ]),
            )}
            onChange={(tag) => setFilters((current) => ({ ...current, tag }))}
          />
          <RatingColumnSelector
            criteria={releaseRatingCriteria}
            selectedIds={selectedRatingColumnIds}
            storageKey="discweave.releaseRatingColumns"
            onChange={setRatingColumnIds}
          />
          <span className="result-count">{visibleReleases.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <ReleaseEntryForm
            artists={artists}
            dictionaries={dictionaries}
            releases={releases}
            tracks={tracks}
            onCancel={onManualEntryClose}
            onSubmit={handleAddRelease}
          />
        ) : null}
        {editingRelease ? (
          <ReleaseEntryForm
            artists={artists}
            dictionaries={dictionaries}
            initialRelease={editingRelease}
            initialShowDiscogsLookup={
              editingRelease.id === discogsLookupReleaseId
            }
            key={editingRelease.id}
            releases={releases}
            tracks={tracks}
            onCancel={() => {
              setEditingReleaseId('')
              setDiscogsLookupReleaseId('')
            }}
            onSubmit={handleUpdateRelease}
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
        <ReleaseTable
          releases={visibleReleases}
          ratingCriteria={releaseRatingCriteria.filter((criterion) =>
            selectedRatingColumnIds.includes(criterion.id),
          )}
          selectedReleaseId={selectedRelease?.id ?? ''}
          onSelectRelease={selectRelease}
        />
      </div>

      {selectedRelease ? (
        <ReleaseDetail
          ownedItems={ownedItems}
          onEdit={() => {
            setEditingReleaseId(selectedRelease.id)
            setDiscogsLookupReleaseId('')
          }}
          onDelete={() => handleDeleteRelease(selectedRelease.id)}
          onEditLocalFiles={
            canEditLocalFiles
              ? (localTracks) => {
                  void handleEditLocalFiles(localTracks)
                }
              : undefined
          }
          onRemoveCover={handleRemoveReleaseCover}
          onUpdateViaDiscogs={() => {
            setEditingReleaseId(selectedRelease.id)
            setDiscogsLookupReleaseId(selectedRelease.id)
          }}
          canUpdateViaDiscogs={canUseDiscogs}
          onUploadCover={handleUploadReleaseCover}
          playlists={playlists}
          release={selectedRelease}
          relations={relations}
          ratingCriteria={ratingCriteria}
          onDeleteRating={onDeleteRating}
          onRateTarget={onRateTarget}
          tracks={tracks.filter(
            (track) =>
              track.release.id === selectedRelease.id ||
              track.releaseAppearances.some(
                (appearance) => appearance.releaseId === selectedRelease.id,
              ),
          )}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

function localEditPanelKey(files: LocalEditableFile[]) {
  return files
    .map((file) => `${file.localAudioFileId}:${file.currentPath}`)
    .join('|')
}
