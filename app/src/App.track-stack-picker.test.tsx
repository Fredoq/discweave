import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import {
  listResponse,
  trackRelationResponse,
  trackResponse,
} from './test/trackStacksTestFixtures'

h.setupAppTestHooks()

describe('App track stack picker', () => {
  it('shows assignment for an eligible standalone selected track', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    installPickerCatalog()
    h.render(<h.App />)
    const detail = await h.screen.findByRole('complementary', {
      name: 'Incoming Mix',
    })
    expect(
      await h.within(detail).findByRole('button', {
        name: 'Add to stack...',
      }),
    ).toBeVisible()
  })

  it('omits assignment for a stack root and member', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    installPickerCatalog()
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await h.screen.findByRole('complementary', { name: 'Incoming Mix' })
    await h.screen.findByRole('button', { name: 'Add to stack...' })

    await user.click(
      h.screen.getByRole('button', { name: /Expanded Mix Root/ }),
    )
    expect(
      h
        .within(
          h.screen.getByRole('complementary', { name: 'Expanded Mix Root' }),
        )
        .queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()

    await user.click(
      h.screen.getAllByRole('button', { name: 'Expand stack' })[0],
    )
    await user.click(
      await h.screen.findByRole('button', { name: /Expanded Mix Member/ }),
    )
    expect(
      h
        .within(
          h.screen.getByRole('complementary', { name: 'Expanded Mix Member' }),
        )
        .queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()
  })

  it('omits assignment when stack relation settings are empty', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    const fixture = installPickerCatalog([])
    h.render(<h.App />)
    const detail = await h.screen.findByRole('complementary', {
      name: 'Incoming Mix',
    })
    await h.waitFor(() => {
      expect(
        fixture.fetchMock.mock.calls.some(([input]) => {
          const url = typeof input === 'string' ? input : (input as Request).url
          return url.startsWith('/api/settings/track-stack')
        }),
      ).toBe(true)
    })
    const settingsCallIndex = fixture.fetchMock.mock.calls.findIndex(
      ([input]) => {
        const url = typeof input === 'string' ? input : (input as Request).url
        return url.startsWith('/api/settings/track-stack')
      },
    )
    const settingsRequest: unknown =
      fixture.fetchMock.mock.results[settingsCallIndex]?.value
    if (!(settingsRequest instanceof Promise)) {
      throw new Error('The stack settings request was not started')
    }
    await h.act(async () => {
      await settingsRequest
    })
    expect(
      h.within(detail).queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()
  })

  it('assigns to a destination absent from the visible tracks list', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    const fixture = installPickerCatalog()
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await user.type(
      await h.screen.findByRole('searchbox', { name: 'Search tracks' }),
      'Mix',
    )
    const workspace = h.screen.getByRole('region', {
      name: 'Tracks workspace',
    })
    expect(
      h.within(workspace).queryByRole('button', { name: /Remote Destination/ }),
    ).not.toBeInTheDocument()

    await user.click(
      await h.screen.findByRole('button', { name: 'Add to stack...' }),
    )
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search stacks' }),
      'remote',
    )
    await user.click(
      await h.screen.findByRole('radio', { name: /Remote Destination/ }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Continue' }))
    await user.click(h.screen.getByRole('radio', { name: 'Remix' }))
    await user.click(h.screen.getByRole('button', { name: 'Add to stack' }))

    await h.waitFor(() => expect(fixture.postBodies).toHaveLength(1))
    expect(JSON.parse(fixture.postBodies[0])).toEqual({
      sourceTrackId: 'source-track',
      targetTrackId: 'remote-root',
      type: 'remixOf',
      markTargetAsOriginal: false,
    })
  })

  it('announces success removes the stale action and preserves workspace state', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    installPickerCatalog()
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const trackSearch = await h.screen.findByRole('searchbox', {
      name: 'Search tracks',
    })
    await user.type(trackSearch, 'Mix')
    await user.click(
      h.screen.getAllByRole('button', { name: 'Expand stack' })[0],
    )
    expect(
      h.screen.getByRole('button', { name: 'Collapse stack' }),
    ).toBeVisible()
    const workspace = h.screen.getByRole('region', {
      name: 'Tracks workspace',
    })
    const scrollContainer = workspace.querySelector(
      '.catalog-main',
    ) as HTMLElement
    scrollContainer.scrollTop = 320
    const locationBefore = window.location.href

    await user.click(
      await h.screen.findByRole('button', { name: 'Add to stack...' }),
    )
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search stacks' }),
      'remote',
    )
    await user.click(
      await h.screen.findByRole('radio', { name: /Remote Destination/ }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Continue' }))
    await user.click(h.screen.getByRole('radio', { name: 'Remix' }))
    await user.click(h.screen.getByRole('button', { name: 'Add to stack' }))

    expect(
      await h.screen.findByText(
        'Added Incoming Mix to Remote Destination as Remix.',
      ),
    ).toBeInTheDocument()
    expect(trackSearch).toHaveValue('Mix')
    expect(scrollContainer.scrollTop).toBe(320)
    expect(
      h.screen.getByRole('button', { name: 'Collapse stack' }),
    ).toBeVisible()
    const sourceDetail = h.screen.getByRole('complementary', {
      name: 'Incoming Mix',
    })
    const sourceHeading = h
      .within(sourceDetail)
      .getByRole('heading', { name: 'Incoming Mix' })
    expect(sourceHeading).toBeVisible()
    await h.waitFor(() => expect(sourceHeading).toHaveFocus())
    expect(
      h.within(sourceDetail).queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()
    expect(window.location.href).toBe(locationBefore)
  })
})

function installPickerCatalog(relationTypeCodes = ['remixOf', 'versionOf']) {
  let assigned = false
  const postBodies: string[] = []
  const fetchMock = h.vi.fn<Window['fetch']>(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    await Promise.resolve()

    if (url === '/api/track-relations/stack' && init?.method === 'POST') {
      assigned = true
      postBodies.push(typeof init.body === 'string' ? init.body : '')
      return h.jsonResponse({}, 201)
    }

    if (url.startsWith('/api/tracks/stack-targets')) {
      return h.jsonResponse({
        items: [
          {
            rootTrackId: 'remote-root',
            title: 'Remote Destination',
            artistDisplay: 'Remote Artist',
            versionYear: 1994,
            memberCount: 3,
            matchedMember: null,
          },
        ],
        limit: 20,
        offset: 0,
        total: 1,
      })
    }

    if (url.startsWith('/api/tracks/stacks')) {
      return listResponse([
        {
          originalTrackId: 'expanded-root',
          originalTitle: 'Expanded Mix Root',
          originalVersionYear: 1993,
          memberCount: 1,
          hasCycleIssue: false,
          members: [
            {
              trackId: 'expanded-member',
              title: 'Expanded Mix Member',
              versionYear: 1993,
              relationType: 'versionOf',
              depth: 1,
              isDirect: true,
            },
          ],
          issues: [],
        },
        ...(assigned
          ? [
              {
                originalTrackId: 'remote-root',
                originalTitle: 'Remote Destination',
                originalVersionYear: 1994,
                memberCount: 1,
                hasCycleIssue: false,
                members: [
                  {
                    trackId: 'source-track',
                    title: 'Incoming Mix',
                    versionYear: 1993,
                    relationType: 'remixOf',
                    depth: 1,
                    isDirect: true,
                  },
                ],
                issues: [],
              },
            ]
          : []),
      ])
    }

    if (url.startsWith('/api/settings/track-stack')) {
      return h.jsonResponse({ relationTypeCodes })
    }

    if (url.startsWith('/api/tracks?')) {
      return listResponse([
        trackResponse('source-track', 'Incoming Mix'),
        trackResponse('expanded-root', 'Expanded Mix Root', true),
        trackResponse('expanded-member', 'Expanded Mix Member'),
        trackResponse('remote-root', 'Remote Destination', true),
      ])
    }

    if (url.startsWith('/api/track-relations?')) {
      return listResponse([
        trackRelationResponse(
          'existing-relation',
          'expanded-member',
          'expanded-root',
          'versionOf',
        ),
        ...(assigned
          ? [
              trackRelationResponse(
                'created-relation',
                'source-track',
                'remote-root',
                'remixOf',
              ),
            ]
          : []),
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
  return { fetchMock, postBodies }
}
