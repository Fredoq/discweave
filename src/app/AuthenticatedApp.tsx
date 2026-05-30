import { useEffect, useRef, useState } from 'react'
import { AppShell } from './AppShell'
import {
  CatalogErrorPanel,
  CatalogStatusPanel,
  CatalogSyncErrorNotice,
} from './AuthenticatedAppPanels'
import { catalogErrorMessage } from './catalogErrorMessage'
import { isAppRoutePath, resolveRoute, type AppRoutePath } from './routes'
import {
  CatalogApiError,
  createArtist,
  createDictionaryEntry,
  createLabel,
  createOwnedItem,
  createPlaylist,
  createRatingCriterion,
  createRelation,
  createRelease,
  createTrack,
  defaultCatalogDictionaries,
  deleteArtist,
  deleteDictionaryEntry,
  deleteLabel,
  deleteOwnedItem,
  deletePlaylist,
  deleteRating,
  deleteRatingCriterion,
  deleteRelation,
  deleteRelease,
  deleteTrack,
  emptyCatalogState,
  getInitialCatalogStateForTests,
  loadCatalog,
  replaceDictionaryEntry,
  removeReleaseCover,
  updateArtist,
  updateDictionaryEntry,
  updateLabel,
  updateOwnedItem,
  updatePlaylist,
  updateRatingCriterion,
  updateRelation,
  updateRelease,
  updateTrack,
  uploadReleaseCover,
  upsertRating,
  type CatalogState,
} from '../features/catalog/catalogApi'
import { manualEntryRoutes, renderWorkspace } from './renderWorkspace'

