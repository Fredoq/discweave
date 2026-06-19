import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('Review Workbench workspace', () => {
  it('adds sidebar navigation and loads the active review queue after refresh', async () => {
    window.history.pushState({}, '', '/catalog')
    const fetchMock = mockReviewWorkbenchFetch({
      list: reviewListResponse({
        items: [releaseIssue(), trackIssue()],
        summary: reviewSummary({ active: 2, open: 2 }),
      }),
      refresh: reviewRefreshResponse({
        generatedSignals: 2,
        summary: reviewSummary({ active: 2, open: 2 }),
      }),
    })
    const user = h.userEvent.setup()

    h.render(<h.App />)
    await user.click(h.screen.getByRole('link', { name: 'Review Workbench' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Review Workbench' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('2 active')).toBeInTheDocument()
    expect(h.screen.getByText('2 open')).toBeInTheDocument()
    expect(h.screen.getByText('0 relation gaps')).toBeInTheDocument()
    expect(
      h.screen.getByRole('row', { name: /Release missing label: SAW 85-92/i }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('row', { name: /Track missing duration: Xtal/i }),
    ).toBeInTheDocument()

    expect(fetchUrls(fetchMock)).toEqual([
      '/api/review-workbench/refresh',
      '/api/review-workbench/items?state=active&limit=100&offset=0',
    ])
  })

  it('keeps category and state filters in the URL and reloads the queue', async () => {
    window.history.pushState({}, '', '/review-workbench')
    const fetchMock = mockReviewWorkbenchFetch({
      list: reviewListResponse({
        items: [releaseIssue()],
        summary: reviewSummary({ active: 1, open: 1, dismissed: 1 }),
      }),
      refresh: reviewRefreshResponse({
        generatedSignals: 2,
        summary: reviewSummary({ active: 1, open: 1, dismissed: 1 }),
      }),
      nextLists: [
        reviewListResponse({
          items: [formatGapIssue()],
          summary: reviewSummary({ active: 1, open: 1, dismissed: 1 }),
        }),
        reviewListResponse({
          items: [dismissedIssue()],
          summary: reviewSummary({ active: 1, open: 1, dismissed: 1 }),
        }),
      ],
    })
    const user = h.userEvent.setup()

    h.render(<h.App />)
    await h.screen.findByText('Release missing label: SAW 85-92')

    await user.selectOptions(
      h.screen.getByLabelText('Review category'),
      'formatGaps',
    )

    await h.screen.findByText('Physical copy without digital copy')
    expect(window.location.search).toBe('?category=formatGaps')

    await user.selectOptions(
      h.screen.getByLabelText('Review state'),
      'dismissed',
    )

    await h.screen.findByText('Dismissed duplicate release')
    expect(window.location.search).toBe('?category=formatGaps&state=dismissed')
    expect(fetchUrls(fetchMock)).toContain(
      '/api/review-workbench/items?category=formatGaps&state=dismissed&limit=100&offset=0',
    )
  })

  it('updates triage state and hides items that leave the active queue', async () => {
    window.history.pushState({}, '', '/review-workbench')
    const fetchMock = mockReviewWorkbenchFetch({
      list: reviewListResponse({
        items: [releaseIssue()],
        summary: reviewSummary({ active: 1, open: 1 }),
      }),
      refresh: reviewRefreshResponse({
        generatedSignals: 1,
        summary: reviewSummary({ active: 1, open: 1 }),
      }),
      patches: [dismissedIssue()],
      nextLists: [
        reviewListResponse({
          items: [],
          summary: reviewSummary({ dismissed: 1 }),
        }),
      ],
    })
    const user = h.userEvent.setup()

    h.render(<h.App />)
    await user.click(
      await h.screen.findByRole('button', {
        name: 'Dismiss Release missing label: SAW 85-92',
      }),
    )

    await h.waitFor(() => {
      expect(
        h.screen.queryByText('Release missing label: SAW 85-92'),
      ).not.toBeInTheDocument()
    })
    expect(window.location.search).toBe('')
    expect(
      fetchCall(fetchMock, '/api/review-workbench/items/key-release/state'),
    ).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ state: 'dismissed' }),
    })
  })

  it('reopens explicitly filtered dismissed items', async () => {
    window.history.pushState({}, '', '/review-workbench?state=dismissed')
    const fetchMock = mockReviewWorkbenchFetch({
      list: reviewListResponse({
        items: [dismissedIssue()],
        summary: reviewSummary({ dismissed: 1 }),
      }),
      refresh: reviewRefreshResponse({
        generatedSignals: 1,
        summary: reviewSummary({ dismissed: 1 }),
      }),
      patches: [
        { ...dismissedIssue(), state: 'reopened', reason: 'reopenedByUser' },
      ],
      nextLists: [
        reviewListResponse({
          items: [],
          summary: reviewSummary({ active: 1, reopened: 1 }),
        }),
      ],
    })
    const user = h.userEvent.setup()

    h.render(<h.App />)
    await user.click(
      await h.screen.findByRole('button', {
        name: 'Reopen Dismissed duplicate release',
      }),
    )

    await h.waitFor(() => {
      expect(
        h.screen.queryByText('Dismissed duplicate release'),
      ).not.toBeInTheDocument()
    })
    expect(window.location.search).toBe('?state=dismissed')
    expect(
      fetchCall(fetchMock, '/api/review-workbench/items/key-dismissed/state'),
    ).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ state: 'reopened' }),
    })
  })

  it('opens supported catalog targets through same-shell query routes', async () => {
    window.history.pushState({}, '', '/review-workbench')
    mockReviewWorkbenchFetch({
      list: reviewListResponse({
        items: [releaseIssue(), trackIssue(), ownedItemIssue()],
        summary: reviewSummary({ active: 3, open: 3 }),
      }),
      refresh: reviewRefreshResponse({
        generatedSignals: 3,
        summary: reviewSummary({ active: 3, open: 3 }),
      }),
    })
    const user = h.userEvent.setup()

    h.render(<h.App />)
    await user.click(
      await h.screen.findByRole('button', {
        name: 'Open target Release missing label: SAW 85-92',
      }),
    )

    expect(window.location.pathname).toBe('/releases')
    expect(window.location.search).toBe('?release=selected-ambient-works-85-92')
  })

  it('shows a retryable error panel and rejects leaked collection ids', async () => {
    window.history.pushState({}, '', '/review-workbench')
    const fetchMock = mockReviewWorkbenchFetch({
      list: h.jsonResponse({
        collectionId: 'collection-leak',
        items: [],
        limit: 100,
        offset: 0,
        total: 0,
        summary: reviewSummary({}),
      }),
      refresh: reviewRefreshResponse({
        generatedSignals: 0,
        summary: reviewSummary({}),
      }),
      nextLists: [
        reviewListResponse({
          items: [],
          summary: reviewSummary({}),
        }),
      ],
    })
    const user = h.userEvent.setup()

    h.render(<h.App />)

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Review Workbench data could not be loaded.',
    )

    await user.click(h.screen.getByRole('button', { name: 'Retry' }))

    expect(
      await h.screen.findByText('No review items match these filters.'),
    ).toBeInTheDocument()
    expect(fetchUrls(fetchMock)).toEqual([
      '/api/review-workbench/refresh',
      '/api/review-workbench/items?state=active&limit=100&offset=0',
      '/api/review-workbench/refresh',
      '/api/review-workbench/items?state=active&limit=100&offset=0',
    ])
  })
})

