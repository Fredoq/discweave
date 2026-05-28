import { resolveRoute, type AppRoutePath } from './routes'
import type { ReactNode } from 'react'
import type { ArtistRecord } from '../features/artists/artistsData'
import { ArtistsWorkspace } from '../features/artists/ArtistsWorkspace'
import { ServerArtistsWorkspace } from '../features/artists/ServerArtistsWorkspace'
import { CatalogAddEntryFlow } from '../features/catalog/CatalogAddEntryFlow'
import { CatalogWorkspace } from '../features/catalog/CatalogWorkspace'
import { ServerEntityWorkspace } from '../features/catalog/ServerEntityWorkspace'
import type {
  CatalogState,
  DictionaryEntry,
  DictionaryEntryRequest,
  DictionaryEntryUpdateRequest,
  RatingCriterion,
  RatingCriterionRequest,
  RatingCriterionUpdateRequest,
  RatingTargetType,
  SearchEntityType,
} from '../features/catalog/catalogApi'
import { ExportsWorkspace } from '../features/exports/ExportsWorkspace'
import { ImportsWorkspace } from '../features/imports/ImportsWorkspace'
import type { LabelRecord } from '../features/labels/labelsData'
import { LabelsWorkspace } from '../features/labels/LabelsWorkspace'
import type { OwnedItemRecord } from '../features/ownedItems/ownedItemsData'
import { OwnedItemsWorkspace } from '../features/ownedItems/OwnedItemsWorkspace'
import { ServerOwnedItemsWorkspace } from '../features/ownedItems/ServerOwnedItemsWorkspace'
import type { PlaylistRecord } from '../features/playlists/playlistsData'
import { PlaylistsWorkspace } from '../features/playlists/PlaylistsWorkspace'
import type { ReleaseRecord } from '../features/releases/releasesData'
import { ReleasesWorkspace } from '../features/releases/ReleasesWorkspace'
import type { RelationRecord } from '../features/relations/relationsData'
import { RelationsWorkspace } from '../features/relations/RelationsWorkspace'
import { SectionPlaceholder } from '../features/sections/SectionPlaceholder'
import { ServerSettingsWorkspace } from '../features/settings/ServerSettingsWorkspace'
import { SettingsWorkspace } from '../features/settings/SettingsWorkspace'
import type { TrackRecord } from '../features/tracks/tracksData'
import { TracksWorkspace } from '../features/tracks/TracksWorkspace'

export const manualEntryRoutes = new Set<AppRoutePath>([
  '/artists',
  '/labels',
  '/releases',
  '/tracks',
  '/owned-items',
  '/relations',
  '/playlists',
])

type ServerEntityWorkspaceConfig = {
  ariaLabel: string
  entityType?: SearchEntityType
  placeholder: string
  queryParam: string
  savedView?: string
  searchLabel: string
}

const serverEntityWorkspaceConfigs: Partial<
  Record<AppRoutePath, ServerEntityWorkspaceConfig>
> = {
  '/releases': {
    ariaLabel: 'Releases workspace',
    entityType: 'release',
    placeholder: 'Release, artist, label, year, medium, tag or status',
    queryParam: 'release',
    searchLabel: 'Search releases',
  },
  '/tracks': {
    ariaLabel: 'Tracks workspace',
    entityType: 'track',
    placeholder: 'Track, artist, release, role, medium, tag or status',
    queryParam: 'track',
    searchLabel: 'Search tracks',
  },
  '/labels': {
    ariaLabel: 'Labels workspace',
    entityType: 'label',
    placeholder: 'Label, release, artist, catalog number, tag or status',
    queryParam: 'label',
    searchLabel: 'Search labels',
  },
  '/playlists': {
    ariaLabel: 'Playlists workspace',
    entityType: 'playlist',
    placeholder: 'Playlist, rule, tag, media, ownership status or note',
    queryParam: 'playlist',
    searchLabel: 'Search playlists',
  },
  '/owned-items': {
    ariaLabel: 'Owned items workspace',
    entityType: 'ownedItem',
    placeholder: 'Owned copy, release, track, medium, storage, tag or status',
    queryParam: 'ownedItem',
    searchLabel: 'Search owned items',
  },
  '/relations': {
    ariaLabel: 'Relations workspace',
    placeholder: 'Artist, track, role, relation, remix or version',
    queryParam: 'relation',
    savedView: 'credits',
    searchLabel: 'Search relations',
  },
}

