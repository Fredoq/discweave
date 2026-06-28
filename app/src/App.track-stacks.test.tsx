import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App track stacks workspace', () => {
  it('renders configured server track stacks with button semantics', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/tracks/stacks')) {
        return listResponse([
          {
            originalTrackId: 'track-original',
            originalTitle: 'Blue Monday',
            originalVersionYear: 1983,
            memberCount: 1,
            hasCycleIssue: false,
            members: [
              {
                trackId: 'track-configured-mix',
                title: 'Blue Monday (Configured Mix)',
                versionYear: 1988,
                relationType: 'customStack',
                depth: 1,
                isDirect: true,
              },
            ],
            issues: [],
          },
        ])
      }

      if (url.startsWith('/api/tracks?')) {
        return listResponse([
          {
            id: 'track-original',
            title: 'Blue Monday',
            durationSeconds: 446,
            versionYear: 1983,
            isOriginal: true,
            genres: [],
            tags: [],
            credits: [],
            releaseAppearances: [],
            digitalFiles: [],
          },
          {
            id: 'track-configured-mix',
            title: 'Blue Monday (Configured Mix)',
            durationSeconds: 420,
            versionYear: 1988,
            isOriginal: false,
            genres: [],
            tags: [],
            credits: [],
            releaseAppearances: [],
            digitalFiles: [],
          },
        ])
      }

      if (url.startsWith('/api/settings/dictionaries?')) {
        return h.defaultDictionaryListResponse()
      }

      if (url.startsWith('/api/rating-criteria?')) {
        return h.defaultRatingCriteriaListResponse()
      }

      return h.emptyCatalogListResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('heading', { name: 'Track records' }),
    ).toBeInTheDocument()
    await h.waitFor(() => {
      expect(
        requestUrls(fetchMock).some((url) =>
          url.startsWith('/api/tracks/stacks'),
        ),
      ).toBe(true)
    })
    await user.click(h.screen.getAllByRole('button', { name: 'Expand stack' })[0])

    expect(
      await h.screen.findByRole('button', {
        name: /Blue Monday \(Configured Mix\)/,
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.queryByRole('row', {
        name: /Blue Monday \(Configured Mix\)/,
      }),
    ).not.toBeInTheDocument()
  })

  it('groups expanded stack members by product relation type', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/tracks/stacks')) {
        return listResponse([
          {
            originalTrackId: 'track-original',
            originalTitle: 'Show Me Love (New York Mix)',
            originalVersionYear: 1990,
            memberCount: 3,
            hasCycleIssue: false,
            members: [
              {
                trackId: 'track-remix',
                title: 'Show Me Love (StoneBridge Club Mix)',
                versionYear: 1993,
                relationType: 'remixOf',
                depth: 1,
                isDirect: true,
              },
              {
                trackId: 'track-version',
                title: 'Show Me Love (Radio Edit)',
                versionYear: 1993,
                relationType: 'versionOf',
                depth: 1,
                isDirect: true,
              },
              {
                trackId: 'track-sample',
                title: 'Luv 4 Luv',
                versionYear: 1993,
                relationType: 'samplingOf',
                depth: 1,
                isDirect: true,
              },
            ],
            issues: [],
          },
        ])
      }

      if (url.startsWith('/api/tracks?')) {
        return listResponse([
          trackResponse('track-original', 'Show Me Love (New York Mix)', true),
          trackResponse('track-remix', 'Show Me Love (StoneBridge Club Mix)'),
          trackResponse('track-version', 'Show Me Love (Radio Edit)'),
          trackResponse('track-sample', 'Luv 4 Luv'),
        ])
      }

      if (url.startsWith('/api/track-relations?')) {
        return listResponse([
          trackRelationResponse(
            'relation-remix',
            'track-remix',
            'track-original',
            'remixOf',
          ),
          trackRelationResponse(
            'relation-version',
            'track-version',
            'track-original',
            'versionOf',
          ),
          trackRelationResponse(
            'relation-sample',
            'track-sample',
            'track-original',
            'samplingOf',
          ),
        ])
      }

      if (url.startsWith('/api/settings/dictionaries?')) {
        return h.defaultDictionaryListResponse()
      }

      if (url.startsWith('/api/rating-criteria?')) {
        return h.defaultRatingCriteriaListResponse()
      }

      return h.emptyCatalogListResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await h.screen.findByRole('heading', { name: 'Track records' })
    await user.click(h.screen.getAllByRole('button', { name: 'Expand stack' })[0])

    expect(h.screen.getAllByText('Remixes').length).toBeGreaterThan(0)
    expect(h.screen.getAllByText('Versions').length).toBeGreaterThan(0)
    expect(h.screen.getAllByText('Other relations').length).toBeGreaterThan(0)
    expect(
      h.screen.getByRole('button', {
        name: /Show Me Love \(StoneBridge Club Mix\)/,
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: /Show Me Love \(Radio Edit\)/ }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: /Luv 4 Luv/ }),
    ).toBeInTheDocument()
    expect(h.screen.queryByText('remixOf')).not.toBeInTheDocument()
    expect(h.screen.queryByText('versionOf')).not.toBeInTheDocument()

    await user.click(
      h.screen.getByRole('button', {
        name: /Show Me Love \(StoneBridge Club Mix\)/,
      }),
    )

    expect(
      h.screen.getByRole('heading', { name: 'Origin' }),
    ).toBeInTheDocument()
    expect(h.screen.queryByText('Outgoing relation')).not.toBeInTheDocument()
  })
})

function listResponse(items: unknown[]) {
  return h.jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
  })
}

function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}

function trackResponse(id: string, title: string, isOriginal = false) {
  return {
    id,
    title,
    durationSeconds: 240,
    versionYear: 1993,
    isOriginal,
    genres: [],
    tags: [],
    credits: [
      {
        artistId: 'artist-robin-s',
        artistName: 'Robin S.',
        role: 'mainArtist',
        roles: ['mainArtist'],
      },
    ],
    releaseAppearances: [
      {
        releaseId: 'release-show-me-love',
        releaseTitle: 'Show Me Love',
        releaseArtist: 'Robin S.',
        year: 1993,
        label: 'Champion',
        position: 1,
        durationSeconds: 240,
      },
    ],
    digitalFiles: [],
  }
}

function trackRelationResponse(
  id: string,
  sourceTrackId: string,
  targetTrackId: string,
  type: string,
) {
  return {
    id,
    type,
    sourceTrackId,
    targetTrackId,
  }
}
