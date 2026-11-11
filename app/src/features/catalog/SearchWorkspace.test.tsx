import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './catalogApi'
import { artistRecords } from '../artists/artistsData'
import { ServerCatalogWorkspace } from './ServerCatalogWorkspace'
import { LocalCatalogWorkspace } from './LocalCatalogWorkspace'

const artist: api.CatalogSearchResult = {
  identityHint: '',
  id: 'artist-one',
  type: 'artist',
  title: 'Example Artist',
  subtitle: 'Person',
  summary: 'Artist summary',
  matchedFields: [],
  snippets: [],
  rank: 1,
  facets: {
    roles: [],
    media: [],
    statuses: [],
    tags: [],
    collectorSignals: [],
  },
}
const context: api.CatalogGraphContext = {
  entity: { id: artist.id, type: 'artist', title: artist.title },
  collectorSignals: [],
  sections: {
    media: [],
    playlists: [],
    artists: [],
    credits: [],
    releases: [],
    tracks: [],
    ownedCopies: [],
    labels: [],
    relations: [],
  },
}

beforeEach(() => {
  window.history.replaceState({}, '', '/catalog')
  vi.spyOn(api, 'searchCatalog').mockResolvedValue({
    items: [artist],
    total: 1,
    offset: 0,
    limit: 100,
  })
  vi.spyOn(api, 'loadCatalogGraphContext').mockResolvedValue(context)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

function workspace(locationSearch = '') {
  return (
    <ServerCatalogWorkspace
      labels={[]}
      locationSearch={locationSearch}
      searchRefreshKey={0}
    />
  )
}

describe('Search workspace', () => {
  it('keeps results full width with primary entity links and no automatic preview requests', async () => {
    render(workspace())
    expect(
      await screen.findByRole('link', { name: 'Open Example Artist' }),
    ).toHaveAttribute('href', '/artists?artist=artist-one')
    expect(api.loadCatalogGraphContext).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Media type' }),
    ).not.toBeInTheDocument()
  })

  it('opens and cancels preview without losing the results and restores focus', async () => {
    const user = userEvent.setup()
    render(workspace())
    const preview = await screen.findByRole('button', {
      name: 'Preview Example Artist',
    })
    await user.click(preview)
    const dialog = await screen.findByRole('dialog', {
      name: 'Preview: Example Artist',
    })
    expect(
      await screen.findByRole('complementary', { name: 'Example Artist' }),
    ).toBeInTheDocument()
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(preview).toHaveFocus()
    await user.click(preview)
    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(preview).toHaveFocus()
    expect(
      screen.getByRole('link', { name: 'Open Example Artist' }),
    ).toBeInTheDocument()
  })

  it('keeps URL filters active while collapsed and clears query, saved view and filters together', async () => {
    const user = userEvent.setup()
    render(workspace('?query=example&media=vinyl&tag=ambient&savedView=owned'))
    const filters = await screen.findByRole('button', { name: 'Filters (2)' })
    expect(filters).toHaveAttribute('aria-expanded', 'false')
    await user.click(filters)
    expect(screen.getByRole('combobox', { name: 'Media type' })).toHaveValue(
      'vinyl',
    )
    expect(screen.getByRole('combobox', { name: 'Tag' })).toHaveValue('ambient')
    await user.click(filters)
    expect(
      screen.queryByRole('combobox', { name: 'Media type' }),
    ).not.toBeInTheDocument()
    expect(window.location.search).toContain('media=vinyl')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Saved view' })).toHaveValue(
      'All',
    )
    await waitFor(() => expect(window.location.search).toBe(''))
  })

  it('preserves every saved view and entity filter without opening advanced filters', async () => {
    const user = userEvent.setup()
    render(workspace())
    await screen.findByRole('link', { name: 'Open Example Artist' })
    expect(
      screen
        .getByRole('combobox', { name: 'Saved view' })
        .querySelectorAll('option'),
    ).toHaveLength(10)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Saved view' }),
      'Needs digitization',
    )
    await user.click(screen.getByRole('button', { name: 'Tracks' }))
    await waitFor(() =>
      expect(api.searchCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({
          savedView: 'needsDigitization',
          entityType: 'track',
          offset: 0,
        }),
      ),
    )
  })

  it('does not reopen a closed preview when a late graph request resolves', async () => {
    let resolveContext: ((value: api.CatalogGraphContext) => void) | undefined
    vi.mocked(api.loadCatalogGraphContext).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveContext = resolve
        }),
    )
    const user = userEvent.setup()
    render(workspace())
    await user.click(
      await screen.findByRole('button', { name: 'Preview Example Artist' }),
    )
    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    resolveContext?.(context)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('closes preview when history restores a different search and keeps URL filters', async () => {
    const user = userEvent.setup()
    const { rerender } = render(workspace())
    await user.click(
      await screen.findByRole('button', { name: 'Preview Example Artist' }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    window.history.replaceState({}, '', '/catalog?query=other&media=cd')
    rerender(workspace('?query=other&media=cd'))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('searchbox')).toHaveValue('other')
    expect(window.location.search).toContain('media=cd')
    expect(
      screen.getByRole('button', { name: 'Filters (1)' }),
    ).toBeInTheDocument()
  })

  it('does not reopen a local preview when an entity disappears and returns', async () => {
    const user = userEvent.setup()
    const renderLocal = (hasArtist: boolean) => (
      <LocalCatalogWorkspace
        artists={hasArtist ? [artistRecords[0]] : []}
        releases={[]}
        tracks={[]}
        ownedItems={[]}
        relations={[]}
        playlists={[]}
      />
    )
    const { rerender } = render(renderLocal(true))
    await user.click(
      screen.getByRole('button', { name: `Preview ${artistRecords[0].name}` }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    rerender(renderLocal(false))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    rerender(renderLocal(true))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'nothing matches')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(
      screen.getByRole('link', { name: `Open ${artistRecords[0].name}` }),
    ).toBeInTheDocument()
  })

  it('shows a useful empty state without an empty preview column in local mode', () => {
    render(
      <LocalCatalogWorkspace
        artists={[]}
        releases={[]}
        tracks={[]}
        ownedItems={[]}
        relations={[]}
        playlists={[]}
      />,
    )
    expect(screen.getByText('No matching catalog entries.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})
