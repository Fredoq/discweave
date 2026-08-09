import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  candidateResponse,
  deferred,
  externalCandidateResponse,
  mediumCandidate,
  renderDiscoveryDialog,
  sourceTrackFixture,
} from './OriginalTrackDiscoveryDialog.testUtils'

describe('OriginalTrackDiscoveryDialog accessibility', () => {
  it('presents external review as a release choice without technical evidence', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog({
      loadCandidates: () =>
        Promise.resolve(candidateResponse([mediumCandidate()])),
      loadExternalCandidates: () =>
        Promise.resolve(externalCandidateResponse()),
    })
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('radio', {
        name: /MusicBrainz Original/,
      }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )

    expect(
      within(dialog).getByRole('heading', { level: 3, name: 'Choose release' }),
    ).toHaveFocus()
    expect(dialog).not.toHaveTextContent('Inference')
    expect(dialog).not.toHaveTextContent('Candidate evidence')
    expect(dialog).not.toHaveTextContent(
      'Release review is not available in this build',
    )
    expect(
      within(dialog).queryByRole('group', { name: 'Choose relation type' }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', {
        name: 'Confirm local relationship',
      }),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeEnabled()
    expect(
      within(dialog).getByRole('region', { name: 'Release routes' }),
    ).toHaveTextContent('First Release')
    expect(
      within(dialog).getByRole('button', { name: 'Create release draft' }),
    ).toBeEnabled()

    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    const restored = within(dialog).getByRole('radio', {
      name: /MusicBrainz Original/,
    })
    await waitFor(() => expect(restored).toHaveFocus())
    expect(restored).toBeChecked()
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Find original...' }),
      ).toHaveFocus(),
    )
    expect(dialog).not.toHaveAttribute('open')
  })

  it('carries the selected concrete release into import review', async () => {
    const external = externalCandidateResponse()
    const firstRoute = external.items[0].releaseRoutes[0]
    if (!firstRoute) throw new Error('Expected an external release route')
    external.items[0].releaseRoutes = [
      firstRoute,
      {
        ...firstRoute,
        releaseSource: {
          ...firstRoute.releaseSource,
          externalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          sourceUrl:
            'https://musicbrainz.org/release/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        },
        title: 'Second Release',
        date: { year: 1982, month: null, day: null },
        mediumPosition: '2',
        musicBrainzTrackMbid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      },
    ]
    const user = userEvent.setup()
    renderDiscoveryDialog({
      loadCandidates: () =>
        Promise.resolve(candidateResponse([mediumCandidate()])),
      loadExternalCandidates: () => Promise.resolve(external),
    })
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('radio', {
        name: /First Release/,
      }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )

    const createDraft = within(dialog).getByRole('button', {
      name: 'Create release draft',
    })
    expect(createDraft).toBeVisible()
    expect(createDraft).toBeEnabled()
    expect(
      within(dialog).getByRole('radio', { name: /First Release/ }),
    ).toBeChecked()
  })

  it('preserves a local selection and scroll when release results append', async () => {
    const external = deferred<ReturnType<typeof externalCandidateResponse>>()
    const user = userEvent.setup()
    renderDiscoveryDialog({
      loadCandidates: () =>
        Promise.resolve(candidateResponse([mediumCandidate()])),
      loadExternalCandidates: () => external.promise,
    })
    const dialog = await screen.findByRole('dialog')
    const localRadio = await within(dialog).findByRole('radio', {
      name: /Earlier Version/,
    })
    await user.click(localRadio)
    const candidatePane = within(dialog).getByRole('region', {
      name: 'Ranked original-track candidates',
    })
    Object.defineProperty(candidatePane, 'scrollTop', {
      configurable: true,
      value: 121,
      writable: true,
    })
    fireEvent.scroll(candidatePane)
    localRadio.focus()

    const response = externalCandidateResponse()
    response.items[0].localTrackId = 'medium-track'
    response.items[0].origins = ['local', 'musicbrainz', 'discogs']
    await act(async () => {
      external.resolve(response)
      await external.promise
    })

    expect(localRadio).toBeChecked()
    expect(localRadio).toHaveFocus()
    expect(
      within(dialog).getByRole('radio', { name: /First Release/ }),
    ).not.toBeChecked()
    expect(candidatePane.scrollTop).toBe(121)
  })

  it('uses native dialog, labelled steps, and separately named radio groups', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog', {
      name: 'Find original for Source Mix',
    })

    expect(dialog.tagName).toBe('DIALOG')
    expect(dialog).toHaveAttribute(
      'aria-labelledby',
      'original-track-discovery-title',
    )
    expect(dialog).toHaveAttribute('data-layout', 'wide')
    expect(dialog).toHaveAttribute('data-step', 'candidates')
    expect(
      within(dialog).getByRole('group', {
        name: 'Choose an original track',
      }),
    ).toBeVisible()

    await user.click(
      await within(dialog).findByRole('radio', { name: /Original Cut/ }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )

    expect(dialog).toHaveAttribute('data-step', 'review')
    const reviewTitle = within(dialog).getByRole('heading', {
      level: 3,
      name: 'Review local relationship',
    })
    await waitFor(() => expect(reviewTitle).toHaveFocus())
    expect(reviewTitle).toHaveAttribute(
      'id',
      'original-track-discovery-review-title',
    )
    const relationGroup = within(dialog).getByRole('group', {
      name: 'Choose relation type',
    })
    expect(within(relationGroup).getAllByRole('radio')).toHaveLength(2)
  })

  it('keeps Low candidates keyboard-operable without extra acknowledgement', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')
    const lowRadio = await within(dialog).findByRole('radio', {
      name: /Uncertain Local Match/,
    })
    expect(lowRadio).toBeEnabled()
    lowRadio.focus()
    await user.keyboard('{Enter}')
    expect(lowRadio).toBeChecked()
    expect(
      within(dialog).queryByRole('checkbox', {
        name: /I understand this is a weak match/i,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    ).toBeEnabled()
  })

  it('preserves selection, relation, and scroll on Back then focuses the candidate', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')
    const candidate = await within(dialog).findByRole('radio', {
      name: /Earlier Version/,
    })
    await user.click(candidate)
    const candidatePane = within(dialog).getByRole('region', {
      name: 'Ranked original-track candidates',
    })
    Object.defineProperty(candidatePane, 'scrollTop', {
      configurable: true,
      value: 137,
      writable: true,
    })
    fireEvent.scroll(candidatePane)
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )
    await user.click(within(dialog).getByRole('radio', { name: 'Remix of' }))
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))

    const restoredCandidate = within(dialog).getByRole('radio', {
      name: /Earlier Version/,
    })
    await waitFor(() => expect(restoredCandidate).toHaveFocus())
    expect(restoredCandidate).toBeChecked()
    expect(
      within(dialog).getByRole('region', {
        name: 'Ranked original-track candidates',
      }).scrollTop,
    ).toBe(137)

    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )
    expect(
      within(dialog).getByRole('radio', { name: 'Remix of' }),
    ).toBeChecked()
  })

  it('prevents native cancel, closes on Escape, and restores trigger focus', async () => {
    const view = renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')
    const cancelEvent = new Event('cancel', {
      bubbles: false,
      cancelable: true,
    })

    act(() => {
      dialog.dispatchEvent(cancelEvent)
    })

    expect(cancelEvent.defaultPrevented).toBe(true)
    await waitFor(() => expect(view.findOriginalButton).toHaveFocus())
    expect(dialog).not.toHaveAttribute('open')
  })

  it('restores the invoking Track action after the explicit Close control', async () => {
    const user = userEvent.setup()
    const view = renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Close original-track discovery',
      }),
    )

    await waitFor(() => expect(view.findOriginalButton).toHaveFocus())
    expect(dialog).not.toHaveAttribute('open')
  })

  it('focuses the persistent title when a different source opens in place', async () => {
    const user = userEvent.setup()
    const view = renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('radio', {
        name: /Original Cut/,
      }),
    )
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Continue to review',
      }),
    )
    await waitFor(() =>
      expect(
        within(dialog).getByRole('heading', {
          level: 3,
          name: 'Review local relationship',
        }),
      ).toHaveFocus(),
    )

    await act(async () => {
      await view.openSource(
        sourceTrackFixture({
          id: 'replacement-source',
          title: 'Replacement Source',
        }),
      )
    })

    const title = within(dialog).getByRole('heading', {
      level: 2,
      name: 'Find original for Replacement Source',
    })
    expect(dialog).toHaveAttribute('data-step', 'candidates')
    await waitFor(() => expect(title).toHaveFocus())
  })
})
