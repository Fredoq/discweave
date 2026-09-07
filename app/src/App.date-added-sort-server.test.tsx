import { beforeEach } from 'vitest'
import { searchResponseWithRelease } from './test/catalogActionFixtures'
import { expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import { ServerCatalogWorkspace } from './features/catalog/ServerCatalogWorkspace'
import { ReviewWorkbenchWorkspace } from './features/reviewWorkbench/ReviewWorkbenchWorkspace'
import { SessionsTable } from './features/imports/ImportReviewPanels'
import { TracksWorkspace } from './features/tracks/TracksWorkspace'
import type {
  ReleaseImportSession,
  CatalogSearchResult,
} from './features/catalog/catalogApi'

h.setupAppTestHooks()
beforeEach(() => window.localStorage.clear())

it('requests catalog sorting on the server and resets the page', async () => {
  const fetchMock = h.mockFetch()
  fetchMock.mockImplementation(async (input) => {
    if (typeof input === 'string' && input.startsWith('/api/search?')) {
      const response = (await searchResponseWithRelease().json()) as {
        items: CatalogSearchResult[]
      }
      return h.jsonResponse({ ...response, total: 101 })
    }
    return h.jsonResponse(null)
  })
  h.render(
    <ServerCatalogWorkspace
      labels={[]}
      locationSearch=""
      searchRefreshKey={0}
    />,
  )
  const user = h.userEvent.setup()
  await h.waitFor(() => expect(h.searchRequestUrls(fetchMock)).toHaveLength(1))
  await user.click(await h.screen.findByRole('button', { name: 'Next page' }))
  await h.waitFor(() =>
    expect(
      h.searchRequestUrls(fetchMock).at(-1)?.searchParams.get('offset'),
    ).toBe('100'),
  )
  await user.selectOptions(
    h.screen.getByRole('combobox', { name: 'Sort by' }),
    'addedNewest',
  )
  await h.waitFor(() => {
    const params = h.searchRequestUrls(fetchMock).at(-1)!.searchParams
    expect(params.get('sort')).toBe('addedNewest')
    expect(params.get('offset')).toBe('0')
  })
})

it('keeps review sorting in navigation and sends it to the server', async () => {
  const summary = { active: 0, open: 0, reopened: 0, dismissed: 0, resolved: 0 }
  const fetchMock = h.mockFetch()
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      h.jsonResponse({ items: [], total: 0, limit: 100, offset: 0, summary }),
    ),
  )
  const navigate = h.vi.fn(() => true)
  h.render(
    <ReviewWorkbenchWorkspace
      locationSearch="?sort=addedOldest&offset=100"
      onNavigateToUrl={navigate}
    />,
  )
  await h.waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('sort=addedOldest'),
      expect.anything(),
    ),
  )
  await h.userEvent
    .setup()
    .selectOptions(
      h.screen.getByRole('combobox', { name: 'Sort by' }),
      'addedNewest',
    )
  expect(navigate).toHaveBeenCalledWith('/review-workbench?sort=addedNewest')
})

it('sorts import sessions by the recorded creation date', async () => {
  const response = (await h.importSessionResponse().json()) as {
    items: Extract<ReleaseImportSession, { sourceKind: 'localFiles' }>[]
  }
  const base = response.items[0]
  const sessions = [
    {
      ...base,
      id: 'old',
      sourceRoot: '/Older scan',
      createdAt: '2020-01-01T00:00:00Z',
    },
    {
      ...base,
      id: 'new',
      sourceRoot: '/Newer scan',
      createdAt: '2025-01-01T00:00:00Z',
    },
  ]
  h.render(
    <SessionsTable
      sessions={sessions}
      selectedSessionId="old"
      sessionFilter="all"
      includeArchived={false}
      onArchive={() => {}}
      onDelete={() => {}}
      onFilterChange={() => {}}
      onIncludeArchivedChange={() => {}}
      onSelect={() => {}}
    />,
  )
  const user = h.userEvent.setup()
  await user.selectOptions(
    h.screen.getByRole('combobox', { name: 'Sort by' }),
    'addedNewest',
  )
  expect(h.screen.getAllByRole('row')[0]).toHaveTextContent('/Newer scan')
  await user.selectOptions(
    h.screen.getByRole('combobox', { name: 'Sort by' }),
    'addedOldest',
  )
  expect(h.screen.getAllByRole('row')[0]).toHaveTextContent('/Older scan')
})

it('sorts track stack roots by the original track creation time', async () => {
  const tracks = [
    {
      ...h.trackRecords[0],
      id: '01980000-0000-7000-8000-000000000001',
      title: 'Older original',
      isOriginal: true,
    },
    {
      ...h.trackRecords[0],
      id: '01990000-0000-7000-8000-000000000001',
      title: 'Newer original',
      isOriginal: true,
    },
  ]
  h.render(<TracksWorkspace tracks={tracks} />)
  await h.userEvent
    .setup()
    .selectOptions(
      h.screen.getByRole('combobox', { name: 'Sort by' }),
      'addedNewest',
    )
  expect(
    h
      .within(h.screen.getByRole('region', { name: 'Track records' }))
      .getAllByRole('listitem')[0],
  ).toHaveTextContent('Newer original')
})
