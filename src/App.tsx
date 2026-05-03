import './App.css'
import { useEffect, useState } from 'react'
import { AppShell } from './app/AppShell'
import { resolveRoute, type AppRoutePath } from './app/routes'
import { CatalogWorkspace } from './features/catalog/CatalogWorkspace'
import { SectionPlaceholder } from './features/sections/SectionPlaceholder'

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
      {activeRoute.path === '/catalog' ? (
        <CatalogWorkspace />
      ) : (
        <SectionPlaceholder route={activeRoute} />
      )}
    </AppShell>
  )
}

export default App
