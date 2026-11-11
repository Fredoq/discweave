import { LogOut, Plus } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { DiscWeaveLogo } from './DiscWeaveLogo'
import { appRoutes, type AppRoute, type AppRoutePath } from './routes'
import {
  folderWatchAttentionCount,
  startFolderWatch,
  useFolderWatch,
} from '../features/imports/folderWatchStore'

const toolRoutes: AppRoutePath[] = ['/owned-items', '/relations', '/exports']

type SessionSummary = {
  email: string
  role: string
}

type AppShellProps = {
  actionStatus: string | null
  activeRoute: AppRoute
  children: ReactNode
  logoutPending: boolean
  onLogout: () => void
  onNavigate: (path: AppRoutePath) => void
  onNavigateToUrl: (href: string) => boolean
  onRouteAction: () => void
  session: SessionSummary
  sessionError: string | null
}

export function AppShell({
  actionStatus,
  activeRoute,
  children,
  logoutPending,
  onLogout,
  onNavigate,
  onNavigateToUrl,
  onRouteAction,
  session,
  sessionError,
}: Readonly<AppShellProps>) {
  const shellRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    function handleShellLinkClick(event: globalThis.MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        !(event.target instanceof Element)
      ) {
        return
      }

      const link = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!link || link.target || link.hasAttribute('download')) {
        return
      }

      if (onNavigateToUrl(link.href)) {
        event.preventDefault()
      }
    }

    shell.addEventListener('click', handleShellLinkClick)
    return () => shell.removeEventListener('click', handleShellLinkClick)
  }, [onNavigateToUrl])

  return (
    <main className="app-shell" ref={shellRef}>
      <SidebarNav
        activePath={activeRoute.path}
        logoutPending={logoutPending}
        onLogout={onLogout}
        onNavigate={onNavigate}
        session={session}
        sessionError={sessionError}
      />

      <section className="workspace" aria-labelledby="workspace-title">
        <WorkspaceHeader
          actionStatus={actionStatus}
          route={activeRoute}
          onRouteAction={onRouteAction}
        />
        {children}
      </section>
    </main>
  )
}

type SidebarNavProps = {
  activePath: AppRoutePath
  logoutPending: boolean
  onLogout: () => void
  onNavigate: (path: AppRoutePath) => void
  session: SessionSummary
  sessionError: string | null
}

function SidebarNav({
  activePath,
  logoutPending,
  onLogout,
  onNavigate,
  session,
  sessionError,
}: Readonly<SidebarNavProps>) {
  const showSessionPanel = !isLocalDesktopOwnerSession(session)
  const watchedImportCount = folderWatchAttentionCount(useFolderWatch())

  const toolsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (toolRoutes.includes(activePath) && toolsRef.current) {
      toolsRef.current.open = true
    }
  }, [activePath])

  useEffect(() => {
    startFolderWatch()
  }, [])

  function renderRoute(path: AppRoutePath) {
    const item = appRoutes.find((route) => route.path === path)!
    const Icon = item.icon
    return (
      <AppLink
        key={item.path}
        href={item.path}
        ariaCurrent={item.path === activePath ? 'page' : undefined}
        onNavigate={onNavigate}
      >
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
        <span>{item.label}</span>
        {item.path === '/imports' && watchedImportCount > 0 ? (
          <span
            className="navigation-count"
            aria-label={`${watchedImportCount} watched folder updates`}
          >
            {watchedImportCount}
          </span>
        ) : null}
      </AppLink>
    )
  }

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <AppLink
        className="brand"
        href="/catalog"
        ariaLabel="DiscWeave search"
        onNavigate={onNavigate}
      >
        <span className="brand-mark" aria-hidden="true">
          <DiscWeaveLogo size={18} />
        </span>
        <span>DiscWeave</span>
      </AppLink>

      <nav className="navigation" aria-label="DiscWeave sections">
        <div className="navigation-search">{renderRoute('/catalog')}</div>
        <section
          className="navigation-group"
          aria-labelledby="library-nav-title"
        >
          <h2 id="library-nav-title">Library</h2>
          <div className="navigation-links">
            {['/releases', '/tracks', '/artists', '/labels', '/playlists'].map(
              (path) => renderRoute(path as AppRoutePath),
            )}
          </div>
        </section>
        <div className="navigation-discover">{renderRoute('/discover')}</div>
        <section
          className="navigation-group"
          aria-labelledby="organize-nav-title"
        >
          <h2 id="organize-nav-title">Organize</h2>
          <div className="navigation-links">
            {['/imports', '/review-workbench'].map((path) =>
              renderRoute(path as AppRoutePath),
            )}
          </div>
        </section>
        <details
          ref={toolsRef}
          className="navigation-tools"
          open={toolRoutes.includes(activePath)}
          data-active={toolRoutes.includes(activePath)}
        >
          <summary>Tools</summary>
          <div className="navigation-links">
            {toolRoutes.map((path) => renderRoute(path))}
          </div>
        </details>
        <div className="navigation-settings">{renderRoute('/settings')}</div>
      </nav>

      {showSessionPanel ? (
        <section className="session-panel" aria-label="Signed in user">
          <p className="session-label">Signed in</p>
          <p className="session-email">{session.email}</p>
          <p className="session-role">{session.role}</p>
          {sessionError ? (
            <p className="session-error" role="alert">
              {sessionError}
            </p>
          ) : null}
          <button
            className="button button-secondary session-logout"
            type="button"
            onClick={onLogout}
            disabled={logoutPending}
          >
            <LogOut size={14} aria-hidden="true" />
            {logoutPending ? 'Logging out…' : 'Log out'}
          </button>
        </section>
      ) : null}
    </aside>
  )
}

function isLocalDesktopOwnerSession(session: SessionSummary) {
  return session.email.toLowerCase() === 'owner@local.discweave'
}

type AppLinkProps = {
  ariaCurrent?: 'page'
  ariaLabel?: string
  children: ReactNode
  className?: string
  href: AppRoutePath
  onNavigate: (path: AppRoutePath) => void
}

function AppLink({
  ariaCurrent,
  ariaLabel,
  children,
  className,
  href,
  onNavigate,
}: Readonly<AppLinkProps>) {
  return (
    <a
      className={className}
      href={href}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.altKey ||
          event.ctrlKey ||
          event.shiftKey
        ) {
          return
        }

        event.preventDefault()
        onNavigate(href)
      }}
    >
      {children}
    </a>
  )
}

type WorkspaceHeaderProps = {
  actionStatus: string | null
  onRouteAction: () => void
  route: AppRoute
}

function WorkspaceHeader({
  actionStatus,
  onRouteAction,
  route,
}: Readonly<WorkspaceHeaderProps>) {
  return (
    <header className="workspace-header" role="banner">
      <div>
        <p className="section-label">Default collection</p>
        <h1 id="workspace-title">{route.label}</h1>
        <p>{route.description}</p>
        <div className="workspace-action-status-slot">
          {actionStatus ? (
            <p
              aria-live="polite"
              className="workspace-action-status"
              role="status"
            >
              {actionStatus}
            </p>
          ) : null}
        </div>
      </div>

      {route.actionLabel ? (
        <button
          className="button button-primary"
          type="button"
          onClick={onRouteAction}
        >
          <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
          {route.actionLabel}
        </button>
      ) : null}
    </header>
  )
}
