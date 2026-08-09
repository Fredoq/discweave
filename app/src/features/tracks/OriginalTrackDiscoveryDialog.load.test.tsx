import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LocalOriginalCandidateListDto } from '../catalog/api/catalogDtoTypes'
import type {
  ExternalOriginalCandidateLoader,
  OriginalCandidateLoader,
} from './useOriginalTrackDiscovery'
import {
  candidateResponse,
  deferred,
  externalCandidateResponse,
  highCandidate,
  lowCandidate,
  mediumCandidate,
  renderDiscoveryDialog,
} from './OriginalTrackDiscoveryDialog.testUtils'

describe('OriginalTrackDiscoveryDialog loading', () => {
  it('keeps provider failures and diagnostics out of the UI when candidates exist', async () => {
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValueOnce(
        externalCandidateResponse({
          providerStatuses: [
            {
              providerCode: 'musicbrainz',
              outcome: 'unavailable',
              errorCode: 'musicbrainz.unavailable',
              retryAfter: null,
            },
          ],
          warnings: ['musicbrainz.partial'],
        }),
      )
      .mockResolvedValueOnce(externalCandidateResponse())
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([mediumCandidate()])),
      loadExternalCandidates,
    })

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('radio', {
        name: /MusicBrainz Original/,
      }),
    ).toBeEnabled()
    expect(dialog).toHaveTextContent('2 candidates')
    expect(dialog).not.toHaveTextContent(/partial results/i)
    expect(dialog).not.toHaveTextContent('musicbrainz.partial')
    expect(dialog).not.toHaveTextContent(/provider checks/i)
    expect(
      within(dialog).queryByRole('button', { name: 'Retry MusicBrainz' }),
    ).not.toBeInTheDocument()
    expect(loadExternalCandidates).toHaveBeenCalledTimes(1)
  })

  it('does not expose successful-provider warnings when candidates exist', async () => {
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([mediumCandidate()])),
      loadExternalCandidates: vi
        .fn<ExternalOriginalCandidateLoader>()
        .mockResolvedValue(
          externalCandidateResponse({
            warnings: ['musicbrainz.partial'],
          }),
        ),
    })

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('radio', {
        name: /MusicBrainz Original/,
      }),
    ).toBeEnabled()
    expect(dialog).not.toHaveTextContent('musicbrainz.partial')
    expect(
      within(dialog).queryByRole('button', { name: 'Retry MusicBrainz' }),
    ).not.toBeInTheDocument()
  })

  it('shows one human explanation and provider retry only when no candidates exist', async () => {
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValue({
        local: candidateResponse([]),
        items: [],
        providerStatuses: [
          {
            providerCode: 'musicbrainz',
            outcome: 'unavailable',
            errorCode: 'musicbrainz.unavailable',
            retryAfter: null,
          },
        ],
        warnings: ['musicbrainz.operation_budget_exhausted'],
      })
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([])),
      loadExternalCandidates,
    })

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText('No concrete release found yet'),
    ).toBeVisible()
    expect(dialog).toHaveTextContent(
      'You can run a deeper track search or retry a source that did not complete.',
    )
    expect(dialog).not.toHaveTextContent('musicbrainz.unavailable')
    expect(dialog).not.toHaveTextContent(
      'musicbrainz.operation_budget_exhausted',
    )
    expect(
      within(dialog).getByRole('button', { name: 'Retry MusicBrainz' }),
    ).toBeEnabled()
  })

  it('never renders provider requests or mapped response payloads', async () => {
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([lowCandidate()])),
      loadExternalCandidates: vi.fn().mockResolvedValue({
        local: candidateResponse([lowCandidate()]),
        items: [],
        providerStatuses: [
          {
            providerCode: 'musicbrainz',
            outcome: 'succeeded',
            errorCode: null,
            retryAfter: null,
          },
        ],
        warnings: [],
        searchDiagnostics: [
          {
            providerCode: 'musicbrainz',
            requestUrl:
              'https://musicbrainz.org/ws/2/recording?query=recording%3A%22Chase%20The%20Sun%22&limit=5&offset=0&fmt=json',
            totalResults: 0,
            offset: 0,
            items: [],
          },
        ],
      }),
    })

    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveTextContent('MusicBrainz request and response')
    expect(dialog).not.toHaveTextContent(
      'https://musicbrainz.org/ws/2/recording?query=recording%3A%22Chase%20The%20Sun%22&limit=5&offset=0&fmt=json',
    )
    expect(dialog).not.toHaveTextContent('"count": 0')
    expect(dialog).not.toHaveTextContent('"recordings": []')
  })

  it('does not expose raw search-match counts for zero verified candidates', async () => {
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([lowCandidate()])),
      loadExternalCandidates: vi.fn().mockResolvedValue({
        local: candidateResponse([lowCandidate()]),
        items: [],
        providerStatuses: [
          {
            providerCode: 'musicbrainz',
            outcome: 'succeeded',
            errorCode: null,
            retryAfter: null,
          },
        ],
        warnings: [],
        searchDiagnostics: [
          {
            providerCode: 'musicbrainz',
            requestUrl:
              'https://musicbrainz.org/ws/2/recording?query=recording%3A%22Chase%20The%20Sun%22&limit=5&offset=0&fmt=json',
            totalResults: 90,
            offset: 0,
            items: [
              {
                providerItemId: 'recording-1',
                title: 'Chase the Sun',
                artistCredit: 'Planet Funk',
                durationSeconds: 221,
                firstReleaseDate: '2000',
                disambiguation: null,
              },
            ],
          },
        ],
      }),
    })

    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveTextContent(
      'MusicBrainz found 90 search matches, but 0 verified original candidates',
    )
    expect(dialog).not.toHaveTextContent(
      'The returned recordings did not contain an explicit edit or remix lineage',
    )
  })

  it('shows visible search progress instead of a terminal empty result while external discovery is loading', async () => {
    const external = deferred<ReturnType<typeof externalCandidateResponse>>()
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([])),
      loadExternalCandidates: vi.fn().mockReturnValue(external.promise),
    })

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Searching releases…')).toBeVisible()
    expect(dialog).not.toHaveTextContent('No reliable original found')

    await act(async () => {
      external.resolve(
        externalCandidateResponse({
          local: candidateResponse([]),
          items: [],
        }),
      )
      await external.promise
    })

    expect(
      await within(dialog).findByText('No concrete release found yet'),
    ).toBeVisible()
    expect(
      within(dialog).queryByText('Searching releases…'),
    ).not.toBeInTheDocument()
  })

  it('keeps local cards visible while MusicBrainz discovery is loading', async () => {
    const external = deferred<ReturnType<typeof externalCandidateResponse>>()
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([mediumCandidate()])),
      loadExternalCandidates: vi.fn().mockReturnValue(external.promise),
    })

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('radio', { name: /Earlier Version/ }),
    ).toBeEnabled()
    expect(within(dialog).getByText('Searching releases…')).toBeVisible()
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Searching release catalogues',
    )

    await act(async () => {
      external.resolve(externalCandidateResponse())
      await external.promise
    })
    expect(
      await within(dialog).findByRole('radio', {
        name: /MusicBrainz Original/,
      }),
    ).toBeEnabled()
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      '2 candidates found',
    )
    expect(within(dialog).getByRole('status')).not.toHaveTextContent(
      'local candidates',
    )
    expect(
      within(dialog).queryByText('Searching releases…'),
    ).not.toBeInTheDocument()
    expect(dialog).toHaveTextContent('MusicBrainz')
  })

  it('opens in loading state, focuses the persistent title, and announces without refocusing', async () => {
    const loading = deferred<LocalOriginalCandidateListDto>()
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockReturnValue(loading.promise),
    })

    const dialog = await screen.findByRole('dialog', {
      name: 'Find original for Source Mix',
    })
    const title = within(dialog).getByRole('heading', {
      level: 2,
      name: 'Find original for Source Mix',
    })
    const liveStatus = within(dialog).getByRole('status')

    expect(title).toHaveAttribute('id', 'original-track-discovery-title')
    expect(title).toHaveAttribute('tabindex', '-1')
    await waitFor(() => expect(title).toHaveFocus())
    expect(liveStatus).toHaveTextContent(
      'Searching the local collection for candidates',
    )
    expect(liveStatus.closest('[aria-busy="true"]')).toBeNull()

    await act(async () => {
      loading.resolve(candidateResponse())
      await loading.promise
    })

    const group = within(dialog).getByRole('group', {
      name: 'Choose an original track',
    })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(3)
    for (const radio of radios) {
      expect(radio).not.toBeChecked()
    }
    expect(
      within(group).getByRole('radio', { name: /Original Cut/ }),
    ).toBeEnabled()
    expect(
      within(group).getByRole('radio', { name: /Earlier Version/ }),
    ).toBeEnabled()
    expect(
      within(group).getByRole('radio', { name: /Uncertain Local Match/ }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    ).toBeDisabled()
    expect(within(dialog).getAllByText('Local origin')).not.toHaveLength(0)
    expect(dialog).toHaveTextContent('earliest known release: 1982-05')
    expect(dialog).not.toHaveTextContent(
      /MusicBrainz|Discogs|Wanted|import review/i,
    )
    expect(within(dialog).getByRole('status')).toBe(liveStatus)
    expect(title).toHaveFocus()
  })

  it('keeps a selected Low candidate compact and enables review', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([lowCandidate()])),
    })

    const dialog = await screen.findByRole('dialog')
    const lowCandidateRadio = await within(dialog).findByRole('radio', {
      name: /Uncertain Local Match/,
    })
    expect(lowCandidateRadio).toBeEnabled()
    expect(dialog).not.toHaveTextContent('No reliable original found')
    await user.click(lowCandidateRadio)

    expect(dialog).not.toHaveTextContent('Low-confidence diagnostic')
    expect(dialog).not.toHaveTextContent('INFERENCE')
    expect(dialog).not.toHaveTextContent('Supporting evidence')
    expect(dialog).not.toHaveTextContent('Contradictions')
    expect(dialog).not.toHaveTextContent('Missing evidence')
    expect(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    ).toBeEnabled()
  })

  it('shows every concrete release and lets the user select the exact route', async () => {
    const user = userEvent.setup()
    const external = externalCandidateResponse()
    const firstRoute = external.items[0].releaseRoutes[0]
    if (!firstRoute) throw new Error('Expected an external release route')
    external.items[0].releaseRoutes = [
      {
        ...firstRoute,
        releaseSource: {
          ...firstRoute.releaseSource,
          externalId: 'later-release',
          sourceUrl: 'https://musicbrainz.org/release/later-release',
        },
        title: 'Later Release',
        date: { year: 2001, month: null, day: null },
        mediumPosition: '3',
        musicBrainzTrackMbid: 'later-track',
      },
      {
        ...firstRoute,
        title: 'First Release',
        date: { year: 1981, month: 2, day: 3 },
        mediumPosition: '1',
        discogsBinding: {
          releaseSource: {
            providerCode: 'discogs',
            resourceType: 'release',
            externalId: '42',
            sourceUrl: 'https://www.discogs.com/release/42',
            attribution: 'Discogs',
          },
          rowOrdinal: 1,
          position: 'A1',
          fingerprint: 'discogs-row-fingerprint',
        },
      },
    ]
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([mediumCandidate()])),
      loadExternalCandidates: vi
        .fn<ExternalOriginalCandidateLoader>()
        .mockResolvedValue(external),
    })

    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('radio', {
        name: /First Release/,
      }),
    )

    const releaseResults = within(dialog).getByRole('group', {
      name: 'Release candidates',
    })
    expect(releaseResults).toHaveTextContent('First Release')
    expect(releaseResults).toHaveTextContent('1981-02-03')
    expect(releaseResults).toHaveTextContent('Later Release')
    expect(
      within(releaseResults).getByRole('link', { name: 'Discogs' }),
    ).toHaveAttribute('href', 'https://www.discogs.com/release/42')
    expect(
      within(releaseResults).getByRole('radio', { name: /First Release/ }),
    ).toBeChecked()
  })

  it('keeps a Medium result selectable and suppresses semantic empty copy', async () => {
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([mediumCandidate()])),
    })

    const medium = await screen.findByRole('radio', {
      name: /Earlier Version/,
    })
    expect(medium).toBeEnabled()
    expect(
      screen.queryByText('No reliable candidate found'),
    ).not.toBeInTheDocument()
  })

  it('formats hour-long candidate durations with the shared catalog convention', async () => {
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(
          candidateResponse([highCandidate({ durationSeconds: 3_661 })]),
        ),
    })

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('radio', { name: /Original Cut/ }),
    ).toBeEnabled()
    expect(dialog).toHaveTextContent('1:01:01')
    expect(dialog).not.toHaveTextContent('61:01')
  })

  it('retries a local load failure through the same polite live region', async () => {
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockRejectedValueOnce(new Error('Local search unavailable'))
      .mockResolvedValueOnce(candidateResponse([mediumCandidate()]))
    const user = userEvent.setup()
    renderDiscoveryDialog({ loadCandidates })

    const dialog = await screen.findByRole('dialog')
    const liveStatus = within(dialog).getByRole('status')
    expect(
      await within(dialog).findByText('Local search unavailable'),
    ).toBeVisible()

    await user.click(
      within(dialog).getByRole('button', { name: 'Retry local search' }),
    )

    expect(
      await within(dialog).findByRole('radio', { name: /Earlier Version/ }),
    ).toBeEnabled()
    expect(within(dialog).getByRole('status')).toBe(liveStatus)
    expect(loadCandidates).toHaveBeenCalledTimes(2)
  })
})
