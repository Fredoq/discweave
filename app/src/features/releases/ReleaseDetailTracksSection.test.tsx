import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { trackRecords } from '../tracks/tracksData'
import { releaseRecords } from './releasesData'
import { ReleaseDetailTracksSection } from './ReleaseDetailTracksSection'

const release = releaseRecords[0]
const track = trackRecords[0]

describe('ReleaseDetailTracksSection quick open', () => {
  it('keeps Track navigation and invokes the quick-open callback', async () => {
    const user = userEvent.setup()
    const onOpenTrackLocalFiles = vi.fn()

    render(
      <ReleaseDetailTracksSection
        onOpenTrackLocalFiles={onOpenTrackLocalFiles}
        ratingCriteria={[]}
        release={release}
        tracks={[track]}
      />,
    )

    expect(screen.getByRole('link', { name: 'Polynomial-C' })).toHaveAttribute(
      'href',
      '/tracks?track=polynomial-c',
    )

    const button = screen.getByRole('button', {
      name: 'Open Polynomial-C in default player',
    })
    expect(button).toHaveAttribute('title', 'Open in default player')

    await user.click(button)

    expect(onOpenTrackLocalFiles).toHaveBeenCalledWith(track, release)
  })

  it('hides the action when no file belongs to the selected Release', () => {
    const otherReleaseTrack = {
      ...track,
      digitalFiles: track.digitalFiles.map((file) => ({
        ...file,
        releaseId: 'selected-ambient-works-reissue',
      })),
    }

    render(
      <ReleaseDetailTracksSection
        onOpenTrackLocalFiles={vi.fn()}
        ratingCriteria={[]}
        release={release}
        tracks={[otherReleaseTrack]}
      />,
    )

    expect(
      screen.queryByRole('button', {
        name: 'Open Polynomial-C in default player',
      }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['a blank path', { path: ' ' }],
    ['a blank local audio file ID', { localAudioFileId: ' ' }],
  ])('hides the action for %s', (_caseName, digitalFileOverrides) => {
    const invalidFileTrack = {
      ...track,
      digitalFiles: track.digitalFiles.map((file) => ({
        ...file,
        ...digitalFileOverrides,
      })),
    }

    render(
      <ReleaseDetailTracksSection
        onOpenTrackLocalFiles={vi.fn()}
        ratingCriteria={[]}
        release={release}
        tracks={[invalidFileTrack]}
      />,
    )

    expect(
      screen.queryByRole('button', {
        name: 'Open Polynomial-C in default player',
      }),
    ).not.toBeInTheDocument()
  })

  it('hides the action without a callback and exposes pending state', () => {
    const { rerender } = render(
      <ReleaseDetailTracksSection
        ratingCriteria={[]}
        release={release}
        tracks={[track]}
      />,
    )

    expect(
      screen.queryByRole('button', {
        name: 'Open Polynomial-C in default player',
      }),
    ).not.toBeInTheDocument()

    rerender(
      <ReleaseDetailTracksSection
        openingTrackId={track.id}
        onOpenTrackLocalFiles={vi.fn()}
        ratingCriteria={[]}
        release={release}
        tracks={[track]}
      />,
    )

    const pendingButton = screen.getByRole('button', {
      name: 'Open Polynomial-C in default player',
    })
    expect(pendingButton).toBeDisabled()
    expect(pendingButton).toHaveAttribute('aria-busy', 'true')
  })
})
