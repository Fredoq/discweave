import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { appRoutes, resolveRoute } from './routes'

function shell(path = '/catalog') {
  const onNavigate = vi.fn()
  render(
    <AppShell
      activeRoute={resolveRoute(path)}
      actionStatus={null}
      logoutPending={false}
      onLogout={vi.fn()}
      onNavigate={onNavigate}
      onNavigateToUrl={() => false}
      onRouteAction={vi.fn()}
      session={{ email: 'owner@local.discweave', role: 'Owner' }}
      sessionError={null}
    >
      <div>Workspace content</div>
    </AppShell>,
  )
  return onNavigate
}

describe('Grouped workspace navigation', () => {
  it('labels the existing catalog route Search without dropping any workspace', () => {
    shell()
    const nav = screen.getByRole('navigation', { name: 'DiscWeave sections' })
    for (const route of appRoutes) {
      expect(
        within(nav).getByRole('link', { name: route.label }),
      ).toHaveAttribute('href', route.path)
    }
    expect(within(nav).getByRole('link', { name: 'Search' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('heading', { name: 'Search', level: 1 }),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'Catalog' }),
    ).not.toBeInTheDocument()
  })

  it('keeps inventory and relations visible until their editors are relocated', () => {
    const navigate = shell('/relations')
    const organize = screen.getByRole('region', { name: 'Organize' })
    expect(
      within(organize).getByRole('link', { name: 'Owned Items' }),
    ).toBeVisible()
    expect(
      within(organize).getByRole('link', { name: 'Relations' }),
    ).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('link', { name: 'Search' }))
    expect(navigate).toHaveBeenCalledWith('/catalog')
  })

  it('keeps modified clicks browser-native', () => {
    const navigate = shell()
    fireEvent.click(screen.getByRole('link', { name: 'Releases' }), {
      metaKey: true,
    })
    expect(navigate).not.toHaveBeenCalled()
  })
})