function mockReviewWorkbenchFetch({
  list,
  nextLists = [],
  patches = [],
  refresh,
}: {
  list: Response
  nextLists?: Response[]
  patches?: unknown[]
  refresh: Response
}) {
  const queuedLists = [list, ...nextLists]
  const queuedPatches = [...patches]
  const fetchMock = h.vi.fn<Window['fetch']>(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    await Promise.resolve()

    if (url === '/api/review-workbench/refresh' && init?.method === 'POST') {
      return refresh.clone()
    }

    if (
      url.startsWith('/api/review-workbench/items/') &&
      init?.method === 'PATCH'
    ) {
      return h.jsonResponse(queuedPatches.shift() ?? releaseIssue())
    }

    if (
      url.startsWith('/api/review-workbench/items?') &&
      (!init?.method || init.method === 'GET')
    ) {
      const response = queuedLists.shift()
      if (!response) {
        throw new Error(`Unexpected Review Workbench list request: ${url}`)
      }

      return response
    }

    throw new Error(`Unexpected request: ${url}`)
  })
  h.vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function reviewListResponse({
  items,
  summary,
}: {
  items: unknown[]
  summary: ReviewSummary
}) {
  return h.jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
    summary,
  })
}

function reviewRefreshResponse({
  generatedSignals,
  summary,
}: {
  generatedSignals: number
  summary: ReviewSummary
}) {
  return h.jsonResponse({
    generatedSignals,
    created: generatedSignals,
    updated: 0,
    systemResolved: 0,
    summary,
  })
}