export function AuthenticatedApp({
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
  const [isCatalogAddEntryOpen, setCatalogAddEntryOpen] = useState(false)
  const [catalogSearchRefreshKey, setCatalogSearchRefreshKey] = useState(0)
  const [manualEntryOpen, setManualEntryOpen] = useState<
    Partial<Record<AppRoutePath, boolean>>
  >({})
  const [initialCatalogState] = useState(getInitialCatalogStateForTests)
  const [hasLoadedFullCatalog, setHasLoadedFullCatalog] = useState(
    Boolean(initialCatalogState),
  )
  const [catalog, setCatalog] = useState<CatalogState>(
    initialCatalogState ?? emptyCatalogState,
  )
  const [catalogStatus, setCatalogStatus] = useState<
    'loading' | 'ready' | 'error'
  >(
    initialCatalogState || !routeRequiresFullCatalog(activeRoute.path)
      ? 'ready'
      : 'loading',
  )
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
      setHasLoadedFullCatalog(true)
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
    if (
      initialCatalogState ||
      hasLoadedFullCatalog ||
      !routeRequiresFullCatalog(activeRoute.path)
    ) {
      return
    }

    let isCurrent = true
    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setCatalogStatus('loading')
      setCatalogError(null)
    })

    void loadCatalog()
      .then((loadedCatalog) => {
        if (!isCurrent) {
          return
        }

        setCatalog(loadedCatalog)
        setHasLoadedFullCatalog(true)
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
  }, [activeRoute.path, hasLoadedFullCatalog, initialCatalogState])

  async function runCatalogMutation(
    mutation: () => Promise<void>,
    successMessage: string,
  ) {
    setActionStatus(null)
    setCatalogError(null)

    if (initialCatalogState) {
      try {
        await mutation()
        setCatalog(getInitialCatalogStateForTests() ?? emptyCatalogState)
        setCatalogSearchRefreshKey((key) => key + 1)
        setCatalogStatus('ready')
        setActionStatus(successMessage)
      } catch (error) {
        setCatalogStatus('error')
        setCatalogError(catalogErrorMessage(error))
      }

      return
    }

    try {
      await mutation()
      const shouldRefreshFullCatalog =
        hasLoadedFullCatalog || routeRequiresFullCatalog(activeRoute.path)

      if (shouldRefreshFullCatalog) {
        const refreshed = await refreshCatalog({ preserveCurrentCatalog: true })
        if (refreshed) {
          setCatalogSearchRefreshKey((key) => key + 1)
          setActionStatus(successMessage)
        }
      } else {
        setCatalogSearchRefreshKey((key) => key + 1)
        setCatalogStatus('ready')
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
      setCatalogAddEntryOpen(false)
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('discweave:navigation', handleLocationChange)

    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('discweave:navigation', handleLocationChange)
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
    setCatalogAddEntryOpen(false)

    return true
  }

  const navigate = (path: AppRoutePath) => {
    navigateToUrl(path)
  }

  const handleRouteAction = () => {
    if (!activeRoute.actionLabel) {
      return
    }

    if (activeRoute.path === '/catalog') {
      setActionStatus(null)
      setCatalogAddEntryOpen(true)
      if (!initialCatalogState && !hasLoadedFullCatalog) {
        setCatalogStatus('loading')
        void refreshCatalog({ preserveCurrentCatalog: true })
      }
      return
    }

    if (manualEntryRoutes.has(activeRoute.path)) {
      setActionStatus(null)
      if (
        activeRoute.path !== '/artists' &&
        !initialCatalogState &&
        !hasLoadedFullCatalog
      ) {
        setActionStatus('Loading entry data…')
        void refreshCatalog({ preserveCurrentCatalog: true }).then((loaded) => {
          if (!loaded) {
            setActionStatus('Entry data could not be loaded.')
            return
          }

          setActionStatus(null)
          setManualEntryOpen((openForms) => ({
            ...openForms,
            [activeRoute.path]: true,
          }))
        })
        return
      }

      setManualEntryOpen((openForms) => ({
        ...openForms,
        [activeRoute.path]: true,
      }))
      return
    }

    setActionStatus(`${activeRoute.actionLabel} is not available yet.`)
  }

  const fullCatalogRequired = routeRequiresFullCatalog(activeRoute.path)
  const fullCatalogPending =
    fullCatalogRequired && !initialCatalogState && !hasLoadedFullCatalog
  const catalogAddEntryPanel =
    isCatalogAddEntryOpen && !hasLoadedFullCatalog && !initialCatalogState ? (
      catalogStatus === 'loading' ? (
        <CatalogStatusPanel message="Loading entry data…" />
      ) : catalogError ? (
        <CatalogErrorPanel
          message={catalogError}
          onRetry={() => {
            setCatalogStatus('loading')
            void refreshCatalog({ preserveCurrentCatalog: true })
          }}
        />
      ) : null
    ) : undefined

  const workspace =
    fullCatalogRequired && catalogStatus === 'error' ? (
      <CatalogErrorPanel
        message={catalogError ?? 'Catalog data could not be loaded.'}
        onRetry={() => {
          void refreshCatalog()
        }}
      />
    ) : fullCatalogPending ||
      (fullCatalogRequired && catalogStatus === 'loading') ? (
      <CatalogStatusPanel message="Loading catalog…" />
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
          isCatalogAddEntryOpen,
          () =>
            setManualEntryOpen((openForms) => ({
              ...openForms,
              [activeRoute.path]: false,
            })),
          () => setCatalogAddEntryOpen(false),
          {
            locationSearch,
            artists: catalog.artists,
            catalogAddEntryPanel,
            labels: catalog.labels ?? [],
            searchRefreshKey: catalogSearchRefreshKey,
            releases: catalog.releases,
            tracks: catalog.tracks,
            ownedItems: catalog.ownedItems,
            relations: catalog.relations,
            playlists: catalog.playlists,
            serverBackedCatalog: !initialCatalogState,
            hasLoadedFullCatalog,
            dictionaries: catalog.dictionaries ?? defaultCatalogDictionaries,
            ratingCriteria: catalog.ratingCriteria ?? [],
            ratings: catalog.ratings ?? [],
            onAddArtist: (artist) => {
              void runCatalogMutation(
                () => createArtist(artist),
                'Artist saved.',
              )
            },
            onAddLabel: (label) => {
              void runCatalogMutation(() => createLabel(label), 'Label saved.')
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
            onAddPlaylist: (playlist) => {
              void runCatalogMutation(async () => {
                await createPlaylist(playlist)
              }, 'Playlist saved.')
            },
            onUpdateArtist: (artist) => {
              void runCatalogMutation(
                () => updateArtist(artist),
                'Artist saved.',
              )
            },
            onUpdateLabel: (label) => {
              void runCatalogMutation(() => updateLabel(label), 'Label saved.')
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
            onUpdatePlaylist: (playlist) => {
              void runCatalogMutation(async () => {
                await updatePlaylist(playlist)
              }, 'Playlist saved.')
            },
            onDeleteArtist: (artistId) => {
              void runCatalogMutation(
                () => deleteArtist(artistId),
                'Artist deleted.',
              )
            },
            onDeleteLabel: (labelId) => {
              void runCatalogMutation(
                () => deleteLabel(labelId),
                'Label deleted.',
              )
            },
            onDeleteRelease: (releaseId) => {
              void runCatalogMutation(
                () => deleteRelease(releaseId),
                'Release deleted.',
              )
            },
            onRemoveReleaseCover: (releaseId) => {
              return runCatalogMutation(
                () => removeReleaseCover(releaseId),
                'Release cover removed.',
              )
            },
            onUploadReleaseCover: (releaseId, file) => {
              return runCatalogMutation(
                () => uploadReleaseCover(releaseId, file),
                'Release cover saved.',
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
            onDeletePlaylist: (playlistId) => {
              void runCatalogMutation(
                () => deletePlaylist(playlistId),
                'Playlist deleted.',
              )
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
            onCatalogChanged: () => {
              if (hasLoadedFullCatalog) {
                void refreshCatalog({ preserveCurrentCatalog: true })
              } else {
                setCatalogSearchRefreshKey((key) => key + 1)
              }
            },
            onSessionExpired: onLogout,
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

const fullCatalogRoutes = new Set<AppRoutePath>()

function routeRequiresFullCatalog(path: AppRoutePath) {
  return fullCatalogRoutes.has(path)
}
