import './App.css'
import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react'
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
import {
  bootstrapAdmin,
  getInitialSessionState,
  getSession,
  signIn,
  signOut,
  type AuthErrorCode,
  type AuthSession,
} from './features/auth/authApi'

function AuthenticatedApp({
  sessionEmail,
  sessionRole,
  sessionError,
  onLogout,
  logoutPending,
}: {
  sessionEmail: string
  sessionRole: string
  sessionError: string | null
  onLogout: () => void
  logoutPending: boolean
}) {
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

  const handleDeleteArtist = (artistId: string) => {
    if (!manualArtists.some((record) => record.id === artistId)) {
      return
    }

    setManualArtists((currentArtists) =>
      currentArtists.filter((artist) => artist.id !== artistId),
    )
    setManualReleases((currentReleases) =>
      currentReleases.map((release) =>
        release.artistId === artistId
          ? { ...release, artistId: undefined }
          : release,
      ),
    )
    setManualTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.artistId === artistId ? { ...track, artistId: undefined } : track,
      ),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        clearRelationLink(relation, { kind: 'artist', id: artistId }),
      ),
    )
  }

  const handleDeleteRelease = (releaseId: string) => {
    if (!manualReleases.some((record) => record.id === releaseId)) {
      return
    }

    setManualReleases((currentReleases) =>
      currentReleases.filter((release) => release.id !== releaseId),
    )
    setManualTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.release.id === releaseId
          ? { ...track, release: { ...track.release, id: undefined } }
          : track,
      ),
    )
    setManualOwnedItems((currentItems) =>
      currentItems.map((item) =>
        item.releaseId === releaseId ? { ...item, releaseId: undefined } : item,
      ),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        clearRelationLink(relation, { kind: 'release', id: releaseId }),
      ),
    )
    setManualPlaylists((currentPlaylists) =>
      currentPlaylists.map((playlist) => ({
        ...playlist,
        linkedReleases: playlist.linkedReleases.filter(
          (release) => release.releaseId !== releaseId,
        ),
        tracks: playlist.tracks.map((track) =>
          track.release.id === releaseId
            ? { ...track, release: { ...track.release, id: '' } }
            : track,
        ),
      })),
    )
  }

  const handleDeleteTrack = (trackId: string) => {
    if (!manualTracks.some((record) => record.id === trackId)) {
      return
    }

    setManualTracks((currentTracks) =>
      currentTracks.filter((track) => track.id !== trackId),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        clearRelationLink(relation, { kind: 'track', id: trackId }),
      ),
    )
    setManualPlaylists((currentPlaylists) =>
      currentPlaylists.map((playlist) => ({
        ...playlist,
        tracks: playlist.tracks.filter((track) => track.id !== trackId),
      })),
    )
  }

  const handleDeleteOwnedItem = (itemId: string) => {
    if (!manualOwnedItems.some((record) => record.id === itemId)) {
      return
    }

    setManualOwnedItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        clearRelationLink(relation, { kind: 'ownedItem', id: itemId }),
      ),
    )
  }

  const handleDeleteRelation = (relationId: string) => {
    if (!manualRelations.some((record) => record.id === relationId)) {
      return
    }

    setManualRelations((currentRelations) =>
      currentRelations
        .map((relation) =>
          relation.id === relationId
            ? relation
            : clearRelationLink(relation, { kind: 'relation', id: relationId }),
        )
        .filter((relation) => relation.id !== relationId),
    )
  }

  const handleDeletePlaylist = (playlistId: string) => {
    if (!manualPlaylists.some((record) => record.id === playlistId)) {
      return
    }

    setManualPlaylists((currentPlaylists) =>
      currentPlaylists.filter((playlist) => playlist.id !== playlistId),
    )
    setManualRelations((currentRelations) =>
      currentRelations.map((relation) =>
        clearRelationLink(relation, { kind: 'playlist', id: playlistId }),
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
      logoutPending={logoutPending}
      onLogout={onLogout}
      sessionError={sessionError}
      session={{ email: sessionEmail, role: sessionRole }}
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
          onDeleteArtist: handleDeleteArtist,
          onDeleteRelease: handleDeleteRelease,
          onDeleteTrack: handleDeleteTrack,
          onDeleteOwnedItem: handleDeleteOwnedItem,
          onDeleteRelation: handleDeleteRelation,
          onDeletePlaylist: handleDeletePlaylist,
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

function clearRelationLink(
  relation: RelationRecord,
  link: CatalogLink,
): RelationRecord {
  const sourceMatches = linkMatches(relation.sourceLink, link)
  const targetMatches = linkMatches(relation.targetLink, link)
  const linkedEntityMatches = linkMatches(relation.linkedEntityLink, link)

  return {
    ...relation,
    sourceLink: sourceMatches ? undefined : relation.sourceLink,
    sourceType: sourceMatches ? 'Manual source' : relation.sourceType,
    targetLink: targetMatches ? undefined : relation.targetLink,
    targetType: targetMatches ? 'Manual target' : relation.targetType,
    linkedEntityLink: linkedEntityMatches
      ? undefined
      : relation.linkedEntityLink,
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
    onDeleteArtist: (artistId: string) => void
    onDeleteRelease: (releaseId: string) => void
    onDeleteTrack: (trackId: string) => void
    onDeleteOwnedItem: (itemId: string) => void
    onDeleteRelation: (relationId: string) => void
    onDeletePlaylist: (playlistId: string) => void
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
          onDeleteArtist={catalogState.onDeleteArtist}
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
          onDeleteRelease={catalogState.onDeleteRelease}
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
          onDeleteTrack={catalogState.onDeleteTrack}
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
          onDeletePlaylist={catalogState.onDeletePlaylist}
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
          onDeleteItem={catalogState.onDeleteOwnedItem}
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
          onDeleteRelation={catalogState.onDeleteRelation}
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

function App() {
  const [initialAuthRenderState] = useState(getInitialAuthRenderState)
  const [sessionState, setSessionState] = useState<
    'loading' | 'signed_out' | 'bootstrap' | 'authenticated'
  >(initialAuthRenderState.sessionState)
  const [session, setSession] = useState<AuthSession | null>(
    initialAuthRenderState.session,
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)

  useLayoutEffect(() => {
    if (initialAuthRenderState.sessionState !== 'loading') {
      return
    }

    void getSession()
      .then((state) => {
        if (state.status === 'authenticated') {
          setSession(state.session)
          setSessionState('authenticated')
          return
        }
        if (state.status === 'bootstrap_required') {
          setSessionState('bootstrap')
          return
        }
        if (state.reason === 'session_expired') {
          setError(mapAuthError('SESSION_EXPIRED'))
        }
        setSessionState('signed_out')
      })
      .catch(() => {
        setSessionState('signed_out')
      })
  }, [initialAuthRenderState.sessionState])

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = readFormField(form, 'email').trim()
    const password = readFormField(form, 'password')
    if (!email.includes('@') || password.length < 1) {
      setError('Enter a valid email and password.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await signIn(email, password)
      if (!result.ok) {
        setError(mapAuthError(result.code))
        return
      }
      setSession(result.session)
      setSessionState('authenticated')
    } catch {
      setError('Server unavailable. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function handleBootstrapSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = readFormField(form, 'email').trim()
    const password = readFormField(form, 'password')
    const confirmPassword = readFormField(form, 'confirmPassword')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await bootstrapAdmin(email, password)
      if (!result.ok) {
        setError(mapAuthError(result.code))
        return
      }
      setSession(result.session)
      setSessionState('authenticated')
    } catch {
      setError('Server unavailable. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function handleLogout() {
    setLogoutPending(true)
    setError(null)
    try {
      const result = await signOut()
      if (!result.ok) {
        setError('Log out failed. Try again.')
        return
      }
      setSession(null)
      setSessionState('signed_out')
    } catch {
      setError('Log out failed. Try again.')
    } finally {
      setLogoutPending(false)
    }
  }

  if (sessionState === 'loading')
    return (
      <main className="auth-screen">
        <p role="status">Checking session…</p>
      </main>
    )
  if (sessionState === 'bootstrap')
    return (
      <AuthForm
        mode="bootstrap"
        pending={pending}
        error={error}
        onSubmit={(event) => {
          void handleBootstrapSubmit(event)
        }}
      />
    )
  if (sessionState === 'signed_out' || !session)
    return (
      <AuthForm
        mode="signin"
        pending={pending}
        error={error}
        onSubmit={(event) => {
          void handleLoginSubmit(event)
        }}
      />
    )

  return (
    <AuthenticatedApp
      sessionEmail={session.email}
      sessionRole={session.role}
      onLogout={() => {
        void handleLogout()
      }}
      logoutPending={logoutPending}
      sessionError={error}
    />
  )
}

function getInitialAuthRenderState(): {
  sessionState: 'loading' | 'signed_out' | 'bootstrap' | 'authenticated'
  session: AuthSession | null
} {
  const state = getInitialSessionState()
  if (!state) {
    return { sessionState: 'loading', session: null }
  }

  if (state.status === 'authenticated') {
    return { sessionState: 'authenticated', session: state.session }
  }
  if (state.status === 'bootstrap_required') {
    return { sessionState: 'bootstrap', session: null }
  }

  return { sessionState: 'signed_out', session: null }
}

function readFormField(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

function mapAuthError(code: AuthErrorCode) {
  const map: Record<AuthErrorCode, string> = {
    INVALID_CREDENTIALS: 'Email or password is incorrect.',
    DISABLED_ACCOUNT: 'This account is disabled.',
    NETWORK_UNAVAILABLE: 'Server unavailable. Check connection and retry.',
    TOO_MANY_ATTEMPTS: 'Too many attempts. Try again shortly.',
    SESSION_EXPIRED: 'Session expired. Sign in again.',
    SERVER_ERROR: 'Server unavailable. Try again.',
    PASSWORD_WEAK: 'Password must be at least 10 characters.',
    BOOTSTRAP_UNAVAILABLE: 'Bootstrap setup is not available.',
  }
  return map[code]
}

function AuthForm({
  mode,
  pending,
  error,
  onSubmit,
}: {
  mode: 'signin' | 'bootstrap'
  pending: boolean
  error: string | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <h1>Cratebase</h1>
        <p className="auth-tagline">Personal music archive.</p>
        {mode === 'bootstrap' ? (
          <p>Create the first local admin and default collection.</p>
        ) : null}
        <form
          onSubmit={onSubmit}
          aria-label={mode === 'bootstrap' ? 'Bootstrap setup' : 'Sign in'}
        >
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === 'bootstrap' ? 'new-password' : 'current-password'
              }
              required
            />
          </label>
          {mode === 'bootstrap' ? (
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="auth-error">
              {error}
            </p>
          ) : null}
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
          >
            {pending
              ? 'Working…'
              : mode === 'bootstrap'
                ? 'Create admin'
                : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default App
