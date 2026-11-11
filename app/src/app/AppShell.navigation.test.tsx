import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { appRoutes, resolveRoute, type AppRoutePath } from './routes'

function shellElement(path: string, onNavigate: (path: AppRoutePath) => void) {
  return (
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
    </AppShell>
  )
}

function shell(path = '/catalog') {
  const onNavigate = vi.fn()
  render(shellElement(path, onNavigate))
  return onNavigate
}

describe('Grouped workspace navigation', () => {
  it('labels the existing catalog route Search without dropping any workspace', () => {
    shell()
    const nav = screen.getByRole('navigation', { name: 'DiscWeave sections' })
    fireEvent.click(screen.getByText('Tools', { selector: 'summary' }))
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

  it('keeps specialized managers out of Organize and collapsed in Tools by default', () => {
    shell()
    const organize = screen.getByRole('region', { name: 'Organize' })
    expect(
      within(organize).queryByRole('link', { name: 'Owned Items' }),
    ).not.toBeInTheDocument()
    expect(
      within(organize).queryByRole('link', { name: 'Relations' }),
    ).not.toBeInTheDocument()
    expect(within(organize).getAllByRole('link')).toHaveLength(2)
    const summary = screen.getByText('Tools', { selector: 'summary' })
    const tools = summary.closest('details')!
    expect(tools).not.toHaveAttribute('open')
    expect(within(tools).getByText('Owned Items')).not.toBeVisible()
    fireEvent.click(summary)
    expect(tools).toHaveAttribute('open')
    expect(
      within(tools).getByRole('link', { name: 'Owned Items' }),
    ).toBeVisible()
    expect(within(tools).getByRole('link', { name: 'Relations' })).toBeVisible()
    expect(within(tools).getByRole('link', { name: 'Exports' })).toBeVisible()
    fireEvent.click(summary)
    expect(tools).not.toHaveAttribute('open')
  })

  it.each(['/owned-items', '/relations', '/exports'])(
    'opens Tools for a legacy route: %s',
    (path) => {
      const navigate = shell(path)
      const route = resolveRoute(path)
      const link = screen.getByRole('link', { name: route.label })
      expect(link).toBeVisible()
      expect(link).toHaveAttribute('aria-current', 'page')
      expect(link.closest('details')).toHaveAttribute('open')
      fireEvent.click(screen.getByRole('link', { name: 'Search' }))
      expect(navigate).toHaveBeenCalledWith('/catalog')
    },
  )

  it('reopens Tools when entering another legacy route after manually collapsing it', () => {
    const navigate = vi.fn()
    const view = render(shellElement('/owned-items', navigate))
    const summary = screen.getByText('Tools', { selector: 'summary' })
    fireEvent.click(summary)
    expect(summary.closest('details')).not.toHaveAttribute('open')
    view.rerender(shellElement('/relations', navigate))
    expect(summary.closest('details')).toHaveAttribute('open')
    expect(screen.getByRole('link', { name: 'Relations' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Relations' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('keeps modified clicks browser-native', () => {
    const navigate = shell()
    fireEvent.click(screen.getByRole('link', { name: 'Releases' }), {
      metaKey: true,
    })
    expect(navigate).not.toHaveBeenCalled()
  })
})
