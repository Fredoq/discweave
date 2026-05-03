import './App.css'
import { useEffect, useState } from 'react'
import { AppShell } from './app/AppShell'
import { resolveRoute, type AppRoutePath } from './app/routes'
import { ArtistsWorkspace } from './features/artists/ArtistsWorkspace'
import { CatalogWorkspace } from './features/catalog/CatalogWorkspace'
import { OwnedItemsWorkspace } from './features/ownedItems/OwnedItemsWorkspace'
import { ReleasesWorkspace } from './features/releases/ReleasesWorkspace'
import { RelationsWorkspace } from './features/relations/RelationsWorkspace'
import { SectionPlaceholder } from './features/sections/SectionPlaceholder'
import { TracksWorkspace } from './features/tracks/TracksWorkspace'

function App() {
  const [activeRoute, setActiveRoute] = useState(() =>
    resolveRoute(window.location.pathname),
  )
  const [actionStatus, setActionStatus] = useState<string | null>(null)

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
      {renderWorkspace(activeRoute.path)}
    </AppShell>
  )
}

function renderWorkspace(path: AppRoutePath) {
  switch (path) {
    case '/catalog':
      return <CatalogWorkspace />
    case '/artists':
      return <ArtistsWorkspace />
    case '/releases':
      return <ReleasesWorkspace />
    case '/tracks':
      return <TracksWorkspace />
    case '/owned-items':
      return <OwnedItemsWorkspace />
    case '/relations':
      return <RelationsWorkspace />
    default:
      return <SectionPlaceholder route={resolveRoute(path)} />
  }
}

export default App
