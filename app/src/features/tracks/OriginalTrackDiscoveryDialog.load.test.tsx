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
  it('announces partial provider results and retries only MusicBrainz', async () => {
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
    const user = userEvent.setup()
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
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'MusicBrainz returned partial results',
    )
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'musicbrainz.partial',
    )

    await user.click(
      within(dialog).getByRole('button', { name: 'Retry MusicBrainz' }),
    )

    await waitFor(() => expect(loadExternalCandidates).toHaveBeenCalledTimes(2))
    expect(loadExternalCandidates.mock.calls[1][1].providerCodes).toEqual([
      'musicbrainz',
    ])
    expect(
      within(dialog).queryByText(/partial results/),
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
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Searching MusicBrainz for original recordings',
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
    ).toBeDisabled()
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

  it('shows semantic empty copy only for Low diagnostics and retains their evidence', async () => {
    renderDiscoveryDialog({
      loadCandidates: vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(candidateResponse([lowCandidate()])),
    })

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText('No reliable candidate found'),
    ).toBeVisible()
    expect(
      within(dialog).getByRole('radio', {
        name: /Uncertain Local Match/,
      }),
    ).toBeDisabled()
    expect(
      within(dialog).getByText('Missing evidence for Uncertain Local Match'),
    ).toBeVisible()
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
