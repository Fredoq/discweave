import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiscoverContent } from './DiscoverWorkspacePanels'
import { discoverDisplayValues } from './discoverDisplayValues'
import { testDiscoverRelease } from './discoverTestFixtures'
import styles from './discover.css?raw'
import settingsStyles from './discover-settings.css?raw'

afterEach(cleanup)

function renderContent(ready = false, available = true) {
  return render(
    <DiscoverContent
      available={available}
      ready={ready}
      result={null}
      settingsOpen={false}
      selected={undefined}
      busy={false}
      onSelect={vi.fn()}
      onAction={vi.fn()}
    />,
  )
}

describe('Discover archive layout', () => {
  it('combines setup instructions and the empty state into one padded panel', () => {
    const { container } = renderContent()
    expect(
      screen.getByRole('heading', { name: 'Set up release discovery' }),
    ).toBeVisible()
    expect(screen.getByText(/allow metadata sharing/)).toBeVisible()
    expect(container.querySelectorAll('.panel')).toHaveLength(1)
    expect(container.querySelector('.panel')).toHaveClass(
      'discover-empty-state',
    )
    expect(
      screen.queryByText('A new starting point for your collection'),
    ).not.toBeInTheDocument()
  })

  it('shows one focused browser or ready empty state without a second setup notice', () => {
    const { unmount } = renderContent(false, false)
    expect(
      screen.getByRole('heading', { name: 'Discover in the desktop app' }),
    ).toBeVisible()
    expect(screen.getByText(/Open DiscWeave desktop/)).toBeVisible()
    expect(screen.queryByText(/allow metadata sharing/)).not.toBeInTheDocument()
    unmount()
    renderContent(true)
    expect(
      screen.getByRole('heading', { name: 'Explore beyond your collection' }),
    ).toBeVisible()
    expect(screen.queryByText(/allow metadata sharing/)).not.toBeInTheDocument()
  })

  it('deduplicates displayed labels and formats without changing verified source data or actions', async () => {
    const release = {
      ...testDiscoverRelease(),
      labels: ['Numbers.', 'Numbers.', ' numbers. '],
      formats: ['CD', 'CD', ' cd '],
    }
    const original = structuredClone(release)
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(
      <DiscoverContent
        available
        ready
        result={{ items: [release], message: 'Verified' }}
        settingsOpen={false}
        selected={release}
        busy={false}
        onSelect={vi.fn()}
        onAction={onAction}
      />,
    )
    const list = screen.getByRole('region', { name: 'Recommended releases' })
    expect(within(list).getByRole('button')).toHaveTextContent(
      '2001 · Numbers. · CD',
    )
    const detail = screen.getByRole('complementary', {
      name: 'Recommended release details',
    })
    expect(within(detail).getByText('Numbers.')).toBeVisible()
    expect(within(detail).getByText('CD')).toBeVisible()
    await user.click(
      within(detail).getByRole('button', { name: 'Review for Wanted' }),
    )
    expect(onAction).toHaveBeenCalledWith(release, 'wanted')
    expect(release).toEqual(original)
    expect(within(detail).queryByRole('img')).not.toBeInTheDocument()
  })

  it('keeps Wanted and feedback before potentially long catalog metadata in keyboard order', () => {
    const release = testDiscoverRelease()
    render(
      <DiscoverContent
        available
        ready
        result={{ items: [release], message: '' }}
        settingsOpen={false}
        selected={release}
        busy={false}
        onSelect={vi.fn()}
        onAction={vi.fn()}
      />,
    )
    const detail = screen.getByRole('complementary', {
      name: 'Recommended release details',
    })
    const metadata = within(detail).getByText('Genres')
    for (const name of [
      'Review for Wanted',
      'Not interested',
      'Already know',
    ]) {
      const button = within(detail).getByRole('button', { name })
      expect(
        button.compareDocumentPosition(metadata) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).not.toBe(0)
    }
  })

  it('retains keyboard selection and native focusable actions', async () => {
    const user = userEvent.setup()
    const release = testDiscoverRelease()
    const onSelect = vi.fn()
    render(
      <DiscoverContent
        available
        ready
        result={{ items: [release], message: '' }}
        settingsOpen={false}
        selected={release}
        busy={false}
        onSelect={onSelect}
        onAction={vi.fn()}
      />,
    )
    const row = within(
      screen.getByRole('region', { name: 'Recommended releases' }),
    ).getByRole('button')
    await user.tab()
    expect(row).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(release.externalId)
    await user.tab()
    expect(screen.getByRole('link', { name: 'View on Discogs' })).toHaveFocus()
  })

  it('bounds the workspace and detail width while keeping top alignment and natural narrow scrolling', () => {
    expect(styles).toMatch(
      /\.discover-workspace\s*\{[^}]*max-width: 1320px;[^}]*align-content: start;/s,
    )
    expect(styles).toMatch(
      /\.discover-results\s*\{[^}]*minmax\(360px, 400px\)/s,
    )
    expect(styles).toMatch(
      /@media \(max-width: 1100px\)\s*\{\s*\.discover-results\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/s,
    )
    expect(styles).toMatch(
      /\.discover-toolbar\s*\{\s*justify-content: flex-start;/s,
    )
    expect(styles).toMatch(/\.discover-empty-state\s*\{[^}]*padding: 24px;/s)
    expect(styles).not.toMatch(/(?:max-height|overflow-y):/)
    expect(styles).toContain('.discover-release-row:focus-visible')
  })

  it('pads and bounds settings with a single-column narrow layout and visible focus', () => {
    expect(settingsStyles).toMatch(
      /\.discover-settings-panel\s*\{[^}]*max-width: 1040px;/s,
    )
    expect(settingsStyles).toMatch(
      /\.discover-settings-columns\s*\{[^}]*minmax\(240px, 0.85fr\) minmax\(0, 1.15fr\);[^}]*padding: 20px 22px;/s,
    )
    expect(settingsStyles).toMatch(
      /@media \(max-width: 900px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/,
    )
    expect(settingsStyles).toContain('@media (max-width: 560px)')
    expect(settingsStyles).toContain('padding-inline: 16px')
    expect(settingsStyles).toContain(':focus-visible')
    expect(settingsStyles).not.toMatch(/(?:max-height|overflow-y):/)
  })

  it('discards blank duplicate display values but preserves distinct names', () => {
    expect(
      discoverDisplayValues([' CD ', '', 'cd', 'Vinyl', 'VINYL', 'CD Single']),
    ).toBe('CD, Vinyl, CD Single')
  })
})
