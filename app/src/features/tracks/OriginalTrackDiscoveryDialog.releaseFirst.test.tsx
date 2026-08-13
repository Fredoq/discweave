import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ExternalOriginalCandidateLoader } from './useOriginalTrackDiscovery'
import {
  candidateResponse,
  deferred,
  externalCandidateResponse,
  mediumCandidate,
  renderDiscoveryDialog,
} from './OriginalTrackDiscoveryDialog.testUtils'

describe('OriginalTrackDiscoveryDialog release-first results', () => {
  it('presents concrete releases as the primary result with useful edition and track metadata', async () => {
    const quick = externalCandidateResponse()
    const route = quick.items[0].releaseRoutes[0]
    if (!route) throw new Error('Expected a release route')
    route.title = 'Earoica / Anomaly Calling Your Name'
    route.artists = ['Libra Presents Taylor']
    route.labels = ['Musicnow Records']
    route.formats = ['12" Vinyl']
    route.catalogNumber = 'MNR-008'
    route.trackTitle = 'Anomaly Calling Your Name (Original Mix)'
    route.trackPosition = 'B'
    route.trackDurationSeconds = 594

    renderDiscoveryDialog({
      loadCandidates: vi
        .fn()
        .mockResolvedValue(candidateResponse([mediumCandidate()])),
      loadExternalCandidates: vi.fn().mockResolvedValue(quick),
    })

    const dialog = await screen.findByRole('dialog')
    const releases = await within(dialog).findByRole('region', {
      name: 'Release candidates',
    })
    expect(releases).toHaveTextContent('Earoica / Anomaly Calling Your Name')
    expect(releases).toHaveTextContent('Libra Presents Taylor')
    expect(releases).toHaveTextContent('1981-02-03')
    expect(releases).toHaveTextContent('12" Vinyl')
    expect(releases).toHaveTextContent('Musicnow Records')
    expect(releases).toHaveTextContent('MNR-008')
    expect(releases).toHaveTextContent(
      'Track B · Anomaly Calling Your Name (Original Mix) · 9:54',
    )
    expect(
      within(releases).getByRole('link', { name: 'MusicBrainz' }),
    ).toHaveAttribute('href', route.releaseSource.sourceUrl)
    expect(
      within(dialog).getByRole('button', { name: 'Search deeper' }),
    ).toBeEnabled()
    expect(dialog).not.toHaveTextContent(/request and response/i)
    expect(dialog).not.toHaveTextContent(/supporting evidence/i)
  })

  it('shows release-search progress before showing an empty outcome', async () => {
    const quick = deferred<ReturnType<typeof externalCandidateResponse>>()
    renderDiscoveryDialog({
      loadCandidates: vi.fn().mockResolvedValue(candidateResponse([])),
      loadExternalCandidates: vi.fn().mockReturnValue(quick.promise),
    })

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Searching releases…')).toBeVisible()
    expect(dialog).toHaveTextContent(
      'Checking MusicBrainz and Discogs for concrete editions.',
    )
    expect(dialog).not.toHaveTextContent('No reliable original found')

    await act(async () => {
      quick.resolve(
        externalCandidateResponse({
          local: candidateResponse([]),
          items: [],
        }),
      )
      await quick.promise
    })

    expect(
      within(dialog).getByRole('button', { name: 'Search deeper' }),
    ).toBeEnabled()
  })

  it('appends deep track candidates without replacing quick release results', async () => {
    const quick = externalCandidateResponse()
    const deep = externalCandidateResponse()
    deep.items[0] = {
      ...deep.items[0],
      candidateKey:
        'musicbrainz:recording:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      recordingSource: {
        ...deep.items[0].recordingSource,
        externalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      },
      title: 'Deep Recording Match',
      releaseRoutes: [
        {
          ...deep.items[0].releaseRoutes[0],
          releaseSource: {
            ...deep.items[0].releaseRoutes[0].releaseSource,
            externalId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          },
          title: 'Deep Match Release',
        },
      ],
    }
    const deepRequest = deferred<typeof deep>()
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValueOnce(quick)
      .mockReturnValueOnce(deepRequest.promise)
    const user = userEvent.setup()
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn()
        .mockResolvedValue(candidateResponse([mediumCandidate()])),
      loadExternalCandidates,
    })

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('First Release')).toBeVisible()
    await user.click(
      within(dialog).getByRole('button', { name: 'Search deeper' }),
    )
    expect(
      within(dialog).getByRole('button', { name: 'Searching deeper…' }),
    ).toBeDisabled()
    expect(within(dialog).getByRole('main')).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(within(dialog).getByText('First Release')).toBeVisible()

    await act(async () => {
      deepRequest.resolve(deep)
      await deepRequest.promise
    })

    const deepResults = within(dialog).getByRole('region', {
      name: 'Deep search results',
    })
    expect(deepResults).toHaveTextContent('Deep Recording Match')
    expect(within(dialog).getByText('First Release')).toBeVisible()
    expect(loadExternalCandidates).toHaveBeenNthCalledWith(
      2,
      'source-track',
      expect.objectContaining({ searchMode: 'deep' }),
    )
  })

  it('continues directly with the selected concrete release', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn()
        .mockResolvedValue(candidateResponse([mediumCandidate()])),
      loadExternalCandidates: vi
        .fn()
        .mockResolvedValue(externalCandidateResponse()),
    })
    const dialog = await screen.findByRole('dialog')
    const release = await within(dialog).findByRole('radio', {
      name: /First Release/,
    })
    await user.click(release)
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )

    expect(
      within(dialog).getByRole('radio', { name: /First Release/ }),
    ).toBeChecked()
    expect(
      within(dialog).getByRole('button', { name: 'Create release draft' }),
    ).toBeEnabled()
  })
})
