import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App workspace navigation', () => {
  it('syncs same-route URL query changes into the catalog search state', async () => {
    window.history.pushState({}, '', '/catalog?query=alpha')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptySearchResponse(),
      h.emptySearchResponse(),
    )
    h.render(<h.App />)

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'alpha'),
      ).toBe(true)
    })

    h.act(() => {
      window.history.pushState({}, '', '/catalog?query=beta')
      window.dispatchEvent(new Event('cratebase:navigation'))
    })

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'beta'),
      ).toBe(true)
    })
  })

  it('loads editable release records directly instead of server entity search', async () => {
    window.history.pushState({}, '', '/releases')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(...h.emptyCatalogLoadResponses())

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('heading', { name: 'Releases' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('heading', { name: 'Release records' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(urls.some((url) => url.startsWith('/api/search?'))).toBe(false)
    expect(urls).toContain('/api/releases?limit=100&offset=0')
  })

  it('hydrates the full catalog once when moving between editable sections', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptySearchResponse(),
      ...h.emptyCatalogLoadResponses(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.screen.findByText('No matching catalog entries.')
    await user.click(h.screen.getByRole('link', { name: 'Releases' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Release records' }),
    ).toBeInTheDocument()
    const callCountAfterReleases = fetchMock.mock.calls.length

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Track records' }),
    ).toBeInTheDocument()
    expect(fetchMock.mock.calls).toHaveLength(callCountAfterReleases)
  })

  it('shows mutation errors in editable workspaces', async () => {
    window.history.pushState({}, '', '/artists')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      ...h.emptyCatalogLoadResponses(),
      h.jsonResponse(
        { code: 'catalog.server_error', message: 'Save failed' },
        500,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: 'Add artist' }),
    )
    const form = h.screen.getByRole('form', { name: 'Add artist' })
    await user.type(h.within(form).getByLabelText('Name'), 'Failed Artist')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Catalog request failed. Try again.',
    )
    expect(
      fetchMock.mock.calls.some(([input]) => input === '/api/artists'),
    ).toBe(true)
  })
})

function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}