export function renderWorkspace(
  path: AppRoutePath,
  isManualEntryOpen: boolean,
  isCatalogAddEntryOpen: boolean,
  onManualEntryClose: () => void,
  onCatalogAddEntryClose: () => void,
  catalogState: {
    artists: ArtistRecord[]
    catalogAddEntryPanel?: ReactNode
    labels: LabelRecord[]
    locationSearch: string
    releases: ReleaseRecord[]
    tracks: TrackRecord[]
    ownedItems: OwnedItemRecord[]
    relations: RelationRecord[]
    playlists: PlaylistRecord[]
    searchRefreshKey: number
    serverBackedCatalog: boolean
    hasLoadedFullCatalog: boolean
    dictionaries: NonNullable<CatalogState['dictionaries']>
    ratingCriteria: NonNullable<CatalogState['ratingCriteria']>
    ratings: NonNullable<CatalogState['ratings']>
    onAddArtist: (artist: ArtistRecord) => void
    onAddLabel: (label: LabelRecord) => void
    onAddRelease: (release: ReleaseRecord, tracks: TrackRecord[]) => void
    onAddTrack: (track: TrackRecord) => void
    onAddOwnedItem: (item: OwnedItemRecord) => void
    onAddRelation: (relation: RelationRecord) => void
    onAddPlaylist: (playlist: PlaylistRecord) => void
    onUpdateArtist: (artist: ArtistRecord) => void
    onUpdateLabel: (label: LabelRecord) => void
    onUpdateRelease: (release: ReleaseRecord, tracks?: TrackRecord[]) => void
    onUpdateTrack: (track: TrackRecord) => void
    onUpdateOwnedItem: (item: OwnedItemRecord) => void
    onUpdateRelation: (relation: RelationRecord) => void
    onUpdatePlaylist: (playlist: PlaylistRecord) => void
    onDeleteArtist: (artistId: string) => void
    onDeleteLabel: (labelId: string) => void
    onDeleteRelease: (releaseId: string) => void
    onRemoveReleaseCover: (releaseId: string) => void
    onUploadReleaseCover: (releaseId: string, file: File) => void
    onDeleteTrack: (trackId: string) => void
    onDeleteOwnedItem: (itemId: string) => void
    onDeleteRelation: (relationId: string) => void
    onDeletePlaylist: (playlistId: string) => void
    onCreateDictionaryEntry: (entry: DictionaryEntryRequest) => void
    onUpdateDictionaryEntry: (
      entryId: string,
      entry: DictionaryEntryUpdateRequest,
    ) => void
    onDeleteDictionaryEntry: (entry: DictionaryEntry) => void
    onReplaceDictionaryEntry: (
      entry: DictionaryEntry,
      replacementCode: string,
    ) => void
    onCreateRatingCriterion: (criterion: RatingCriterionRequest) => void
    onUpdateRatingCriterion: (
      criterionId: string,
      criterion: RatingCriterionUpdateRequest,
    ) => void
    onDeleteRatingCriterion: (criterion: RatingCriterion) => void
    onRateTarget: (
      targetType: RatingTargetType,
      targetId: string,
      criterionId: string,
      value: number,
    ) => void
    onDeleteRating: (
      targetType: RatingTargetType,
      targetId: string,
      criterionId: string,
    ) => void
    onCatalogChanged: () => void
    onSessionExpired: () => void
  },
) {
  const shouldUseServerWorkspace =
    catalogState.serverBackedCatalog && !catalogState.hasLoadedFullCatalog
  const serverEntityConfig = serverEntityWorkspaceConfigs[path]
  const serverEntityWorkspace = serverEntityConfig ? (
    <ServerEntityWorkspace
      key={path}
      {...serverEntityConfig}
      locationSearch={catalogState.locationSearch}
      routePath={path}
      searchRefreshKey={catalogState.searchRefreshKey}
    />
  ) : null

  switch (path) {
    case '/catalog':
      return (
        <CatalogWorkspace
          addEntryPanel={
            catalogState.catalogAddEntryPanel ??
            (isCatalogAddEntryOpen ? (
              <CatalogAddEntryFlow
                artists={catalogState.artists}
                dictionaries={catalogState.dictionaries}
                labels={catalogState.labels}
                ownedItems={catalogState.ownedItems}
                playlists={catalogState.playlists}
                relations={catalogState.relations}
                releases={catalogState.releases}
                tracks={catalogState.tracks}
                onAddArtist={catalogState.onAddArtist}
                onAddLabel={catalogState.onAddLabel}
                onAddOwnedItem={catalogState.onAddOwnedItem}
                onAddRelation={catalogState.onAddRelation}
                onAddRelease={catalogState.onAddRelease}
                onAddTrack={catalogState.onAddTrack}
                onCancel={onCatalogAddEntryClose}
              />
            ) : null)
          }
          artists={catalogState.artists}
          labels={catalogState.labels}
          locationSearch={catalogState.locationSearch}
          ownedItems={catalogState.ownedItems}
          playlists={catalogState.playlists}
          relations={catalogState.relations}
          releases={catalogState.releases}
          searchRefreshKey={catalogState.searchRefreshKey}
          serverBacked={catalogState.serverBackedCatalog}
          tracks={catalogState.tracks}
        />
      )
    case '/artists':
      return catalogState.serverBackedCatalog &&
        !catalogState.hasLoadedFullCatalog ? (
        <ServerArtistsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddArtist={catalogState.onAddArtist}
          onManualEntryClose={onManualEntryClose}
          searchRefreshKey={catalogState.searchRefreshKey}
        />
      ) : (
        <ArtistsWorkspace
          artists={catalogState.artists}
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddArtist={catalogState.onAddArtist}
          onDeleteArtist={catalogState.onDeleteArtist}
          onManualEntryClose={onManualEntryClose}
          onUpdateArtist={catalogState.onUpdateArtist}
          ownedItems={catalogState.ownedItems}
          playlists={catalogState.playlists}
          relations={catalogState.relations}
          releases={catalogState.releases}
          ratingCriteria={catalogState.ratingCriteria}
          onDeleteRating={catalogState.onDeleteRating}
          onRateTarget={catalogState.onRateTarget}
          tracks={catalogState.tracks}
        />
      )
    case '/releases':
      return shouldUseServerWorkspace && serverEntityWorkspace ? (
        serverEntityWorkspace
      ) : (
        <ReleasesWorkspace
          artists={catalogState.artists}
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddRelease={catalogState.onAddRelease}
          onDeleteRelease={catalogState.onDeleteRelease}
          onRemoveReleaseCover={catalogState.onRemoveReleaseCover}
          onManualEntryClose={onManualEntryClose}
          onUpdateRelease={catalogState.onUpdateRelease}
          onUploadReleaseCover={catalogState.onUploadReleaseCover}
          ownedItems={catalogState.ownedItems}
          releases={catalogState.releases}
          relations={catalogState.relations}
          playlists={catalogState.playlists}
          tracks={catalogState.tracks}
          ratingCriteria={catalogState.ratingCriteria}
          onDeleteRating={catalogState.onDeleteRating}
          onRateTarget={catalogState.onRateTarget}
          dictionaries={catalogState.dictionaries}
        />
      )
    case '/tracks':
      return shouldUseServerWorkspace && serverEntityWorkspace ? (
        serverEntityWorkspace
      ) : (
        <TracksWorkspace
          artists={catalogState.artists}
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddTrack={catalogState.onAddTrack}
          onDeleteTrack={catalogState.onDeleteTrack}
          onManualEntryClose={onManualEntryClose}
          onUpdateTrack={catalogState.onUpdateTrack}
          playlists={catalogState.playlists}
          releases={catalogState.releases}
          relations={catalogState.relations}
          tracks={catalogState.tracks}
          ratingCriteria={catalogState.ratingCriteria}
          onDeleteRating={catalogState.onDeleteRating}
          onRateTarget={catalogState.onRateTarget}
          dictionaries={catalogState.dictionaries}
        />
      )
    case '/playlists':
      return shouldUseServerWorkspace && serverEntityWorkspace ? (
        serverEntityWorkspace
      ) : (
        <PlaylistsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onManualEntryClose={onManualEntryClose}
          onAddPlaylist={catalogState.onAddPlaylist}
          onDeletePlaylist={catalogState.onDeletePlaylist}
          onUpdatePlaylist={catalogState.onUpdatePlaylist}
          playlists={catalogState.playlists}
          ratings={catalogState.ratings}
          releases={catalogState.releases}
          tracks={catalogState.tracks}
          ownedItems={catalogState.ownedItems}
          artists={catalogState.artists}
          ratingCriteria={catalogState.ratingCriteria}
        />
      )
    case '/labels':
      return shouldUseServerWorkspace && serverEntityWorkspace ? (
        serverEntityWorkspace
      ) : (
        <LabelsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          labels={catalogState.labels}
          locationSearch={catalogState.locationSearch}
          onAddLabel={catalogState.onAddLabel}
          onDeleteLabel={catalogState.onDeleteLabel}
          onManualEntryClose={onManualEntryClose}
          onUpdateLabel={catalogState.onUpdateLabel}
          ownedItems={catalogState.ownedItems}
          releases={catalogState.releases}
        />
      )
    case '/owned-items':
      return shouldUseServerWorkspace ? (
        <ServerOwnedItemsWorkspace
          locationSearch={catalogState.locationSearch}
          onSessionExpired={catalogState.onSessionExpired}
          searchRefreshKey={catalogState.searchRefreshKey}
        />
      ) : (
        <OwnedItemsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          items={catalogState.ownedItems}
          locationSearch={catalogState.locationSearch}
          onAddItem={catalogState.onAddOwnedItem}
          onDeleteItem={catalogState.onDeleteOwnedItem}
          onManualEntryClose={onManualEntryClose}
          onUpdateItem={catalogState.onUpdateOwnedItem}
          playlists={catalogState.playlists}
          releases={catalogState.releases}
          relations={catalogState.relations}
          tracks={catalogState.tracks}
          dictionaries={catalogState.dictionaries}
        />
      )
    case '/relations':
      return shouldUseServerWorkspace && serverEntityWorkspace ? (
        serverEntityWorkspace
      ) : (
        <RelationsWorkspace
          artists={catalogState.artists}
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddRelation={catalogState.onAddRelation}
          onDeleteRelation={catalogState.onDeleteRelation}
          onManualEntryClose={onManualEntryClose}
          onUpdateRelation={catalogState.onUpdateRelation}
          ownedItems={catalogState.ownedItems}
          playlists={catalogState.playlists}
          relations={catalogState.relations}
          releases={catalogState.releases}
          tracks={catalogState.tracks}
          dictionaries={catalogState.dictionaries}
        />
      )
    case '/settings':
      return shouldUseServerWorkspace ? (
        <ServerSettingsWorkspace
          onCreateEntry={catalogState.onCreateDictionaryEntry}
          onDeleteEntry={catalogState.onDeleteDictionaryEntry}
          onReplaceEntry={catalogState.onReplaceDictionaryEntry}
          onUpdateEntry={catalogState.onUpdateDictionaryEntry}
          onCreateRatingCriterion={catalogState.onCreateRatingCriterion}
          onDeleteRatingCriterion={catalogState.onDeleteRatingCriterion}
          onUpdateRatingCriterion={catalogState.onUpdateRatingCriterion}
          onSessionExpired={catalogState.onSessionExpired}
          searchRefreshKey={catalogState.searchRefreshKey}
        />
      ) : (
        <SettingsWorkspace
          dictionaries={catalogState.dictionaries}
          onCreateEntry={catalogState.onCreateDictionaryEntry}
          onDeleteEntry={catalogState.onDeleteDictionaryEntry}
          onReplaceEntry={catalogState.onReplaceDictionaryEntry}
          onUpdateEntry={catalogState.onUpdateDictionaryEntry}
          ratingCriteria={catalogState.ratingCriteria}
          onCreateRatingCriterion={catalogState.onCreateRatingCriterion}
          onDeleteRatingCriterion={catalogState.onDeleteRatingCriterion}
          onUpdateRatingCriterion={catalogState.onUpdateRatingCriterion}
        />
      )
    case '/imports':
      return (
        <ImportsWorkspace
          artists={catalogState.artists}
          dictionaries={catalogState.dictionaries}
          onCatalogChanged={catalogState.onCatalogChanged}
          onSessionExpired={catalogState.onSessionExpired}
        />
      )
    case '/exports':
      return (
        <ExportsWorkspace
          artists={catalogState.artists}
          countsAreLoaded={
            !catalogState.serverBackedCatalog ||
            catalogState.hasLoadedFullCatalog
          }
          dictionaries={catalogState.dictionaries}
          ownedItems={catalogState.ownedItems}
          onSessionExpired={catalogState.onSessionExpired}
          playlists={catalogState.playlists}
          ratingCriteria={catalogState.ratingCriteria}
          relations={catalogState.relations}
          releases={catalogState.releases}
          tracks={catalogState.tracks}
        />
      )
    default:
      return <SectionPlaceholder route={resolveRoute(path)} />
  }
}
