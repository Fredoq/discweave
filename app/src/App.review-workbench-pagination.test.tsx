import { beforeEach, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import type { ReviewWorkbenchItem } from './features/reviewWorkbench/reviewWorkbenchApi'

h.setupAppTestHooks()
beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/review-workbench')
})

it('uses global category counts and navigates every page with browser history', async () => {
  const fetchMock = mockQueue()
  const user = h.userEvent.setup()
  h.render(<h.App />)
  expect(await h.screen.findByText('1–100 of 205 results')).toBeInTheDocument()
  expect(h.screen.getByText('205 duplicate candidates')).toBeInTheDocument()
  expect(h.screen.getByText('7 format gaps')).toBeInTheDocument()
  expect(h.screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  expect(h.screen.getByLabelText('Review focus')).toHaveValue('actionable')
  await user.click(h.screen.getByRole('button', { name: 'Next page' }))
  expect(
    await h.screen.findByText('101–200 of 205 results'),
  ).toBeInTheDocument()
  expect(window.location.search).toBe('?offset=100')
  await user.click(h.screen.getByRole('button', { name: 'Next page' }))
  expect(
    await h.screen.findByText('201–205 of 205 results'),
  ).toBeInTheDocument()
  expect(h.screen.getByText('205 duplicate candidates')).toBeInTheDocument()
  expect(h.screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await traverseHistory('back')
  expect(
    await h.screen.findByText('101–200 of 205 results'),
  ).toBeInTheDocument()
  await traverseHistory('forward')
  expect(
    await h.screen.findByText('201–205 of 205 results'),
  ).toBeInTheDocument()
  await user.click(h.screen.getByRole('button', { name: 'Previous page' }))
  expect(
    await h.screen.findByText('101–200 of 205 results'),
  ).toBeInTheDocument()
  expect(
    listUrls(fetchMock).every(
      (url) => url.searchParams.get('focus') === 'actionable',
    ),
  ).toBe(true)
})

it.each([
  ['Review focus', 'optional', 'focus'],
  ['Review category', 'formatGaps', 'category'],
  ['Review state', 'dismissed', 'state'],
  ['Sort by', 'addedNewest', 'sort'],
])(
  'resets the page when %s changes and retains the other URL filters',
  async (label, value, key) => {
    window.history.replaceState(
      {},
      '',
      '/review-workbench?focus=all&category=duplicateCandidates&state=open&sort=addedOldest&offset=100',
    )
    const fetchMock = mockQueue()
    h.render(<h.App />)
    await h.screen.findByText('101–200 of 205 results')
    await h.userEvent
      .setup()
      .selectOptions(h.screen.getByLabelText(label), value)
    await h.screen.findByText('1–100 of 205 results')
    expect(new URLSearchParams(window.location.search).has('offset')).toBe(
      false,
    )
    const params = listUrls(fetchMock).at(-1)!.searchParams
    expect(params.get(key)).toBe(value)
    expect(params.get('offset')).toBe('0')
    if (key !== 'focus') expect(params.get('focus')).toBe('all')
    if (key !== 'state') expect(params.get('state')).toBe('open')
  },
)

it('recovers the last page after dismissing its final row without losing the URL filters', async () => {
  window.history.replaceState(
    {},
    '',
    '/review-workbench?focus=all&category=duplicateCandidates',
  )
  window.history.pushState(
    {},
    '',
    '/review-workbench?focus=all&category=duplicateCandidates&offset=100',
  )
  window.history.pushState(
    {},
    '',
    '/review-workbench?focus=all&category=duplicateCandidates&offset=200',
  )
  window.history.replaceState(
    {},
    '',
    '/review-workbench?focus=all&category=duplicateCandidates&offset=200',
  )
  mockQueue({ total: 201 })
  const user = h.userEvent.setup()
  h.render(<h.App />)
  await h.screen.findByText('201–201 of 201 results')
  await user.click(
    h.screen.getByRole('button', { name: 'Dismiss Candidate 201' }),
  )
  expect(
    await h.screen.findByText('101–200 of 200 results'),
  ).toBeInTheDocument()
  expect(window.location.search).toBe(
    '?focus=all&category=duplicateCandidates&offset=100',
  )
  await traverseHistory('back')
  await h.waitFor(() =>
    expect(window.location.search).toBe(
      '?focus=all&category=duplicateCandidates&offset=100',
    ),
  )
  await traverseHistory('back')
  expect(await h.screen.findByText('1–100 of 200 results')).toBeInTheDocument()
})

it('ignores a delayed old page response after the focus changes', async () => {
  let releasePage: ((response: Response) => void) | undefined
  mockQueue({
    intercept: (params) => {
      if (
        params.get('offset') === '100' &&
        params.get('focus') === 'actionable'
      ) {
        return new Promise((resolve) => {
          releasePage = resolve
        })
      }
    },
  })
  const user = h.userEvent.setup()
  h.render(<h.App />)
  await h.screen.findByText('1–100 of 205 results')
  await user.click(h.screen.getByRole('button', { name: 'Next page' }))
  await h.waitFor(() => expect(releasePage).toBeDefined())
  expect(
    h.screen.queryByRole('button', { name: 'Dismiss Candidate 1' }),
  ).not.toBeInTheDocument()
  await user.selectOptions(h.screen.getByLabelText('Review focus'), 'optional')
  await h.screen.findByText('1–100 of 205 results')
  await h.act(async () => {
    await Promise.resolve()
    releasePage!(h.jsonResponse(page(205, 100)))
  })
  expect(h.screen.getByText('1–100 of 205 results')).toBeInTheDocument()
  expect(h.screen.queryByText('101–200 of 205 results')).not.toBeInTheDocument()
  expect(window.location.search).toBe('?focus=optional')
})

it('reloads the current filter after a delayed mutation rather than restoring the old page', async () => {
  let finishPatch: ((response: Response) => void) | undefined
  mockQueue({
    patch: () =>
      new Promise((resolve) => {
        finishPatch = resolve
      }),
  })
  const user = h.userEvent.setup()
  h.render(<h.App />)
  await h.screen.findByText('1–100 of 205 results')
  await user.click(
    h.screen.getByRole('button', { name: 'Dismiss Candidate 1' }),
  )
  expect(
    h.screen.getByRole('button', { name: 'Dismiss Candidate 2' }),
  ).toBeDisabled()
  await user.selectOptions(h.screen.getByLabelText('Review focus'), 'optional')
  await h.screen.findByText('1–100 of 205 results')
  await h.act(async () => {
    await Promise.resolve()
    finishPatch!(h.jsonResponse(issue(1)))
  })
  await h.screen.findByText('1–100 of 204 results')
  expect(window.location.search).toBe('?focus=optional')
})

it('recovers an out-of-range deep link and retries a failed page without losing filters', async () => {
  window.history.replaceState(
    {},
    '',
    '/review-workbench?state=dismissed&offset=999',
  )
  let failed = false
  mockQueue({
    intercept: (params) => {
      if (params.get('offset') === '200' && !failed) {
        failed = true
        return Promise.reject(new Error('Temporary failure'))
      }
    },
  })
  const user = h.userEvent.setup()
  h.render(<h.App />)
  expect(await h.screen.findByRole('alert')).toHaveTextContent(
    'Review Workbench data could not be loaded.',
  )
  expect(window.location.search).toBe('?state=dismissed&offset=200')
  await user.click(h.screen.getByRole('button', { name: 'Retry' }))
  expect(
    await h.screen.findByText('201–205 of 205 results'),
  ).toBeInTheDocument()
})

function mockQueue({
  total = 205,
  intercept,
  patch,
}: {
  total?: number
  intercept?: (params: URLSearchParams) => Promise<Response> | undefined
  patch?: () => Promise<Response>
} = {}) {
  let count = total
  const fetchMock = h.vi.fn<Window['fetch']>(async (input, init) => {
    const raw = typeof input === 'string' ? input : (input as Request).url
    const url = new URL(raw, window.location.origin)
    if (url.pathname.endsWith('/refresh')) return h.jsonResponse({})
    if (init?.method === 'PATCH') {
      const result = patch ? await patch() : h.jsonResponse(issue(1))
      count--
      return result
    }
    return (
      intercept?.(url.searchParams) ??
      h.jsonResponse(page(count, Number(url.searchParams.get('offset') ?? 0)))
    )
  })
  h.vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function page(total: number, offset: number) {
  return {
    items: Array.from(
      { length: Math.min(100, Math.max(0, total - offset)) },
      (_, index) => issue(offset + index + 1),
    ),
    total,
    offset,
    limit: 100,
    categoryCounts: {
      duplicateCandidates: total,
      formatGaps: 7,
      missingMetadata: 0,
      relationGaps: 0,
      importCleanup: 0,
    },
    summary: {
      active: total + 7,
      open: total + 7,
      reopened: 0,
      dismissed: 0,
      resolved: 0,
    },
  }
}

function issue(index: number): ReviewWorkbenchItem {
  return {
    stableKey: `key-${index}`,
    focus: 'actionable',
    category: 'duplicateCandidates',
    subtype: 'duplicateTracks',
    title: `Candidate ${index}`,
    state: 'open',
    reason: 'detected',
    sourceDetector: 'catalogQuality',
    targets: [],
  }
}

function listUrls(fetchMock: ReturnType<typeof mockQueue>) {
  return fetchMock.mock.calls
    .map(
      ([input]) =>
        new URL(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
          window.location.origin,
        ),
    )
    .filter((url) => url.pathname === '/api/review-workbench/items')
}

async function traverseHistory(direction: 'back' | 'forward') {
  await h.act(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true })
        window.history[direction]()
      }),
  )
}
