import { ChevronDown, ChevronRight, Search } from 'lucide-react'
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
import { RatingColumnSelector, RatingTableValue } from '../ratings/RatingsPanel'
import { ratingValueFor, readRatingColumnIds } from '../ratings/ratingUtils'
import { FilterSelect } from '../catalog/FilterSelect'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { ArtistRecord } from '../artists/artistsData'
import { LocalFileEditPanel } from '../localFiles/LocalFileEditPanel'
import {
  isLocalEditsAvailable,
  localEditableFileFromTrackDigitalFile,
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
} from './trackDisplayHelpers'
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
  const [serverStacks, setServerStacks] = useState<TrackStackDto[] | null>(null)
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
  const creditRoleLabelsByCode = useMemo(
    () =>
      new Map(dictionaries.creditRole.map((entry) => [entry.code, entry.name])),
    [dictionaries],
  )
  const canUseDiscogs = discogsIntegrationStatus?.configured !== false

  useEffect(() => {
    let isActive = true

    if (!serverBackedCatalog) {
      setServerStacks(null)
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
  }, [serverBackedCatalog, stackRefreshKey])

  const visibleTracks = useMemo(() => {
    const terms = queryTerms(query)

    return tracks.filter(
      (track) =>
        terms.every((term) => trackSearchText(track).includes(term)) &&
        (!filters.format ||
          track.digitalFiles.some((file) => file.format === filters.format)) &&
        (!filters.creditRole ||
          track.credits.some((credit) =>
            (credit.roles && credit.roles.length > 0
              ? credit.roles
              : [credit.role]
            ).includes(filters.creditRole),
          )) &&
        (!filters.relationType ||
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
    <section
      className="catalog-layout tracks-layout"
      aria-label="Tracks workspace"
    >
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
        <TrackStacksPanel
          ratingCriteria={trackRatingCriteria.filter((criterion) =>
            selectedRatingColumnIds.includes(criterion.id),
          )}
          dictionaries={dictionaries}
          expandedStackIds={expandedStackIds}
          selectedTrackId={selectedTrack?.id ?? ''}
          serverStacks={serverStacks}
          visibleTracks={visibleTracks}
          relations={relations}
          tracks={tracks}
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

type TrackStacksPanelProps = {
  dictionaries: CatalogDictionaries
  expandedStackIds: Set<string>
  ratingCriteria: RatingCriterion[]
  relations: RelationRecord[]
  serverStacks?: TrackStackDto[] | null
  tracks: TrackRecord[]
  visibleTracks: TrackRecord[]
  selectedTrackId: string
  onSelectTrack: (trackId: string) => void
  onToggleStack: (stackId: string) => void
}

type TrackStackRow = {
  id: string
  original: TrackRecord
  members: TrackStackMember[]
  hasCycleIssue: boolean
}

type TrackStackMember = {
  track: TrackRecord
  relationType: string
  depth: number
  isDirect: boolean
}

const productStackRelationTypeCodes = ['remixOf', 'versionOf'] as const

type ProductStackRelationTypeCode =
  (typeof productStackRelationTypeCodes)[number]

type TrackStackMemberGroup = {
  key: ProductStackRelationTypeCode | 'other'
  label: string
  members: TrackStackMember[]
}

function TrackStacksPanel({
  dictionaries,
  expandedStackIds,
  ratingCriteria,
  relations,
  serverStacks,
  tracks,
  visibleTracks,
  selectedTrackId,
  onSelectTrack,
  onToggleStack,
}: TrackStacksPanelProps) {
  const relationTypeValues = useMemo(
    () => stackRelationTypeValues(dictionaries),
    [dictionaries],
  )
  const visibleTrackIds = useMemo(
    () => new Set(visibleTracks.map((track) => track.id)),
    [visibleTracks],
  )
  const stacks = useMemo(
    () =>
      (serverStacks
        ? buildTrackStacksFromServer(serverStacks, tracks)
        : buildTrackStacks(tracks, relations, relationTypeValues)
      ).filter(
        (stack) =>
          visibleTrackIds.has(stack.original.id) ||
          stack.members.some((member) => visibleTrackIds.has(member.track.id)),
      ),
    [relationTypeValues, relations, serverStacks, tracks, visibleTrackIds],
  )

  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="track-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="track-results-title">Track records</h2>
          <p>Stacked by original tracks and relation-derived versions.</p>
        </div>
      </div>

      <div className="track-stack-list" role="list">
        {stacks.map((stack) => {
          const isExpanded = expandedStackIds.has(stack.id)
          return (
            <article
              aria-current={
                stack.original.id === selectedTrackId ? 'true' : undefined
              }
              aria-label={`${stack.original.title} ${trackArtistDisplay(stack.original)} ${trackReleaseDisplay(stack.original)}`}
              className="track-stack-row"
              key={stack.id}
              role="listitem"
            >
              <div
                className={
                  stack.original.id === selectedTrackId
                    ? 'track-stack-root is-selected'
                    : 'track-stack-root'
                }
              >
                <button
                  aria-label={isExpanded ? 'Collapse stack' : 'Expand stack'}
                  className="icon-button track-stack-toggle"
                  disabled={stack.members.length === 0}
                  type="button"
                  onClick={() => onToggleStack(stack.id)}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
                <button
                  className="track-stack-title"
                  type="button"
                  onClick={() => onSelectTrack(stack.original.id)}
                >
                  <strong>{stack.original.title}</strong>
                  <span>{trackArtistDisplay(stack.original)}</span>
                </button>
                <TrackStackFacts
                  ratingCriteria={ratingCriteria}
                  stack={stack}
                  track={stack.original}
                />
              </div>
              {isExpanded ? (
                <div className="track-stack-members">
                  {trackStackMemberGroups(stack.members, dictionaries).map(
                    (group) => (
                      <div
                        className="track-stack-member-group"
                        key={`${stack.id}:${group.key}`}
                      >
                        <div className="track-stack-member-group-label">
                          {group.label}
                        </div>
                        {group.members.map((member) => (
                          <button
                            aria-label={`${member.track.title} ${trackReleaseDisplay(member.track)}`}
                            className={
                              member.track.id === selectedTrackId
                                ? 'track-stack-member is-selected'
                                : 'track-stack-member'
                            }
                            key={`${stack.id}:${member.track.id}`}
                            type="button"
                            onClick={() => onSelectTrack(member.track.id)}
                          >
                            <span className="track-stack-member-title">
                              <strong>{member.track.title}</strong>
                              <span className="track-stack-member-details">
                                {group.key === 'other' ? (
                                  <span className="track-stack-member-connector">
                                    {trackRelationTypeDisplay(
                                      member.relationType,
                                      dictionaries,
                                    )}
                                  </span>
                                ) : null}
                                <span>{trackReleaseDisplay(member.track)}</span>
                              </span>
                            </span>
                            <span className="track-stack-member-meta">
                              {member.track.versionYear ?? 'No year'}
                            </span>
                          </button>
                        ))}
                      </div>
                    ),
                  )}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function trackStackMemberGroups(
  members: TrackStackMember[],
  dictionaries: CatalogDictionaries,
): TrackStackMemberGroup[] {
  const remixMembers: TrackStackMember[] = []
  const versionMembers: TrackStackMember[] = []
  const otherMembers: TrackStackMember[] = []

  for (const member of members) {
    const relationTypeCode = normalizeTrackRelationTypeCode(
      member.relationType,
      dictionaries,
    )

    if (relationTypeCode === 'remixOf') {
      remixMembers.push(member)
    } else if (relationTypeCode === 'versionOf') {
      versionMembers.push(member)
    } else {
      otherMembers.push(member)
    }
  }

  const groups: TrackStackMemberGroup[] = [
    { key: 'remixOf', label: 'Remixes', members: remixMembers },
    { key: 'versionOf', label: 'Versions', members: versionMembers },
    { key: 'other', label: 'Other relations', members: otherMembers },
  ]

  return groups.filter((group) => group.members.length > 0)
}

function normalizeTrackRelationTypeCode(
  relationType: string,
  dictionaries: CatalogDictionaries,
) {
  const normalized = relationType.trim().toLowerCase()
  const dictionaryEntry = dictionaries.trackRelationType.find(
    (entry) =>
      entry.code.toLowerCase() === normalized ||
      entry.name.toLowerCase() === normalized,
  )

  return dictionaryEntry?.code ?? relationType
}

function trackRelationTypeDisplay(
  relationType: string,
  dictionaries: CatalogDictionaries,
) {
  const relationTypeCode = normalizeTrackRelationTypeCode(
    relationType,
    dictionaries,
  )
  return (
    dictionaries.trackRelationType.find((entry) => entry.code === relationTypeCode)
      ?.name ?? relationType
  )
}

function TrackStackFacts({
  ratingCriteria,
  stack,
  track,
}: {
  ratingCriteria: RatingCriterion[]
  stack: TrackStackRow
  track: TrackRecord
}) {
  return (
    <div className="track-stack-facts">
      <span>{track.versionYear ?? 'No year'}</span>
      <span>{track.duration}</span>
      <span>{stack.members.length} versions</span>
      <span>{track.releaseAppearances.length} releases</span>
      <span>{track.digitalFiles.length} files</span>
      {stack.hasCycleIssue ? <span>Cycle issue</span> : null}
      {ratingCriteria.map((criterion) => (
        <span key={criterion.id}>
          {criterion.name}:{' '}
          <RatingTableValue
            value={ratingValueFor(track.ratings, criterion.id)}
          />
        </span>
      ))}
    </div>
  )
}

function stackRelationTypeValues(dictionaries: CatalogDictionaries) {
  const values = new Set<string>(productStackRelationTypeCodes)
  for (const entry of dictionaries.trackRelationType) {
    if (
      productStackRelationTypeCodes.includes(
        entry.code as ProductStackRelationTypeCode,
      )
    ) {
      values.add(entry.name)
    }
  }
  return values
}

function buildTrackStacks(
  tracks: TrackRecord[],
  relations: RelationRecord[],
  relationTypeValues: Set<string>,
) {
  const tracksById = new Map(tracks.map((track) => [track.id, track]))
  const incoming = new Map<string, RelationRecord[]>()
  for (const relation of relations) {
    if (!relationTypeValues.has(relation.relationType)) {
      continue
    }
    const sourceTrackId =
      relation.sourceLink?.kind === 'track' ? relation.sourceLink.id : null
    const targetTrackId =
      relation.targetLink?.kind === 'track' ? relation.targetLink.id : null
    if (!sourceTrackId || !targetTrackId || !tracksById.has(sourceTrackId)) {
      continue
    }
    incoming.set(targetTrackId, [
      ...(incoming.get(targetTrackId) ?? []),
      relation,
    ])
  }

  const originals = tracks.filter((track) => track.isOriginal)
  const roots = originals.length > 0 ? originals : tracks
  const memberIds = new Set<string>()
  const stacks = roots.map((root) => {
    const { hasCycleIssue, members } = collectStackMembers(
      root,
      incoming,
      tracksById,
    )
    members.forEach((member) => memberIds.add(member.track.id))
    return {
      id: root.id,
      original: root,
      members,
      hasCycleIssue,
    }
  })
  if (originals.length === 0) {
    return stacks
  }

  return [
    ...stacks,
    ...tracks
      .filter((track) => !track.isOriginal && !memberIds.has(track.id))
      .map((track) => ({
        id: track.id,
        original: track,
        members: [],
        hasCycleIssue: false,
      })),
  ]
}

function buildTrackStacksFromServer(
  stackDtos: TrackStackDto[],
  tracks: TrackRecord[],
) {
  const tracksById = new Map(tracks.map((track) => [track.id, track]))
  const stackedTrackIds = new Set<string>()
  const rows: TrackStackRow[] = []

  for (const stackDto of stackDtos) {
    const original = tracksById.get(stackDto.originalTrackId)
    if (!original) {
      continue
    }

    stackedTrackIds.add(original.id)

    const members = stackDto.members.flatMap((memberDto) => {
      const track = tracksById.get(memberDto.trackId)
      if (!track) {
        return []
      }

      stackedTrackIds.add(track.id)

      return [
        {
          track,
          relationType: memberDto.relationType,
          depth: memberDto.depth,
          isDirect: memberDto.isDirect,
        },
      ]
    })

    rows.push({
      id: original.id,
      original,
      members,
      hasCycleIssue: stackDto.hasCycleIssue,
    })
  }

  return [
    ...rows,
    ...tracks
      .filter((track) => !stackedTrackIds.has(track.id))
      .map((track) => ({
        id: track.id,
        original: track,
        members: [],
        hasCycleIssue: false,
      })),
  ]
}

function collectStackMembers(
  root: TrackRecord,
  incoming: Map<string, RelationRecord[]>,
  tracksById: Map<string, TrackRecord>,
) {
  const members: TrackStackMember[] = []
  const visited = new Set<string>()
  let hasCycleIssue = false
  const queue: Array<{ trackId: string; depth: number; path: string[] }> = [
    { trackId: root.id, depth: 0, path: [root.id] },
  ]

  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) {
      continue
    }
    for (const relation of incoming.get(node.trackId) ?? []) {
      const sourceTrackId =
        relation.sourceLink?.kind === 'track' ? relation.sourceLink.id : null
      if (!sourceTrackId || node.path.includes(sourceTrackId)) {
        hasCycleIssue = true
        continue
      }
      const track = tracksById.get(sourceTrackId)
      if (!track || visited.has(sourceTrackId)) {
        continue
      }
      visited.add(sourceTrackId)
      members.push({
        track,
        relationType: relation.relationType,
        depth: node.depth + 1,
        isDirect: node.depth === 0,
      })
      queue.push({
        trackId: sourceTrackId,
        depth: node.depth + 1,
        path: [...node.path, sourceTrackId],
      })
    }
  }

  return {
    hasCycleIssue,
    members: members.sort((left, right) => {
      return (
        left.depth - right.depth ||
        left.track.title.localeCompare(right.track.title)
      )
    }),
  }
}
