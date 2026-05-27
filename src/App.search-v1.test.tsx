import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App search v1 UI', () => {
  it('shows role context and large-result guidance for server search results', async () => {
    h.clearCatalogForTests()
    h.mockFetch(
      searchResponseWithProducerTrack({ total: 240 }),
      graphResponse(),
    )

    h.render(<h.App />)

    const resultRow = await h.screen.findByRole('row', {
      name: /Archive Producer Cut/i,
    })

    expect(h.within(resultRow).getByText('producer')).toBeInTheDocument()
    expect(h.within(resultRow).getByText('Owned')).toBeInTheDocument()
    expect(
      h.screen.getByText(
        'Showing first 1 of 240 matches. Refine search or filters to narrow results.',
      ),
    ).toBeInTheDocument()
    expect(
      h.within(resultRow).getByRole('link', {
        name: 'Open Archive Producer Cut',
      }),
    ).toHaveAttribute('href', '/tracks?track=track-producer')
  })

  it('derives label filter options from server label results and sends combined filters', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      ...Array.from({ length: 20 }).flatMap(() => [
        searchResponseWithProducerTrack({ includeLabelResult: true }),
        graphResponse(),
      ]),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await h.screen.findByRole('row', { name: /Factory Records/i })

    await user.selectOptions(h.screen.getByLabelText('Label'), 'label-1')
    await user.selectOptions(h.screen.getByLabelText('Media type'), 'vinyl')
    await user.selectOptions(
      h.screen.getByLabelText('Ownership status'),
      'owned',
    )
    await user.selectOptions(
      h.screen.getByLabelText('Credit or relation role'),
      'producer',
    )
    await user.selectOptions(h.screen.getByLabelText('Tag'), 'warehouse')

    await h.waitFor(() => {
      expect(
        h.searchRequestUrls(fetchMock).some((url) => {
          const params = url.searchParams

          return (
            params.get('labelId') === 'label-1' &&
            params.get('media') === 'vinyl' &&
            params.get('status') === 'owned' &&
            params.get('role') === 'producer' &&
            params.get('tag') === 'warehouse'
          )
        }),
      ).toBe(true)
    })
  })

  it('opens relation graph links and shows active-collection boundary misses', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      searchResponseWithProducerTrack(),
      graphResponseWithRelation(),
      h.emptySearchResponse(),
      h.jsonResponse({ code: 'artist_relation.not_found' }, 404),
      h.jsonResponse({ code: 'track_relation.not_found' }, 404),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('link', {
        name: 'Archive Producer Cut to Private Dub',
      }),
    )

    await h.waitFor(() => {
      expect(window.location.pathname).toBe('/relations')
      expect(window.location.search).toBe('?relation=private-relation')
    })
    await h.waitFor(() => {
      expect(
        h.searchRequestUrls(fetchMock).some((url) => {
          const params = url.searchParams

          return (
            params.get('savedView') === 'credits' &&
            params.get('limit') === '100'
          )
        }),
      ).toBe(true)
    })

    expect(
      await h.screen.findByText(
        'Relation private-relation is no longer available in the active collection.',
      ),
    ).toBeInTheDocument()
    expect(
      h.screen.queryByRole('heading', {
        name: 'Archive Producer Cut to Private Dub',
      }),
    ).not.toBeInTheDocument()
  })
})

function searchResponseWithProducerTrack({
  includeLabelResult = false,
  total,
}: {
  includeLabelResult?: boolean
  total?: number
} = {}) {
  const items = [
    ...(includeLabelResult
      ? [
          {
            id: 'label-1',
            type: 'label',
            title: 'Factory Records',
            subtitle: 'Label',
            summary: 'Manchester label with producer-heavy catalog entries.',
            matchedFields: ['name'],
            snippets: ['Factory Records · Archive Producer Cut'],
            facets: {
              roles: [],
              media: ['vinyl'],
              statuses: ['owned'],
              tags: ['warehouse'],
              labelId: 'label-1',
              collectorSignals: [],
            },
            rank: 1,
          },
        ]
      : []),
    {
      id: 'track-producer',
      type: 'track',
      title: 'Archive Producer Cut',
      subtitle: 'Track',
      summary: 'Producer credit on a vinyl catalog track.',
      matchedFields: ['title', 'credits'],
      snippets: ['Archive Producer Cut · producer credit'],
      facets: {
        roles: ['producer'],
        media: ['vinyl'],
        statuses: ['Owned'],
        tags: ['warehouse'],
        labelId: 'label-1',
        collectorSignals: ['physicalWithoutDigital'],
      },
      rank: includeLabelResult ? 2 : 1,
    },
  ]

  return h.jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: total ?? items.length,
  })
}

function graphResponse() {
  return h.jsonResponse({
    entity: {
      id: 'track-producer',
      type: 'track',
      title: 'Archive Producer Cut',
      subtitle: 'Track',
      summary: 'Producer credit on a vinyl catalog track.',
    },
    sections: {
      artists: [],
      releases: [],
      tracks: [],
      ownedCopies: [],
      labels: [],
      playlists: [],
      credits: [],
      relations: [],
      media: [],
    },
    collectorSignals: ['Physical media without digital copy'],
  })
}

function graphResponseWithRelation() {
  return h.jsonResponse({
    entity: {
      id: 'track-producer',
      type: 'track',
      title: 'Archive Producer Cut',
      subtitle: 'Track',
      summary: 'Producer credit on a vinyl catalog track.',
    },
    sections: {
      artists: [],
      releases: [],
      tracks: [],
      ownedCopies: [],
      labels: [],
      playlists: [],
      credits: [],
      relations: [
        {
          id: 'private-relation',
          type: 'relation',
          title: 'Archive Producer Cut to Private Dub',
          subtitle: 'remixOf',
          relation: 'track relation',
        },
      ],
      media: [],
    },
    collectorSignals: ['Physical media without digital copy'],
  })
}
