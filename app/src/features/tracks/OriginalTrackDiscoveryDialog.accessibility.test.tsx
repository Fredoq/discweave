import { readFileSync } from 'node:fs'
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

const discoveryStyles = readFileSync(
  'src/features/tracks/original-track-discovery.css',
  'utf8',
)
const externalDiscoveryStyles = readFileSync(
  'src/features/tracks/original-track-discovery-external.css',
  'utf8',
)

describe('OriginalTrackDiscoveryDialog accessibility', () => {
  it('renders external review as read-only evidence with Back and Close', async () => {
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

    expect(dialog).toHaveTextContent(
      'Release review is not available in this build',
    )
    expect(
      within(dialog).getByRole('region', { name: 'Candidate evidence' }),
    ).toHaveTextContent('Directed lineage')
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

  it('preserves focus, selection, expanded evidence, and scroll when a combined provider card appends', async () => {
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
    await user.click(
      within(dialog).getByText('Contradictions for Earlier Version'),
    )
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

    const combinedRadio = within(dialog).getByRole('radio', {
      name: /MusicBrainz Original/,
    })
    expect(combinedRadio).toBeChecked()
    expect(combinedRadio).toHaveFocus()
    expect(dialog).toHaveTextContent('Local + MusicBrainz + Discogs')
    expect(
      within(dialog)
        .getByText('Contradictions for MusicBrainz Original')
        .closest('details'),
    ).toHaveAttribute('open')
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

  it('keeps Low evidence keyboard-operable while only its radio is disabled', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')
    const lowRadio = await within(dialog).findByRole('radio', {
      name: /Uncertain Local Match/,
    })
    const summary = within(dialog).getByText(
      'Missing evidence for Uncertain Local Match',
    )
    const details = summary.closest('details')

    expect(lowRadio).toBeDisabled()
    expect(summary.tagName).toBe('SUMMARY')
    expect(details).not.toHaveAttribute('open')
    summary.focus()
    await user.keyboard('{Enter}')
    expect(details).toHaveAttribute('open')
  })

  it('preserves selection, evidence, relation, and scroll on Back then focuses the candidate', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')
    const candidate = await within(dialog).findByRole('radio', {
      name: /Earlier Version/,
    })
    await user.click(candidate)
    const summary = within(dialog).getByText(
      'Contradictions for Earlier Version',
    )
    await user.click(summary)
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
      within(dialog)
        .getByText('Contradictions for Earlier Version')
        .closest('details'),
    ).toHaveAttribute('open')
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

  it('encodes the approved wide dimensions and 50rem single-column fallback', () => {
    expect(discoveryStyles).toMatch(
      /\.original-track-discovery-dialog\s*\{[^}]*width:\s*min\(70rem,\s*calc\(100vw - 2rem\)\)/s,
    )
    expect(discoveryStyles).toMatch(
      /\.original-track-discovery-dialog\s*\{[^}]*max-height:\s*min\(51rem,\s*calc\(100vh - 2rem\)\)/s,
    )
    expect(discoveryStyles).toMatch(
      /\.original-track-discovery-layout\s*\{[^}]*grid-template-columns:\s*minmax\(18rem,\s*0\.9fr\)\s+minmax\(0,\s*1\.4fr\)/s,
    )
    expect(discoveryStyles).toMatch(/@media\s*\(max-width:\s*50rem\)/)
    expect(discoveryStyles).toMatch(
      /@media\s*\(max-width:\s*50rem\)[\s\S]*\.original-track-discovery-layout\s*\{[^}]*grid-template-columns:\s*1fr/s,
    )
    expect(discoveryStyles).toMatch(
      /@media\s*\(max-width:\s*50rem\)[\s\S]*\.original-track-discovery-candidate-scroll\s*\{[^}]*overflow-y:\s*visible/s,
    )
    expect(discoveryStyles).toMatch(
      /@media\s*\(max-width:\s*50rem\)[\s\S]*\.original-track-discovery-review\s*\{[^}]*overflow:\s*visible/s,
    )
    expect(externalDiscoveryStyles).toMatch(
      /@media\s*\(max-width:\s*50rem\)[\s\S]*\.original-track-discovery-release-routes dl > div\s*\{[^}]*grid-template-columns:\s*1fr/s,
    )
  })
})
