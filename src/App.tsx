import './App.css'
import { useEffect, useState } from 'react'
import { AppShell } from './app/AppShell'
import { isAppRoutePath, resolveRoute, type AppRoutePath } from './app/routes'
import { ArtistsWorkspace } from './features/artists/ArtistsWorkspace'
import {
  artistRecords,
  type ArtistRecord,
} from './features/artists/artistsData'
import { CatalogWorkspace } from './features/catalog/CatalogWorkspace'
import { OwnedItemsWorkspace } from './features/ownedItems/OwnedItemsWorkspace'
import {
  ownedItemRecords,
  type OwnedItemRecord,
} from './features/ownedItems/ownedItemsData'
import { PlaylistsWorkspace } from './features/playlists/PlaylistsWorkspace'
import {
  playlistRecords,
  type PlaylistRecord,
} from './features/playlists/playlistsData'
import { ReleasesWorkspace } from './features/releases/ReleasesWorkspace'
import {
  releaseRecords,
  type ReleaseRecord,
} from './features/releases/releasesData'
import { RelationsWorkspace } from './features/relations/RelationsWorkspace'
import {
  relationRecords,
  type RelationRecord,
} from './features/relations/relationsData'
import { SectionPlaceholder } from './features/sections/SectionPlaceholder'
import { SettingsWorkspace } from './features/settings/SettingsWorkspace'
import { TracksWorkspace } from './features/tracks/TracksWorkspace'
import { trackRecords, type TrackRecord } from './features/tracks/tracksData'

function App() {
  const [activeRoute, setActiveRoute] = useState(() =>
    resolveRoute(window.location.pathname),
  )
  const [locationSearch, setLocationSearch] = useState(
    () => window.location.search,
  )
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [manualEntryOpen, setManualEntryOpen] = useState<
    Partial<Record<AppRoutePath, boolean>>
  >({})
  const [manualArtists, setManualArtists] = useState<ArtistRecord[]>([])
  const [manualReleases, setManualReleases] = useState<ReleaseRecord[]>([])
  const [manualTracks, setManualTracks] = useState<TrackRecord[]>([])
  const [manualOwnedItems, setManualOwnedItems] = useState<OwnedItemRecord[]>(
    [],
  )
  const [manualRelations, setManualRelations] = useState<RelationRecord[]>([])
  const [manualPlaylists, setManualPlaylists] = useState<PlaylistRecord[]>([])

  const artists = [...artistRecords, ...manualArtists]
  const releases = [...releaseRecords, ...manualReleases]
  const tracks = [...trackRecords, ...manualTracks]
  const ownedItems = [...ownedItemRecords, ...manualOwnedItems]
  const relations = [...relationRecords, ...manualRelations]
  const playlists = [...playlistRecords, ...manualPlaylists]

  useEffect(() => {
    const handleLocationChange = () => {
      setActiveRoute(resolveRoute(window.location.pathname))
      setLocationSearch(window.location.search)
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('cratebase:navigation', handleLocationChange)

    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('cratebase:navigation', handleLocationChange)
    }
  }, [])

  const navigateToUrl = (href: string) => {
    const nextUrl = new URL(href, window.location.origin)

    if (
      nextUrl.origin !== window.location.origin ||
      !isAppRoutePath(nextUrl.pathname)
    ) {
      return false
    }

    const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (currentPath !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }

    setActiveRoute(resolveRoute(nextUrl.pathname))
    setLocationSearch(nextUrl.search)
    setActionStatus(null)

    return true
  }

  const navigate = (path: AppRoutePath) => {
    navigateToUrl(path)
  }

  const handleRouteAction = () => {
    if (!activeRoute.actionLabel) {
      return
    }

    if (manualEntryRoutes.has(activeRoute.path)) {
      setActionStatus(null)
      setManualEntryOpen((openForms) => ({
        ...openForms,
        [activeRoute.path]: true,
      }))
      return
    }

    setActionStatus(
      `${activeRoute.actionLabel} is queued for the ${activeRoute.label} workspace.`,
    )
  }

  return (
    <AppShell
      actionStatus={actionStatus}
      activeRoute={activeRoute}
      onNavigate={navigate}
      onNavigateToUrl={navigateToUrl}
      onRouteAction={handleRouteAction}
    >
      {renderWorkspace(
        activeRoute.path,
        Boolean(manualEntryOpen[activeRoute.path]),
        () =>
          setManualEntryOpen((openForms) => ({
            ...openForms,
            [activeRoute.path]: false,
          })),
        {
          locationSearch,
          artists,
          releases,
          tracks,
          ownedItems,
          relations,
          playlists,
          onAddArtist: (artist) =>
            setManualArtists((currentArtists) => [...currentArtists, artist]),
          onAddRelease: (release, createdTracks) => {
            setManualReleases((currentReleases) => [
              ...currentReleases,
              release,
            ])
            setManualTracks((currentTracks) => [
              ...currentTracks,
              ...createdTracks,
            ])
          },
          onAddTrack: (track) =>
            setManualTracks((currentTracks) => [...currentTracks, track]),
          onAddOwnedItem: (item) =>
            setManualOwnedItems((currentItems) => [...currentItems, item]),
          onAddRelation: (relation) =>
            setManualRelations((currentRelations) => [
              ...currentRelations,
              relation,
            ]),
          onAddPlaylist: (playlist) =>
            setManualPlaylists((currentPlaylists) => [
              ...currentPlaylists,
              playlist,
            ]),
        },
      )}
    </AppShell>
  )
}

