import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  defaultCatalogDictionaries,
  type ExternalMetadataReleaseDetailDto,
} from '../catalog/catalogApi'
import { DiscogsCandidateReview } from './DiscogsCandidateReview'
import { warningText } from './discogsTrackMappingWarning'
import type {
  DiscogsCurrentTrackForMapping,
  DiscogsTrackMappingRow,
} from './discogsTrackMapping'
import type {
  DiscogsApplyGroups,
  DiscogsCurrentRelease,
} from './DiscogsReleaseLookupPanel'

const currentTracks: DiscogsCurrentTrackForMapping[] = [
  {
    id: 'track-1',
    title: 'Another Chance (Original Edit)',
    fileName: '01 Another Chance (Original Edit).m4a',
    position: 1,
  },
  {
    id: 'track-2',
    title: 'Another Chance (Afterlife Mix)',
    fileName: '02 Another Chance (Afterlife Mix).m4a',
    position: 2,
  },
  {
    id: 'track-3',
    title: "Another Chance (S-Man's Dark Nite Mix)",
    fileName: "03 Another Chance (S-Man's Dark Nite Mix).m4a",
    position: 3,
  },
]

const applyGroups: DiscogsApplyGroups = {
  core: true,
  artists: true,
  classification: true,
  labels: true,
  tracklist: true,
}

const current: DiscogsCurrentRelease = {
  artists: '',
  externalSourceCount: 0,
  genres: '',
  labels: '',
  releaseDate: '',
  title: 'Another Chance',
  trackCount: 3,
  year: '1990',
}

const detail: ExternalMetadataReleaseDetailDto = {
  source: {
    providerName: 'discogs',
    resourceType: 'release',
    externalId: '123',
    sourceUrl: 'https://www.discogs.com/release/123',
    attribution: 'Data provided by Discogs.',
  },
  title: 'Another Chance',
  artists: [],
  year: 1990,
  trackCount: 3,
  labels: [],
  formats: [],
  catalogNumber: null,
  barcodes: [],
  tracklist: [],
  identifiers: [],
  credits: [],
  draft: {
    title: 'Another Chance',
    type: 'single',
    genres: [],
    year: 1990,
    releaseDate: null,
    artistCredits: [],
    labels: [],
    tracklist: [
      {
        title: 'Another Chance (Original Mix)',
        position: 1,
        artistCredits: [],
      },
      {
        title: "Another Chance (S-Man's Dark Nite Mix)",
        position: 2,
        artistCredits: [],
      },
      {
        title: 'Another Chance (Afterlife Mix)',
        position: 3,
        artistCredits: [],
      },
    ],
    externalSources: [],
  },
}

const expectedMapping: DiscogsTrackMappingRow[] = [
  {
    currentTrackId: 'track-1',
    currentTrackIndex: 0,
    discogsTrackIndex: 0,
    matchKind: 'review',
    reason: 'Version labels differ',
  },
  {
    currentTrackId: 'track-3',
    currentTrackIndex: 2,
    discogsTrackIndex: 1,
    matchKind: 'exact',
    reason: 'Titles match',
  },
  {
    currentTrackId: 'track-2',
    currentTrackIndex: 1,
    discogsTrackIndex: 2,
    matchKind: 'exact',
    reason: 'Titles match',
  },
]

function renderReview(
  overrides: Partial<{
    applyGroups: DiscogsApplyGroups
    currentTracks: DiscogsCurrentTrackForMapping[]
    detail: ExternalMetadataReleaseDetailDto
    onApplyDraft: (
      detail: ExternalMetadataReleaseDetailDto,
      groups: DiscogsApplyGroups,
      trackMapping?: readonly DiscogsTrackMappingRow[],
    ) => boolean | void | Promise<boolean | void>
  }> = {},
) {
  const onApplyDraft = overrides.onApplyDraft ?? vi.fn(() => undefined)
  const groups = overrides.applyGroups ?? applyGroups
  const currentTrackRows = overrides.currentTracks ?? currentTracks
  const reviewDetail = overrides.detail ?? detail

  render(
    <DiscogsCandidateReview
      applyGroups={groups}
      current={current}
      detail={reviewDetail}
      dictionaries={defaultCatalogDictionaries}
      hasSelectedGroup={Object.values(groups).some(Boolean)}
      currentTracks={currentTrackRows}
      onApplyDraft={onApplyDraft}
      onUpdateApplyGroup={vi.fn()}
    />,
  )

  return onApplyDraft
}

function StatefulReview({
  onApplyDraft,
}: Readonly<{
  onApplyDraft: (
    detail: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
    trackMapping?: readonly DiscogsTrackMappingRow[],
  ) => boolean | void | Promise<boolean | void>
}>) {
  const [groups, setGroups] = useState(applyGroups)

  return (
    <DiscogsCandidateReview
      applyGroups={groups}
      current={current}
      currentTracks={currentTracks}
      detail={detail}
      dictionaries={defaultCatalogDictionaries}
      hasSelectedGroup={Object.values(groups).some(Boolean)}
      onApplyDraft={onApplyDraft}
      onUpdateApplyGroup={(group, checked) =>
        setGroups((previous) => ({ ...previous, [group]: checked }))
      }
    />
  )
}

