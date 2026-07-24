import { describe, expect, it } from 'vitest'
import type { LocalOriginalCandidateDto } from './features/catalog/api/catalogDtoTypes'
import * as h from './test/appTestHarness'
import {
  listResponse,
  trackRelationResponse,
  trackResponse,
} from './test/trackStacksTestFixtures'

const SOURCE_TRACK_ID = '11111111-1111-4111-8111-111111111111'
const EXISTING_ROOT_ID = '22222222-2222-4222-8222-222222222222'
const EXISTING_MEMBER_ID = '33333333-3333-4333-8333-333333333333'
const STANDALONE_CANDIDATE_ID = '44444444-4444-4444-8444-444444444444'
const EXISTING_RELATION_ID = '55555555-5555-4555-8555-555555555555'
const CREATED_RELATION_ID = '66666666-6666-4666-8666-666666666666'

h.setupAppTestHooks()

describe('App local original-track discovery', () => {
  it('opens discovery for an eligible source through the local candidates endpoint', async () => {
    const fixture = installDiscoveryCatalog({ candidate: 'existing-root' })
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const detail = await sourceDetail()

    await user.click(
      await h.within(detail).findByRole('button', { name: 'Find original...' }),
    )

    expect(
      await h.screen.findByRole('dialog', {
        name: 'Find original for Incoming Mix',
      }),
    ).toHaveAttribute('open')
    expect(
      fixture.fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request).url
        return (
          url === `/api/tracks/${SOURCE_TRACK_ID}/original-candidates/local` &&
          init?.method === 'GET'
        )
      }),
    ).toBe(true)
  })

  it('confirms an existing root, refreshes catalog and stacks, announces, and focuses the detail heading', async () => {
    const fixture = installDiscoveryCatalog({ candidate: 'existing-root' })
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const detail = await sourceDetail()
    const dialog = await openReview(user)
    const initialTrackLoads = fixture.trackLoads()
    const initialStackLoads = fixture.stackLoads()

    await user.click(
      h
        .within(dialog)
        .getByRole('button', { name: 'Confirm local relationship' }),
    )

    await h.waitFor(() => expect(fixture.postBodies).toHaveLength(1))
    expect(JSON.parse(fixture.postBodies[0])).toEqual({
      sourceTrackId: SOURCE_TRACK_ID,
      targetTrackId: EXISTING_ROOT_ID,
      type: 'remixOf',
      markTargetAsOriginal: false,
    })
    await h.waitFor(() => {
      expect(fixture.trackLoads()).toBeGreaterThan(initialTrackLoads)
      expect(fixture.stackLoads()).toBeGreaterThan(initialStackLoads)
    })
    expect(
      await h.screen.findByText(
        'Added Incoming Mix to Original Candidate as Remix.',
      ),
    ).toBeInTheDocument()
    expect(
      h.within(detail).queryByRole('button', { name: 'Find original...' }),
    ).not.toBeInTheDocument()
    const heading = h
      .within(detail)
      .getByRole('heading', { name: 'Incoming Mix' })
    await h.waitFor(() => expect(heading).toHaveFocus())
  })

  it('does not steal focus when a delayed post-confirm stack refresh resolves', async () => {
    const refreshStackGate = deferred<Response>()
    const fixture = installDiscoveryCatalog({
      candidate: 'existing-root',
      refreshStackResponse: refreshStackGate.promise,
    })
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const detail = await sourceDetail()
    const dialog = await openReview(user)

    await user.click(
      h
        .within(dialog)
        .getByRole('button', { name: 'Confirm local relationship' }),
    )
    await h.waitFor(() => expect(fixture.postBodies).toHaveLength(1))
    const heading = h
      .within(detail)
      .getByRole('heading', { name: 'Incoming Mix' })
    await h.waitFor(() => expect(heading).toHaveFocus())

    const trackSearch = h.screen.getByRole('searchbox', {
      name: 'Search tracks',
    })
    await user.click(trackSearch)
    expect(trackSearch).toHaveFocus()

    await h.act(async () => {
      refreshStackGate.resolve(stackResponse(true, 'existing-root'))
      await refreshStackGate.promise
    })

    expect(trackSearch).toHaveFocus()
  })

  it('promotes a standalone candidate in the confirmation request', async () => {
    const fixture = installDiscoveryCatalog({ candidate: 'standalone' })
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await sourceDetail()
    const dialog = await openReview(user)

    await user.click(
      h
        .within(dialog)
        .getByRole('button', { name: 'Confirm local relationship' }),
    )

    await h.waitFor(() => expect(fixture.postBodies).toHaveLength(1))
    expect(JSON.parse(fixture.postBodies[0])).toEqual({
      sourceTrackId: SOURCE_TRACK_ID,
      targetTrackId: STANDALONE_CANDIDATE_ID,
      type: 'versionOf',
      markTargetAsOriginal: true,
    })
  })

  it('does not mutate on Cancel, Close, Escape, or Back', async () => {
    const fixture = installDiscoveryCatalog({ candidate: 'existing-root' })
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const detail = await sourceDetail()

    const cancelDialog = await openDiscovery(user)
    await user.click(
      h.within(cancelDialog).getByRole('button', { name: 'Cancel' }),
    )
    await expectClosedWithTriggerFocus(cancelDialog, detail)
    expect(fixture.postBodies).toHaveLength(0)

    const closeDialog = await openDiscovery(user)
    await user.click(
      h.within(closeDialog).getByRole('button', {
        name: 'Close original-track discovery',
      }),
    )
    await expectClosedWithTriggerFocus(closeDialog, detail)
    expect(fixture.postBodies).toHaveLength(0)

    const escapeDialog = await openDiscovery(user)
    h.act(() => {
      escapeDialog.dispatchEvent(
        new Event('cancel', { bubbles: false, cancelable: true }),
      )
    })
    await expectClosedWithTriggerFocus(escapeDialog, detail)
    expect(fixture.postBodies).toHaveLength(0)

    const backDialog = await openReview(user)
    await user.click(h.within(backDialog).getByRole('button', { name: 'Back' }))
    expect(backDialog).toHaveAttribute('data-step', 'candidates')
    expect(
      h.within(backDialog).getByRole('radio', {
        name: /Original Candidate/,
      }),
    ).toBeChecked()
    expect(fixture.postBodies).toHaveLength(0)
  })

  it('preserves reviewed choices and skips refresh when confirmation is rejected', async () => {
    const fixture = installDiscoveryCatalog({
      candidate: 'standalone',
      rejectConfirmation: true,
    })
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await sourceDetail()
    const dialog = await openReview(user)
    await user.click(h.within(dialog).getByRole('radio', { name: 'Remix' }))
    const initialTrackLoads = fixture.trackLoads()
    const initialStackLoads = fixture.stackLoads()

    await user.click(
      h
        .within(dialog)
        .getByRole('button', { name: 'Confirm local relationship' }),
    )

    expect(
      await h.within(dialog).findByText('Relationship was rejected'),
    ).toBeVisible()
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveAttribute('data-step', 'review')
    expect(dialog).toHaveTextContent('Original Candidate')
    expect(h.within(dialog).getByRole('radio', { name: 'Remix' })).toBeChecked()
    expect(fixture.trackLoads()).toBe(initialTrackLoads)
    expect(fixture.stackLoads()).toBe(initialStackLoads)
  })

  it('keeps discovery available with zero relation types but blocks confirmation', async () => {
    const fixture = installDiscoveryCatalog({
      candidate: 'existing-root',
      relationTypeCodes: [],
    })
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const detail = await sourceDetail()
    expect(
      await h.within(detail).findByRole('button', { name: 'Find original...' }),
    ).toBeVisible()
    const dialog = await openReview(user)

    expect(
      h
        .within(dialog)
        .getByText(
          'No enabled relation types are available. Enable one in Settings before confirming.',
        ),
    ).toBeVisible()
    expect(
      h
        .within(dialog)
        .getByRole('button', { name: 'Confirm local relationship' }),
    ).toBeDisabled()
    expect(fixture.postBodies).toHaveLength(0)
  })

  it('does not expose discovery before the server stack projection resolves', async () => {
    const stackGate = deferred<Response>()
    installDiscoveryCatalog({
      candidate: 'existing-root',
      initialStackResponse: stackGate.promise,
    })
    h.render(<h.App />)
    const detail = await sourceDetail()

    expect(
      h.within(detail).queryByRole('button', { name: 'Find original...' }),
    ).not.toBeInTheDocument()

    await h.act(async () => {
      stackGate.resolve(listResponse([]))
      await stackGate.promise
    })

    expect(
      await h.within(detail).findByRole('button', { name: 'Find original...' }),
    ).toBeVisible()
  })
})

