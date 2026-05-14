import './App.css'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { AppShell } from './app/AppShell'
import { isAppRoutePath, resolveRoute, type AppRoutePath } from './app/routes'
import { ArtistsWorkspace } from './features/artists/ArtistsWorkspace'
import type { ArtistRecord } from './features/artists/artistsData'
import { CatalogWorkspace } from './features/catalog/CatalogWorkspace'
import {
  CatalogApiError,
  createDictionaryEntry,
  createRatingCriterion,
  createArtist,
  createOwnedItem,
  createRelation,
  createRelease,
  createTrack,
  defaultCatalogDictionaries,
  deleteArtist,
  deleteDictionaryEntry,
  deleteRating,
  deleteRatingCriterion,
  deleteOwnedItem,
  deleteRelation,
  deleteRelease,
  deleteTrack,
  emptyCatalogState,
  getInitialCatalogStateForTests,
  loadCatalog,
  replaceDictionaryEntry,
  upsertRating,
  updateDictionaryEntry,
  updateRatingCriterion,
  updateArtist,
  updateOwnedItem,
  updateRelation,
  updateRelease,
  updateTrack,
  type CatalogState,
  type DictionaryEntry,
  type DictionaryEntryRequest,
  type DictionaryEntryUpdateRequest,
  type RatingCriterion,
  type RatingCriterionRequest,
  type RatingCriterionUpdateRequest,
  type RatingTargetType,
} from './features/catalog/catalogApi'
import { OwnedItemsWorkspace } from './features/ownedItems/OwnedItemsWorkspace'
import type { OwnedItemRecord } from './features/ownedItems/ownedItemsData'
import { PlaylistsWorkspace } from './features/playlists/PlaylistsWorkspace'
import type { PlaylistRecord } from './features/playlists/playlistsData'
import { ReleasesWorkspace } from './features/releases/ReleasesWorkspace'
import type { ReleaseRecord } from './features/releases/releasesData'
import { RelationsWorkspace } from './features/relations/RelationsWorkspace'
import type { RelationRecord } from './features/relations/relationsData'
import { SectionPlaceholder } from './features/sections/SectionPlaceholder'
import { SettingsWorkspace } from './features/settings/SettingsWorkspace'
import { TracksWorkspace } from './features/tracks/TracksWorkspace'
import type { TrackRecord } from './features/tracks/tracksData'
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
  const [initialCatalogState] = useState(getInitialCatalogStateForTests)
  const [catalog, setCatalog] = useState<CatalogState>(
    initialCatalogState ?? emptyCatalogState,
  )
  const [catalogStatus, setCatalogStatus] = useState<
    'loading' | 'ready' | 'error'
  >(initialCatalogState ? 'ready' : 'loading')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const onLogoutRef = useRef(onLogout)

  useEffect(() => {
    onLogoutRef.current = onLogout
  }, [onLogout])

  async function refreshCatalog({
    preserveCurrentCatalog = false,
  }: { preserveCurrentCatalog?: boolean } = {}) {
    if (!initialCatalogState && !preserveCurrentCatalog) {
      setCatalogStatus('loading')
    }
    setCatalogError(null)

    try {
      setCatalog(await loadCatalog())
      setCatalogStatus('ready')
      return true
    } catch (error) {
      if (error instanceof CatalogApiError && error.status === 401) {
        onLogout()
        return false
      }

      setCatalogStatus(preserveCurrentCatalog ? 'ready' : 'error')
      setCatalogError(catalogErrorMessage(error))
      return false
    }
  }

  useEffect(() => {
    if (initialCatalogState) {
      return
    }

    let isCurrent = true

    void loadCatalog()
      .then((loadedCatalog) => {
        if (!isCurrent) {
          return
        }

        setCatalog(loadedCatalog)
        setCatalogStatus('ready')
      })
      .catch((error) => {
        if (!isCurrent) {
          return
        }

        if (error instanceof CatalogApiError && error.status === 401) {
          onLogoutRef.current()
          return
        }

        setCatalogStatus('error')
        setCatalogError(catalogErrorMessage(error))
      })

    return () => {
      isCurrent = false
    }
  }, [initialCatalogState])

  async function runCatalogMutation(
    mutation: () => Promise<void>,
    successMessage: string,
  ) {
    setActionStatus(null)
    setCatalogError(null)

    if (initialCatalogState) {
      try {
        const mutationResult = mutation()
        setCatalog(getInitialCatalogStateForTests() ?? emptyCatalogState)
        setActionStatus(successMessage)
        await mutationResult
      } catch (error) {
        setCatalogStatus('error')
        setCatalogError(catalogErrorMessage(error))
      }

      return
    }

    try {
      await mutation()
      const refreshed = await refreshCatalog({ preserveCurrentCatalog: true })
      if (refreshed) {
        setActionStatus(successMessage)
      }
    } catch (error) {
      if (error instanceof CatalogApiError && error.status === 401) {
        onLogout()
        return
      }

      setCatalogStatus('ready')
      setCatalogError(catalogErrorMessage(error))
    }
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

    setActionStatus(`${activeRoute.actionLabel} is not available yet.`)
  }

  const workspace =
    catalogStatus === 'loading' ? (
      <CatalogStatusPanel message="Loading catalog…" />
    ) : catalogStatus === 'error' ? (
      <CatalogErrorPanel
        message={catalogError ?? 'Catalog data could not be loaded.'}
        onRetry={() => {
          void refreshCatalog()
        }}
      />
    ) : (
      <>
        {catalogError ? (
          <CatalogSyncErrorNotice
            message={catalogError}
            onRetry={() => {
              void refreshCatalog()
            }}
          />
        ) : null}
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
            artists: catalog.artists,
            releases: catalog.releases,
            tracks: catalog.tracks,
            ownedItems: catalog.ownedItems,
            relations: catalog.relations,
            playlists: catalog.playlists,
            dictionaries: catalog.dictionaries ?? defaultCatalogDictionaries,
            ratingCriteria: catalog.ratingCriteria ?? [],
            ratings: catalog.ratings ?? [],
            onAddArtist: (artist) => {
              void runCatalogMutation(
                () => createArtist(artist),
                'Artist saved.',
              )
            },
            onAddRelease: (release, tracks) => {
              void runCatalogMutation(
                () => createRelease(release, tracks),
                'Release saved.',
              )
            },
            onAddTrack: (track) => {
              void runCatalogMutation(() => createTrack(track), 'Track saved.')
            },
            onAddOwnedItem: (item) => {
              void runCatalogMutation(
                () => createOwnedItem(item),
                'Owned item saved.',
              )
            },
            onAddRelation: (relation) => {
              void runCatalogMutation(
                () => createRelation(relation),
                'Relation saved.',
              )
            },
            onAddPlaylist: () => {
              setActionStatus('Playlist saving is not available yet.')
            },
            onUpdateArtist: (artist) => {
              void runCatalogMutation(
                () => updateArtist(artist),
                'Artist saved.',
              )
            },
            onUpdateRelease: (release, tracks) => {
              void runCatalogMutation(
                () => updateRelease(release, tracks),
                'Release saved.',
              )
            },
            onUpdateTrack: (track) => {
              void runCatalogMutation(() => updateTrack(track), 'Track saved.')
            },
            onUpdateOwnedItem: (item) => {
              void runCatalogMutation(
                () => updateOwnedItem(item),
                'Owned item saved.',
              )
            },
            onUpdateRelation: (relation) => {
              void runCatalogMutation(
                () => updateRelation(relation),
                'Relation saved.',
              )
            },
            onUpdatePlaylist: () => {
              setActionStatus('Playlist saving is not available yet.')
            },
            onDeleteArtist: (artistId) => {
              void runCatalogMutation(
                () => deleteArtist(artistId),
                'Artist deleted.',
              )
            },
            onDeleteRelease: (releaseId) => {
              void runCatalogMutation(
                () => deleteRelease(releaseId),
                'Release deleted.',
              )
            },
            onDeleteTrack: (trackId) => {
              void runCatalogMutation(
                () => deleteTrack(trackId),
                'Track deleted.',
              )
            },
            onDeleteOwnedItem: (itemId) => {
              void runCatalogMutation(
                () => deleteOwnedItem(itemId),
                'Owned item deleted.',
              )
            },
            onDeleteRelation: (relationId) => {
              const relation = catalog.relations.find(
                (item) => item.id === relationId,
              )
              if (!relation) {
                setActionStatus('Relation could not be found for deletion.')
                return
              }

              void runCatalogMutation(
                () => deleteRelation(relation),
                'Relation deleted.',
              )
            },
            onDeletePlaylist: () => {
              setActionStatus('Playlist saving is not available yet.')
            },
            onCreateDictionaryEntry: (entry) => {
              void runCatalogMutation(
                () => createDictionaryEntry(entry),
                'Dictionary entry saved.',
              )
            },
            onUpdateDictionaryEntry: (entryId, entry) => {
              void runCatalogMutation(
                () => updateDictionaryEntry(entryId, entry),
                'Dictionary entry saved.',
              )
            },
            onDeleteDictionaryEntry: (entry) => {
              void runCatalogMutation(
                () => deleteDictionaryEntry(entry),
                'Dictionary entry deleted.',
              )
            },
            onReplaceDictionaryEntry: (entry, replacementCode) => {
              void runCatalogMutation(
                () => replaceDictionaryEntry(entry, replacementCode),
                'Dictionary entry replaced.',
              )
            },
            onCreateRatingCriterion: (criterion) => {
              void runCatalogMutation(
                () => createRatingCriterion(criterion),
                'Rating criterion saved.',
              )
            },
            onUpdateRatingCriterion: (criterionId, criterion) => {
              void runCatalogMutation(
                () => updateRatingCriterion(criterionId, criterion),
                'Rating criterion saved.',
              )
            },
            onDeleteRatingCriterion: (criterion) => {
              void runCatalogMutation(
                () => deleteRatingCriterion(criterion),
                'Rating criterion deleted.',
              )
            },
            onRateTarget: (targetType, targetId, criterionId, value) => {
              void runCatalogMutation(
                () => upsertRating(targetType, targetId, criterionId, value),
                'Rating saved.',
              )
            },
            onDeleteRating: (targetType, targetId, criterionId) => {
              void runCatalogMutation(
                () => deleteRating(targetType, targetId, criterionId),
                'Rating cleared.',
              )
            },
          },
        )}
      </>
    )

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
      {workspace}
    </AppShell>
  )
}

