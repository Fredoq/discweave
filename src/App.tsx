import './App.css'
import { useEffect, useState } from 'react'
import { AppShell } from './app/AppShell'
import { resolveRoute, type AppRoutePath } from './app/routes'
import { ArtistsWorkspace } from './features/artists/ArtistsWorkspace'
import { CatalogWorkspace } from './features/catalog/CatalogWorkspace'
import { OwnedItemsWorkspace } from './features/ownedItems/OwnedItemsWorkspace'
import { PlaylistsWorkspace } from './features/playlists/PlaylistsWorkspace'
import { ReleasesWorkspace } from './features/releases/ReleasesWorkspace'
import { RelationsWorkspace } from './features/relations/RelationsWorkspace'
import { SectionPlaceholder } from './features/sections/SectionPlaceholder'
import { SettingsWorkspace } from './features/settings/SettingsWorkspace'
import { TracksWorkspace } from './features/tracks/TracksWorkspace'

function App() {
  const [activeRoute, setActiveRoute] = useState(() =>
    resolveRoute(window.location.pathname),
  )
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [manualEntryOpen, setManualEntryOpen] = useState<
    Partial<Record<AppRoutePath, boolean>>
  >({})

  useEffect(() => {
    const handlePopState = () => {
      setActiveRoute(resolveRoute(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (path: AppRoutePath) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }

    setActiveRoute(resolveRoute(path))
    setActionStatus(null)
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
) {
  switch (path) {
    case '/catalog':
      return <CatalogWorkspace />
    case '/artists':
      return (
        <ArtistsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          onManualEntryClose={onManualEntryClose}
        />
      )
    case '/releases':
      return (
        <ReleasesWorkspace
          isManualEntryOpen={isManualEntryOpen}
          onManualEntryClose={onManualEntryClose}
        />
      )
    case '/tracks':
      return (
        <TracksWorkspace
          isManualEntryOpen={isManualEntryOpen}
          onManualEntryClose={onManualEntryClose}
        />
      )
    case '/playlists':
      return (
        <PlaylistsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          onManualEntryClose={onManualEntryClose}
        />
      )
    case '/owned-items':
      return (
        <OwnedItemsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          onManualEntryClose={onManualEntryClose}
        />
      )
    case '/relations':
      return (
        <RelationsWorkspace
          isManualEntryOpen={isManualEntryOpen}
          onManualEntryClose={onManualEntryClose}
        />
      )
    case '/settings':
      return <SettingsWorkspace />
    default:
      return <SectionPlaceholder route={resolveRoute(path)} />
  }
}

export default App