const manualEntryRoutes = new Set<AppRoutePath>([
  '/artists',
  '/releases',
  '/tracks',
  '/playlists',
  '/owned-items',
  '/relations',
])

function renderWorkspace(
  path: AppRoutePath,
  isManualEntryOpen: boolean,
  onManualEntryClose: () => void,
  catalogState: {
    artists: ArtistRecord[]
    locationSearch: string
    releases: ReleaseRecord[]
    tracks: TrackRecord[]
    ownedItems: OwnedItemRecord[]
    relations: RelationRecord[]
    playlists: PlaylistRecord[]
    onAddArtist: (artist: ArtistRecord) => void
    onAddRelease: (release: ReleaseRecord, tracks: TrackRecord[]) => void
    onAddTrack: (track: TrackRecord) => void
    onAddOwnedItem: (item: OwnedItemRecord) => void
    onAddRelation: (relation: RelationRecord) => void
    onAddPlaylist: (playlist: PlaylistRecord) => void
  },
) {
  switch (path) {
    case '/catalog':
      return (
        <CatalogWorkspace
          artists={catalogState.artists}
          ownedItems={catalogState.ownedItems}
          playlists={catalogState.playlists}
          relations={catalogState.relations}
          releases={catalogState.releases}
          tracks={catalogState.tracks}
        />
      )
    case '/artists':
      return (
        <ArtistsWorkspace
          artists={catalogState.artists}
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddArtist={catalogState.onAddArtist}
          onManualEntryClose={onManualEntryClose}
          ownedItems={catalogState.ownedItems}
          playlists={catalogState.playlists}
          relations={catalogState.relations}
          releases={catalogState.releases}
          tracks={catalogState.tracks}
        />
      )
    case '/releases':
      return (
        <ReleasesWorkspace
          artists={catalogState.artists}
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddRelease={catalogState.onAddRelease}
          onManualEntryClose={onManualEntryClose}
          ownedItems={catalogState.ownedItems}
          releases={catalogState.releases}
          relations={catalogState.relations}
          playlists={catalogState.playlists}
          tracks={catalogState.tracks}
        />
      )
    case '/tracks':
      return (
        <TracksWorkspace
          artists={catalogState.artists}
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddTrack={catalogState.onAddTrack}
          onManualEntryClose={onManualEntryClose}
          playlists={catalogState.playlists}
          releases={catalogState.releases}
          relations={catalogState.relations}
          tracks={catalogState.tracks}
        />
      )
    case '/playlists':
      return (
        <PlaylistsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onManualEntryClose={onManualEntryClose}
          onAddPlaylist={catalogState.onAddPlaylist}
          playlists={catalogState.playlists}
          releases={catalogState.releases}
          tracks={catalogState.tracks}
          ownedItems={catalogState.ownedItems}
          artists={catalogState.artists}
        />
      )
    case '/owned-items':
      return (
        <OwnedItemsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          items={catalogState.ownedItems}
          locationSearch={catalogState.locationSearch}
          onAddItem={catalogState.onAddOwnedItem}
          onManualEntryClose={onManualEntryClose}
          playlists={catalogState.playlists}
          releases={catalogState.releases}
          relations={catalogState.relations}
          tracks={catalogState.tracks}
        />
      )
    case '/relations':
      return (
        <RelationsWorkspace
          artists={catalogState.artists}
          isManualEntryOpen={isManualEntryOpen}
          locationSearch={catalogState.locationSearch}
          onAddRelation={catalogState.onAddRelation}
          onManualEntryClose={onManualEntryClose}
          ownedItems={catalogState.ownedItems}
          playlists={catalogState.playlists}
          relations={catalogState.relations}
          releases={catalogState.releases}
          tracks={catalogState.tracks}
        />
      )
    case '/settings':
      return <SettingsWorkspace />
    default:
      return <SectionPlaceholder route={resolveRoute(path)} />
  }
}

export default App
