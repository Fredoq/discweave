import { Database, LogOut, Plus } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { appRoutes, type AppRoute, type AppRoutePath } from './routes'

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
}: AppShellProps) {
  function handleShellLinkClick(event: MouseEvent<HTMLElement>) {
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

    const target = event.target as Element
    const link = target.closest<HTMLAnchorElement>('a[href]')

    if (!link || link.target || link.hasAttribute('download')) {
      return
    }

    if (onNavigateToUrl(link.href)) {
      event.preventDefault()
    }
  }

  return (
    <main className="app-shell" onClick={handleShellLinkClick}>
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
}: SidebarNavProps) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <AppLink
        className="brand"
        href="/catalog"
        ariaLabel="Cratebase catalog"
        onNavigate={onNavigate}
      >
        <span className="brand-mark" aria-hidden="true">
          <Database size={18} strokeWidth={2.2} />
        </span>
        <span>Cratebase</span>
      </AppLink>

      <nav className="navigation" aria-label="Cratebase sections">
        {appRoutes.map((item) => {
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
            </AppLink>
          )
        })}
      </nav>

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
    </aside>
  )
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
}: AppLinkProps) {
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
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header" role="banner">
      <div>
        <p className="section-label">Default collection</p>
        <h1 id="workspace-title">{route.label}</h1>
        <p>{route.description}</p>
        {actionStatus ? (
          <p className="workspace-action-status" role="status">
            {actionStatus}
          </p>
        ) : null}
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
