import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TrackDetailHeader } from './TrackDetailSections'
import type { TrackRecord } from './tracksData'

describe('TrackDetailHeader', () => {
  it('shows the local file open action without edit access', () => {
    render(
      <TrackDetailHeader
        canUpdateViaDiscogs={false}
        localFileCount={1}
        track={trackRecord()}
        onOpenLocalFiles={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Open local file' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Edit record' }),
    ).not.toBeInTheDocument()
  })

  it('renders the add to stack action only when a callback is supplied', () => {
    const { rerender } = render(
      <TrackDetailHeader
        canUpdateViaDiscogs={false}
        localFileCount={0}
        track={trackRecord()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Add to stack...' }),
    ).not.toBeInTheDocument()

    rerender(
      <TrackDetailHeader
        canUpdateViaDiscogs={false}
        localFileCount={0}
        track={trackRecord()}
        onAddToStack={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add to stack...' })).toHaveClass(
      'button',
      'button-primary',
    )
  })

  it('forwards the add to stack button ref and click', async () => {
    const user = userEvent.setup()
    const onAddToStack = vi.fn()
    const addToStackButtonRef = createRef<HTMLButtonElement>()
    render(
      <TrackDetailHeader
        addToStackButtonRef={addToStackButtonRef}
        canUpdateViaDiscogs={false}
        localFileCount={0}
        track={trackRecord()}
        onAddToStack={onAddToStack}
      />,
    )
    const button = screen.getByRole('button', { name: 'Add to stack...' })
    expect(addToStackButtonRef.current).toBe(button)
    await user.click(button)
    expect(onAddToStack).toHaveBeenCalledTimes(1)
  })

  it('renders Find original only when its callback is supplied', () => {
    const { rerender } = render(
      <TrackDetailHeader
        canUpdateViaDiscogs={false}
        localFileCount={0}
        track={trackRecord()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Find original...' }),
    ).not.toBeInTheDocument()

    rerender(
      <TrackDetailHeader
        canUpdateViaDiscogs={false}
        localFileCount={0}
        track={trackRecord()}
        onFindOriginal={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Find original...' }),
    ).toBeVisible()
  })

  it('forwards the Find original ref and click while preserving Add to stack', async () => {
    const user = userEvent.setup()
    const onFindOriginal = vi.fn()
    const findOriginalButtonRef = createRef<HTMLButtonElement>()
    render(
      <TrackDetailHeader
        canUpdateViaDiscogs={false}
        findOriginalButtonRef={findOriginalButtonRef}
        localFileCount={0}
        track={trackRecord()}
        onAddToStack={vi.fn()}
        onFindOriginal={onFindOriginal}
      />,
    )

    const findOriginalButton = screen.getByRole('button', {
      name: 'Find original...',
    })
    expect(findOriginalButtonRef.current).toBe(findOriginalButton)
    expect(
      screen.getByRole('button', { name: 'Add to stack...' }),
    ).toBeVisible()

    await user.click(findOriginalButton)
    expect(onFindOriginal).toHaveBeenCalledTimes(1)
  })
})

function trackRecord(): TrackRecord {
  return {
    id: 'track-a',
    title: 'Track A',
    artist: 'Archive Artist',
    release: {
      title: 'Archive Release',
      artist: 'Archive Artist',
      year: '1992',
      label: 'Archive Label',
    },
    trackNumber: '1',
    duration: '4:00',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
  }
}