type DiscoveryFixtureOptions = Readonly<{
  candidate: 'existing-root' | 'standalone'
  initialStackResponse?: Promise<Response>
  refreshStackResponse?: Promise<Response>
  relationTypeCodes?: string[]
  rejectConfirmation?: boolean
}>

function installDiscoveryCatalog({
  candidate,
  initialStackResponse,
  refreshStackResponse,
  relationTypeCodes = ['remixOf', 'versionOf'],
  rejectConfirmation = false,
}: DiscoveryFixtureOptions) {
  window.history.pushState({}, '', '/tracks')
  h.clearCatalogForTests()
  let assigned = false
  let stackLoadCount = 0
  let trackLoadCount = 0
  const postBodies: string[] = []
  const fetchMock = h.vi.fn<Window['fetch']>(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    await Promise.resolve()

    if (url === '/api/track-relations/stack' && init?.method === 'POST') {
      postBodies.push(typeof init.body === 'string' ? init.body : '')
      if (rejectConfirmation) {
        return h.jsonResponse(
          {
            code: 'track_stack.rejected',
            message: 'Relationship was rejected',
          },
          409,
        )
      }
      assigned = true
      return h.jsonResponse({}, 201)
    }

    if (
      url === `/api/tracks/${SOURCE_TRACK_ID}/original-candidates/local` &&
      init?.method === 'GET'
    ) {
      return h.jsonResponse({
        sourceTrackId: SOURCE_TRACK_ID,
        hasReliableLocalCandidate: true,
        items: [originalCandidate(candidate)],
      })
    }

    if (url.startsWith('/api/tracks/stacks')) {
      stackLoadCount += 1
      if (stackLoadCount === 1 && initialStackResponse) {
        return initialStackResponse
      }
      if (stackLoadCount === 2 && refreshStackResponse) {
        return refreshStackResponse
      }
      return stackResponse(assigned, candidate)
    }

    if (url.startsWith('/api/settings/track-stack')) {
      return h.jsonResponse({ relationTypeCodes })
    }

    if (url.startsWith('/api/tracks?')) {
      trackLoadCount += 1
      return listResponse([
        trackResponse(SOURCE_TRACK_ID, 'Incoming Mix'),
        trackResponse(EXISTING_ROOT_ID, 'Original Candidate', true),
        trackResponse(EXISTING_MEMBER_ID, 'Existing Member'),
        trackResponse(
          STANDALONE_CANDIDATE_ID,
          'Original Candidate',
          assigned && candidate === 'standalone',
        ),
      ])
    }

    if (url.startsWith('/api/track-relations?')) {
      return listResponse([
        trackRelationResponse(
          EXISTING_RELATION_ID,
          EXISTING_MEMBER_ID,
          EXISTING_ROOT_ID,
          'versionOf',
        ),
        ...(assigned
          ? [
              trackRelationResponse(
                CREATED_RELATION_ID,
                SOURCE_TRACK_ID,
                candidate === 'existing-root'
                  ? EXISTING_ROOT_ID
                  : STANDALONE_CANDIDATE_ID,
                candidate === 'existing-root' ? 'remixOf' : 'versionOf',
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
  return {
    fetchMock,
    postBodies,
    stackLoads: () => stackLoadCount,
    trackLoads: () => trackLoadCount,
  }
}

function originalCandidate(
  kind: DiscoveryFixtureOptions['candidate'],
): LocalOriginalCandidateDto {
  const existingRoot = kind === 'existing-root'
  return {
    candidateKey: `${kind}-candidate`,
    localTrackId: existingRoot ? EXISTING_ROOT_ID : STANDALONE_CANDIDATE_ID,
    title: 'Original Candidate',
    artistDisplay: 'Robin S.',
    durationSeconds: 240,
    versionYear: 1990,
    origins: ['local'],
    confidence: 'high',
    selectable: true,
    isExistingRoot: existingRoot,
    memberCount: existingRoot ? 1 : 0,
    requiresPromotion: !existingRoot,
    suggestedRelationTypeCode: existingRoot ? 'remixOf' : 'versionOf',
    earliestKnownDate: {
      value: '1990',
      precision: 'year',
      complete: true,
    },
    supportingEvidence: [{ code: 'identityMatch', channel: 'localCatalog' }],
    contradictions: [],
    missingEvidence: [],
  }
}

function stackResponse(
  assigned: boolean,
  candidate: DiscoveryFixtureOptions['candidate'],
) {
  const existingMembers = [
    {
      trackId: EXISTING_MEMBER_ID,
      title: 'Existing Member',
      versionYear: 1992,
      relationType: 'versionOf',
      depth: 1,
      isDirect: true,
    },
    ...(assigned && candidate === 'existing-root'
      ? [
          {
            trackId: SOURCE_TRACK_ID,
            title: 'Incoming Mix',
            versionYear: 1993,
            relationType: 'remixOf',
            depth: 1,
            isDirect: true,
          },
        ]
      : []),
  ]
  return listResponse([
    {
      originalTrackId: EXISTING_ROOT_ID,
      originalTitle: 'Original Candidate',
      originalVersionYear: 1990,
      memberCount: existingMembers.length,
      hasCycleIssue: false,
      members: existingMembers,
      issues: [],
    },
    ...(assigned && candidate === 'standalone'
      ? [
          {
            originalTrackId: STANDALONE_CANDIDATE_ID,
            originalTitle: 'Original Candidate',
            originalVersionYear: 1990,
            memberCount: 1,
            hasCycleIssue: false,
            members: [
              {
                trackId: SOURCE_TRACK_ID,
                title: 'Incoming Mix',
                versionYear: 1993,
                relationType: 'versionOf',
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

async function sourceDetail() {
  return h.screen.findByRole('complementary', { name: 'Incoming Mix' })
}

async function openDiscovery(user: ReturnType<typeof h.userEvent.setup>) {
  await user.click(
    await h.screen.findByRole('button', { name: 'Find original...' }),
  )
  const dialog = await h.screen.findByRole('dialog', {
    name: 'Find original for Incoming Mix',
  })
  await h.within(dialog).findByRole('radio', { name: /Original Candidate/ })
  return dialog
}

async function openReview(user: ReturnType<typeof h.userEvent.setup>) {
  const dialog = await openDiscovery(user)
  await user.click(
    h.within(dialog).getByRole('radio', { name: /Original Candidate/ }),
  )
  await user.click(
    h.within(dialog).getByRole('button', { name: 'Continue to review' }),
  )
  return dialog
}

async function expectClosedWithTriggerFocus(
  dialog: HTMLElement,
  detail: HTMLElement,
) {
  await h.waitFor(() => expect(dialog).not.toHaveAttribute('open'))
  await h.waitFor(() =>
    expect(
      h.within(detail).getByRole('button', { name: 'Find original...' }),
    ).toHaveFocus(),
  )
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