const manualEntryRoutes = new Set<AppRoutePath>([
  '/artists',
  '/releases',
  '/tracks',
  '/owned-items',
  '/relations',
])

function CatalogStatusPanel({ message }: { message: string }) {
  return (
    <section className="panel section-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Catalog</h2>
          <p role="status">{message}</p>
        </div>
      </div>
    </section>
  )
}

function CatalogErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <section className="panel section-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Catalog unavailable</h2>
          <p role="alert">{message}</p>
        </div>
      </div>
      <button
        className="button button-secondary"
        type="button"
        onClick={onRetry}
      >
        Retry
      </button>
    </section>
  )
}

function CatalogSyncErrorNotice({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <section className="panel section-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Catalog sync failed</h2>
          <p role="alert">{message}</p>
          <p>Showing the last loaded catalog data.</p>
        </div>
      </div>
      <button
        className="button button-secondary"
        type="button"
        onClick={onRetry}
      >
        Retry catalog sync
      </button>
    </section>
  )
}

function catalogErrorMessage(error: unknown) {
  if (error instanceof CatalogApiError) {
    if (error.status === 400 || error.status === 409) {
      return error.message
    }

    if (error.status === 401) {
      return 'Session expired. Sign in again.'
    }

    return 'Catalog request failed. Try again.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Catalog data could not be loaded.'
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
    dictionaries: NonNullable<CatalogState['dictionaries']>
    ratingCriteria: NonNullable<CatalogState['ratingCriteria']>
    ratings: NonNullable<CatalogState['ratings']>
    onAddArtist: (artist: ArtistRecord) => void
    onAddRelease: (release: ReleaseRecord, tracks: TrackRecord[]) => void
    onAddTrack: (track: TrackRecord) => void
    onAddOwnedItem: (item: OwnedItemRecord) => void
    onAddRelation: (relation: RelationRecord) => void
    onAddPlaylist: (playlist: PlaylistRecord) => void
    onUpdateArtist: (artist: ArtistRecord) => void
    onUpdateRelease: (release: ReleaseRecord, tracks?: TrackRecord[]) => void
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
          ratingCriteria={catalogState.ratingCriteria}
          onDeleteRating={catalogState.onDeleteRating}
          onRateTarget={catalogState.onRateTarget}
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
          ratingCriteria={catalogState.ratingCriteria}
          onDeleteRating={catalogState.onDeleteRating}
          onRateTarget={catalogState.onRateTarget}
          dictionaries={catalogState.dictionaries}
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
          ratingCriteria={catalogState.ratingCriteria}
          onDeleteRating={catalogState.onDeleteRating}
          onRateTarget={catalogState.onRateTarget}
          dictionaries={catalogState.dictionaries}
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
          ratings={catalogState.ratings}
          releases={catalogState.releases}
          tracks={catalogState.tracks}
          ownedItems={catalogState.ownedItems}
          artists={catalogState.artists}
          ratingCriteria={catalogState.ratingCriteria}
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
          dictionaries={catalogState.dictionaries}
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
          dictionaries={catalogState.dictionaries}
        />
      )
    case '/settings':
      return (
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
