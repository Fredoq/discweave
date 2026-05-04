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
import type { CatalogLink } from './features/catalog/catalogLinks'
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

  const handleUpdateArtist = (artist: ArtistRecord) => {
    const previousArtist = manualArtists.find(
      (record) => record.id === artist.id,
    )

    if (!previousArtist) {
      return
    }

    const linkedReleaseIds = releases
      .filter((release) => release.artistId === artist.id)
      .map((release) => release.id)

    setManualArtists((currentArtists) =>
      currentArtists.map((currentArtist) =>
        currentArtist.id === artist.id ? artist : currentArtist,
      ),
    )
    setManualReleases((currentReleases) =>
      currentReleases.map((release) =>
        release.artistId === artist.id
          ? { ...release, artist: artist.name }
          : release,
      ),
    )
    setManualTracks((currentTracks) =>
      currentTracks.map((track) => {
        const releaseArtist =
          track.release.id && linkedReleaseIds.includes(track.release.id)
            ? artist.name
            : track.release.artist

        return {
          ...track,
          artist: track.artistId === artist.id ? artist.name : track.artist,
          release: { ...track.release, artist: releaseArtist },
        }
      }),
    )
    setManualOwnedItems((currentItems) =>
      currentItems.map((item) =>
        item.releaseId && linkedReleaseIds.includes(item.releaseId)
          ? { ...item, artist: artist.name }
          : item,
      ),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        updateRelationLinkText(
          relation,
          { kind: 'artist', id: artist.id },
          artist.name,
        ),
      ),
    )
    setManualPlaylists((currentPlaylists) =>
      currentPlaylists.map((playlist) => ({
        ...playlist,
        linkedReleases: playlist.linkedReleases.map((release) =>
          linkedReleaseIds.includes(release.releaseId)
            ? { ...release, artist: artist.name }
            : release,
        ),
        tracks: playlist.tracks.map((track) => ({
          ...track,
          artist:
            track.artist === previousArtist.name ? artist.name : track.artist,
          release:
            track.release.id && linkedReleaseIds.includes(track.release.id)
              ? { ...track.release, artist: artist.name }
              : track.release,
        })),
      })),
    )
  }

  const handleUpdateRelease = (release: ReleaseRecord) => {
    if (!manualReleases.some((record) => record.id === release.id)) {
      return
    }

    setManualReleases((currentReleases) =>
      currentReleases.map((currentRelease) =>
        currentRelease.id === release.id ? release : currentRelease,
      ),
    )
    setManualTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.release.id === release.id
          ? {
              ...track,
              release: {
                id: release.id,
                title: release.title,
                artist: release.artist,
                year: release.year,
                label: release.label,
              },
            }
          : track,
      ),
    )
    setManualOwnedItems((currentItems) =>
      currentItems.map((item) =>
        item.releaseId === release.id
          ? { ...item, releaseTitle: release.title, artist: release.artist }
          : item,
      ),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        updateRelationLinkText(
          relation,
          { kind: 'release', id: release.id },
          release.title,
        ),
      ),
    )
    setManualPlaylists((currentPlaylists) =>
      currentPlaylists.map((playlist) => ({
        ...playlist,
        linkedReleases: playlist.linkedReleases.map((linkedRelease) =>
          linkedRelease.releaseId === release.id
            ? {
                ...linkedRelease,
                title: release.title,
                artist: release.artist,
                year: release.year,
              }
            : linkedRelease,
        ),
        tracks: playlist.tracks.map((track) =>
          track.release.id === release.id
            ? {
                ...track,
                release: {
                  ...track.release,
                  title: release.title,
                  artist: release.artist,
                  year: release.year,
                  label: release.label,
                },
              }
            : track,
        ),
      })),
    )
  }

  const handleUpdateTrack = (track: TrackRecord) => {
    if (!manualTracks.some((record) => record.id === track.id)) {
      return
    }

    setManualTracks((currentTracks) =>
      currentTracks.map((currentTrack) =>
        currentTrack.id === track.id ? track : currentTrack,
      ),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        updateRelationLinkText(
          relation,
          { kind: 'track', id: track.id },
          track.title,
        ),
      ),
    )
    setManualPlaylists((currentPlaylists) =>
      currentPlaylists.map((playlist) => ({
        ...playlist,
        tracks: playlist.tracks.map((playlistTrack) =>
          playlistTrack.id === track.id
            ? {
                ...playlistTrack,
                title: track.title,
                artist: track.artist,
                release: {
                  id: track.release.id ?? '',
                  title: track.release.title,
                  artist: track.release.artist,
                  year: track.release.year,
                  label: track.release.label,
                },
                trackNumber: track.trackNumber,
                duration: track.duration,
                tags: track.tags,
                fileFormat: track.fileMetadata.format,
              }
            : playlistTrack,
        ),
      })),
    )
  }

  const handleUpdateOwnedItem = (item: OwnedItemRecord) => {
    if (!manualOwnedItems.some((record) => record.id === item.id)) {
      return
    }

    setManualOwnedItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id ? item : currentItem,
      ),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        updateRelationLinkText(
          relation,
          { kind: 'ownedItem', id: item.id },
          item.title,
        ),
      ),
    )
  }

  const handleUpdateRelation = (relation: RelationRecord) => {
    if (!manualRelations.some((record) => record.id === relation.id)) {
      return
    }

    setManualRelations((currentRelations) =>
      currentRelations.map((currentRelation) =>
        currentRelation.id === relation.id ? relation : currentRelation,
      ),
    )
  }

  const handleUpdatePlaylist = (playlist: PlaylistRecord) => {
    if (!manualPlaylists.some((record) => record.id === playlist.id)) {
      return
    }

    setManualPlaylists((currentPlaylists) =>
      currentPlaylists.map((currentPlaylist) =>
        currentPlaylist.id === playlist.id ? playlist : currentPlaylist,
      ),
    )
  }

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
          onUpdateArtist: handleUpdateArtist,
          onUpdateRelease: handleUpdateRelease,
          onUpdateTrack: handleUpdateTrack,
          onUpdateOwnedItem: handleUpdateOwnedItem,
          onUpdateRelation: handleUpdateRelation,
          onUpdatePlaylist: handleUpdatePlaylist,
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