function reviewSummary(overrides: Partial<ReviewSummary>): ReviewSummary {
  return {
    active: 0,
    dismissed: 0,
    open: 0,
    reopened: 0,
    resolved: 0,
    ...overrides,
  }
}

type ReviewSummary = {
  active: number
  dismissed: number
  open: number
  reopened: number
  resolved: number
}

function releaseIssue() {
  return {
    stableKey: 'key-release',
    category: 'missingMetadata',
    subtype: 'releasesMissingLabel',
    title: 'Release missing label: SAW 85-92',
    state: 'open',
    reason: 'detected',
    sourceDetector: 'catalogQuality',
    targets: [
      {
        kind: 'release',
        id: 'selected-ambient-works-85-92',
        title: 'SAW 85-92',
        navigationTarget: {
          kind: 'release',
          id: 'selected-ambient-works-85-92',
          path: '/catalog/releases/selected-ambient-works-85-92',
        },
      },
    ],
    lastSeenAt: '2026-06-17T10:00:00Z',
    updatedAt: '2026-06-17T10:00:00Z',
    navigationTarget: {
      kind: 'release',
      id: 'selected-ambient-works-85-92',
      path: '/catalog/releases/selected-ambient-works-85-92',
    },
  }
}

function trackIssue() {
  return {
    stableKey: 'key-track',
    category: 'missingMetadata',
    subtype: 'tracksMissingDuration',
    title: 'Track missing duration: Xtal',
    state: 'open',
    reason: 'detected',
    sourceDetector: 'catalogQuality',
    targets: [{ kind: 'track', id: 'track-1', title: 'Xtal' }],
    lastSeenAt: '2026-06-17T10:01:00Z',
    updatedAt: '2026-06-17T10:01:00Z',
    navigationTarget: {
      kind: 'track',
      id: 'track-1',
      path: '/catalog/tracks/track-1',
    },
  }
}

function ownedItemIssue() {
  return {
    stableKey: 'key-owned',
    category: 'formatGaps',
    subtype: 'needsDigitization',
    title: 'Item needs digitization',
    state: 'open',
    reason: 'detected',
    sourceDetector: 'catalogQuality',
    targets: [{ kind: 'ownedItem', id: 'owned-1', title: 'Vinyl copy' }],
    lastSeenAt: '2026-06-17T10:02:00Z',
    updatedAt: '2026-06-17T10:02:00Z',
    navigationTarget: {
      kind: 'ownedItem',
      id: 'owned-1',
      path: '/collection/items/owned-1',
    },
  }
}

function formatGapIssue() {
  return {
    ...ownedItemIssue(),
    stableKey: 'key-format',
    title: 'Physical copy without digital copy',
    subtype: 'physicalWithoutDigital',
  }
}

function dismissedIssue() {
  return {
    ...releaseIssue(),
    stableKey: 'key-dismissed',
    title: 'Dismissed duplicate release',
    category: 'duplicateCandidates',
    subtype: 'duplicateReleases',
    state: 'dismissed',
    reason: 'dismissedByUser',
  }
}

function fetchUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}

function fetchCall(fetchMock: ReturnType<typeof h.mockFetch>, url: string) {
  const call = fetchMock.mock.calls.find(([input]) => input === url)
  if (!call) {
    throw new Error(`Missing fetch call for ${url}`)
  }

  return call[1]
}
