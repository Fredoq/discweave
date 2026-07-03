import { render, screen } from '@testing-library/react'
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