describe('Discogs track mapping review', () => {
  it('blocks apply until the reviewed match is confirmed', async () => {
    const user = userEvent.setup()
    const onApplyDraft = renderReview()

    expect(
      screen.getByText(
        'Discogs order differs from imported files. 2 tracks will change position; 1 match needs review.',
      ),
    ).toBeVisible()
    expect(screen.getByText('Moves 2 → 3')).toBeVisible()
    expect(screen.getByText('Moves 3 → 2')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeDisabled()
    const blockingMessage = screen.getByText(
      'Review 1 track match to continue.',
    )
    expect(blockingMessage).toHaveAttribute('role', 'alert')
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toHaveAttribute('aria-describedby', blockingMessage.id)

    await user.click(
      screen.getByRole('button', {
        name: 'Confirm match for 01 Another Chance (Original Edit).m4a',
      }),
    )
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeEnabled()

    await user.click(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    )
    expect(onApplyDraft).toHaveBeenCalledWith(
      detail,
      applyGroups,
      expectedMapping,
    )
  })

  it('allows unmatched Discogs rows to be manually assigned one-to-one', async () => {
    const user = userEvent.setup()
    const onApplyDraft = vi.fn(() => undefined)
    const manualDetail = {
      ...detail,
      draft: {
        ...detail.draft,
        tracklist: [
          {
            ...detail.draft.tracklist[0],
            title: currentTracks[0].title,
            position: 1,
          },
          {
            ...detail.draft.tracklist[1],
            title: 'Discogs row two',
            position: 2,
          },
          {
            ...detail.draft.tracklist[2],
            title: 'Discogs row three',
            position: 3,
          },
        ],
      },
    }

    renderReview({ detail: manualDetail, onApplyDraft })

    const firstSelector = screen.getByLabelText(
      'Imported file for Discogs track 1',
    )
    const secondSelector = screen.getByLabelText(
      'Imported file for Discogs track 2',
    )
    const thirdSelector = screen.getByLabelText(
      'Imported file for Discogs track 3',
    )

    expect(firstSelector).toHaveValue('track-1')
    expect(secondSelector).toHaveValue('')
    expect(thirdSelector).toHaveValue('')

    secondSelector.focus()
    await user.selectOptions(secondSelector, 'track-2')
    expect(document.activeElement).toBe(
      screen.getByLabelText('Imported file for Discogs track 2'),
    )
    await user.selectOptions(thirdSelector, 'track-3')
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeEnabled()

    await user.selectOptions(
      screen.getByLabelText('Imported file for Discogs track 3'),
      'track-2',
    )
    expect(
      screen.getByLabelText('Imported file for Discogs track 2'),
    ).toHaveValue('')
    expect(screen.getByText(/moved to another Discogs track/)).toBeVisible()
    expect(
      screen.getByLabelText('Imported file for Discogs track 3'),
    ).toHaveValue('track-2')
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeDisabled()

    await user.selectOptions(
      screen.getByLabelText('Imported file for Discogs track 2'),
      'track-3',
    )
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeEnabled()

    await user.click(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    )

    expect(onApplyDraft).toHaveBeenCalledWith(manualDetail, applyGroups, [
      {
        currentTrackId: 'track-1',
        currentTrackIndex: 0,
        discogsTrackIndex: 0,
        matchKind: 'exact',
        reason: 'Titles match',
      },
      {
        currentTrackId: 'track-3',
        currentTrackIndex: 2,
        discogsTrackIndex: 1,
        matchKind: 'review',
        reason: 'Manually selected imported file',
      },
      {
        currentTrackId: 'track-2',
        currentTrackIndex: 1,
        discogsTrackIndex: 2,
        matchKind: 'review',
        reason: 'Manually selected imported file',
      },
    ])
  })
  it('explains when a confirmed imported file is cleared from a Discogs row', async () => {
    const user = userEvent.setup()
    renderReview()
    await user.click(
      screen.getByRole('button', {
        name: 'Confirm match for 01 Another Chance (Original Edit).m4a',
      }),
    )
    await user.selectOptions(
      screen.getByLabelText('Imported file for Discogs track 1'),
      '',
    )
    expect(screen.getByText('Imported file cleared')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeDisabled()
  })
  it('switches mapping state before passive reset effects run for colliding contexts', async () => {
    const user = userEvent.setup()
    const onApplyDraft = vi.fn(() => undefined)
    const singleCurrent = { ...current, trackCount: 1 }
    const collisionDetail: ExternalMetadataReleaseDetailDto = {
      ...detail,
      draft: {
        ...detail.draft,
        tracklist: [
          {
            ...detail.draft.tracklist[0],
            title: 'Discogs title',
            position: 1,
          },
        ],
      },
    }
    const initialTracks: DiscogsCurrentTrackForMapping[] = [
      {
        id: 'track-immediate',
        title: 'Song1',
        fileName: 'Initial.m4a',
        position: 2,
      },
    ]
    const nextTracks: DiscogsCurrentTrackForMapping[] = [
      {
        id: 'track-immediate',
        title: 'Song',
        fileName: 'Next.m4a',
        position: 12,
      },
    ]
    function ImmediateReview({
      tracks,
    }: Readonly<{ tracks: DiscogsCurrentTrackForMapping[] }>) {
      return (
        <DiscogsCandidateReview
          applyGroups={applyGroups}
          current={singleCurrent}
          currentTracks={tracks}
          detail={collisionDetail}
          dictionaries={defaultCatalogDictionaries}
          hasSelectedGroup
          onApplyDraft={onApplyDraft}
          onUpdateApplyGroup={vi.fn()}
        />
      )
    }
    const view = render(<ImmediateReview tracks={initialTracks} />)
    await user.click(
      screen.getByRole('button', {
        name: 'Confirm match for Initial.m4a',
      }),
    )
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeEnabled()
    view.rerender(<ImmediateReview tracks={nextTracks} />)
    expect(
      screen.getByRole('button', { name: /Apply selected/ }),
    ).toBeDisabled()
  })
  it('describes a no-move review as mapping attention', () => {
    renderReview({
      detail: {
        ...detail,
        draft: {
          ...detail.draft,
          tracklist: [
            {
              title: 'Another Chance (Original Mix)',
              position: 1,
              artistCredits: [],
            },
            {
              title: currentTracks[1].title,
              position: 2,
              artistCredits: [],
            },
            {
              title: currentTracks[2].title,
              position: 3,
              artistCredits: [],
            },
          ],
        },
      },
    })

    expect(
      screen.getByText('Track mapping needs attention. 1 match needs review.'),
    ).toBeVisible()
  })

  it('uses singular grammar for one unmatched track', () => {
    renderReview({
      currentTracks: [
        ...currentTracks,
        {
          id: 'track-4',
          title: 'Another Chance (Bonus Mix)',
          fileName: '04 Another Chance (Bonus Mix).m4a',
          position: 4,
        },
      ],
      detail: {
        ...detail,
        draft: {
          ...detail.draft,
          tracklist: [
            {
              title: currentTracks[0].title,
              position: 1,
              artistCredits: [],
            },
            {
              title: 'Another Chance (Unknown Mix)',
              position: 2,
              artistCredits: [],
            },
          ],
        },
      },
    })

    expect(
      screen.getByText(
        'Track mapping needs attention. 1 track has no safe match.',
      ),
    ).toBeVisible()
  })

  it('blocks an extra imported track even when every Discogs row matched', () => {
    renderReview({
      currentTracks: [
        ...currentTracks,
        {
          id: 'track-4',
          title: 'Another Chance (Bonus Mix)',
          fileName: '04 Another Chance (Bonus Mix).m4a',
          position: 4,
        },
      ],
      detail: {
        ...detail,
        draft: {
          ...detail.draft,
          tracklist: [
            {
              title: currentTracks[0].title,
              position: 1,
              artistCredits: [],
            },
            {
              title: currentTracks[1].title,
              position: 2,
              artistCredits: [],
            },
          ],
        },
      },
    })

    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Imported and Discogs track counts must match. Uncheck Apply Tracklist to apply other fields.',
      ),
    ).toBeVisible()
  })

  it('blocks a non-empty imported tracklist when Discogs has zero rows', () => {
    renderReview({
      detail: {
        ...detail,
        draft: { ...detail.draft, tracklist: [] },
      },
    })

    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Imported and Discogs track counts must match. Uncheck Apply Tracklist to apply other fields.',
      ),
    ).toBeVisible()
  })

  it('allows other Discogs fields after unchecking Tracklist', async () => {
    const user = userEvent.setup()
    const onApplyDraft = vi.fn(() => undefined)
    render(<StatefulReview onApplyDraft={onApplyDraft} />)

    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'Apply Tracklist' }))
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeEnabled()

    await user.click(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    )
    expect(onApplyDraft).toHaveBeenCalledWith(detail, {
      ...applyGroups,
      tracklist: false,
    })
  })

  it('keeps a confirmed match control mounted and focused', async () => {
    const user = userEvent.setup()
    renderReview()

    const confirmButton = screen.getByRole('button', {
      name: 'Confirm match for 01 Another Chance (Original Edit).m4a',
    })
    confirmButton.focus()

    await user.click(confirmButton)

    expect(document.activeElement).toBe(confirmButton)
    expect(confirmButton).toHaveAttribute('aria-disabled', 'true')
    expect(confirmButton).not.toHaveAttribute('disabled')
    expect(confirmButton).toHaveAccessibleName(
      'Match confirmed for 01 Another Chance (Original Edit).m4a',
    )
  })

  it('uses plural grammar for multiple unconfirmed review matches', () => {
    expect(warningText(0, 2, 0)).toBe(
      'Track mapping needs attention. 2 matches need review.',
    )
  })

  it('uses plural grammar for multiple unmatched tracks', () => {
    expect(warningText(0, 0, 2)).toBe(
      'Track mapping needs attention. 2 tracks have no safe match.',
    )
  })
})