function updateRelationLinkText(
  relation: RelationRecord,
  link: CatalogLink,
  name: string,
): RelationRecord {
  return {
    ...relation,
    source: linkMatches(relation.sourceLink, link) ? name : relation.source,
    target: linkMatches(relation.targetLink, link) ? name : relation.target,
    linkedEntity: linkMatches(relation.linkedEntityLink, link)
      ? name
      : relation.linkedEntity,
    searchHints: relation.searchHints.map((hint) =>
      linkMatches(relation.linkedEntityLink, link) &&
      hint === relation.linkedEntity
        ? name
        : hint,
    ),
  }
}

function linkMatches(left: CatalogLink | undefined, right: CatalogLink) {
  return left?.kind === right.kind && left.id === right.id
}

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
    onUpdateArtist: (artist: ArtistRecord) => void
    onUpdateRelease: (release: ReleaseRecord) => void
    onUpdateTrack: (track: TrackRecord) => void
    onUpdateOwnedItem: (item: OwnedItemRecord) => void
    onUpdateRelation: (relation: RelationRecord) => void
    onUpdatePlaylist: (playlist: PlaylistRecord) => void
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
          onUpdateArtist={catalogState.onUpdateArtist}
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
          onUpdateRelease={catalogState.onUpdateRelease}
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
          onUpdateTrack={catalogState.onUpdateTrack}
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
          onUpdatePlaylist={catalogState.onUpdatePlaylist}
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
          onUpdateItem={catalogState.onUpdateOwnedItem}
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
          onUpdateRelation={catalogState.onUpdateRelation}
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
