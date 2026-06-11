import { Search } from 'lucide-react'
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
import { RatingColumnSelector, RatingTableValue } from '../ratings/RatingsPanel'
import { ratingValueFor, readRatingColumnIds } from '../ratings/ratingUtils'
import { FilterSelect } from '../catalog/FilterSelect'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { ArtistRecord } from '../artists/artistsData'
import { LocalFileEditPanel } from '../localFiles/LocalFileEditPanel'
import {
  isLocalEditsAvailable,
  localEditableFileFromTrack,
  type LocalEditableFile,
} from '../localFiles/localFileEditModel'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import { EmptyDetailPanel, TrackDetail } from './TrackDetail'
import { TrackEntryForm } from './TrackEntryForm'
import {
  hasRealLocalFile,
  trackArtistDisplay,
  trackReleaseAppearances,
  trackReleaseDisplay,
  trackSearchText,
  trackVersionDisplay,
} from './trackDisplayHelpers'
import type { TrackRecord } from './tracksData'

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
  tracks: providedTracks,
  dictionaries = defaultCatalogDictionaries,
  discogsIntegrationStatus,
  ratingCriteria = [],
  onDeleteRating,
  onRateTarget,
}: TracksWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    format: '',
    creditRole: '',
    relationType: '',
    releaseLink: '',
  })
  const [manualTracks, setManualTracks] = useState<TrackRecord[]>([])
  const [editingTrackId, setEditingTrackId] = useState('')
  const [discogsLookupTrackId, setDiscogsLookupTrackId] = useState('')
  const [localEditFiles, setLocalEditFiles] = useState<LocalEditableFile[]>([])
  const [ratingColumnIds, setRatingColumnIds] = useState(() =>
    readRatingColumnIds('discweave.trackRatingColumns'),
  )
  const tracks = useMemo(() => {
    return [...(providedTracks ?? []), ...manualTracks]
  }, [manualTracks, providedTracks])
  const creditRoleLabelsByCode = useMemo(
    () =>
      new Map(dictionaries.creditRole.map((entry) => [entry.code, entry.name])),
    [dictionaries],
  )
  const canUseDiscogs =
    discogsIntegrationStatus?.enabled !== false &&
    discogsIntegrationStatus?.configured !== false

  const visibleTracks = useMemo(() => {
    const terms = queryTerms(query)

    return tracks.filter(
      (track) =>
        terms.every((term) => trackSearchText(track).includes(term)) &&
        (!filters.format || track.fileMetadata.format === filters.format) &&
        (!filters.creditRole ||
          track.credits.some((credit) =>
            (credit.roles && credit.roles.length > 0
              ? credit.roles
              : [credit.role]
            ).includes(filters.creditRole),
          )) &&
        (!filters.relationType ||
          track.versionHint === filters.relationType ||
          track.relations.some(
            (relation) => relation.type === filters.relationType,
          )) &&
        (!filters.releaseLink ||
          (filters.releaseLink === 'Linked'
            ? trackReleaseAppearances(track).some(
                (appearance) => appearance.releaseId,
              )
            : !trackReleaseAppearances(track).some(
                (appearance) => appearance.releaseId,
              ))),
    )
  }, [filters, query, tracks])
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

  async function handleEditLocalFile(track: TrackRecord) {
    const mappings = await loadTagRoleMappings()
    const editableFile = localEditableFileFromTrack(
      track,
      mappings.items,
      creditRoleLabelsByCode,
    )
    if (editableFile) {
      setLocalEditFiles([editableFile])
    }
  }

  const editingTrack = tracks.find((track) => track.id === editingTrackId)
  const canEditLocalFiles = isLocalEditsAvailable()
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
    <section className="catalog-layout" aria-label="Tracks workspace">
      <div className="catalog-main">
        <SearchField
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
                .map((track) => track.fileMetadata.format),
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
            label="Version or relation type"
            value={filters.relationType}
            values={uniqueValues(
              tracks.flatMap((track) => [
                trackVersionDisplay(track),
                ...track.relations.map((relation) => relation.type),
              ]),
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
        <TrackTable
          ratingCriteria={trackRatingCriteria.filter((criterion) =>
            selectedRatingColumnIds.includes(criterion.id),
          )}
          selectedTrackId={selectedTrack?.id ?? ''}
          tracks={visibleTracks}
          onSelectTrack={selectTrack}
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
              ? (track) => {
                  void handleEditLocalFile(track)
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
  return files
    .map((file) => `${file.ownedItemId}:${file.currentPath}`)
    .join('|')
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

type SearchFieldProps = {
  label: string
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
}

function SearchField({
  label,
  placeholder,
  query,
  onQueryChange,
}: SearchFieldProps) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

type TrackTableProps = {
  ratingCriteria: RatingCriterion[]
  tracks: TrackRecord[]
  selectedTrackId: string
  onSelectTrack: (trackId: string) => void
}

function TrackTable({
  ratingCriteria,
  tracks,
  selectedTrackId,
  onSelectTrack,
}: TrackTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="track-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="track-results-title">Track records</h2>
          <p>
            Tracks connect releases, credits, versions and local file facts.
          </p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Track</th>
              <th scope="col">Artists</th>
              <th scope="col">Releases</th>
              <th scope="col">Duration</th>
              <th scope="col">Version</th>
              {ratingCriteria.map((criterion) => (
                <th key={criterion.id} scope="col">
                  {criterion.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr
                key={track.id}
                aria-selected={track.id === selectedTrackId}
                className={
                  track.id === selectedTrackId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectTrack(track.id)}
                  >
                    <strong>{track.title}</strong>
                  </button>
                </th>
                <td data-label="Artists">{trackArtistDisplay(track)}</td>
                <td data-label="Releases">{trackReleaseDisplay(track)}</td>
                <td data-label="Duration">{track.duration}</td>
                <td data-label="Version">{trackVersionDisplay(track)}</td>
                {ratingCriteria.map((criterion) => (
                  <td data-label={criterion.name} key={criterion.id}>
                    <RatingTableValue
                      value={ratingValueFor(track.ratings, criterion.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
