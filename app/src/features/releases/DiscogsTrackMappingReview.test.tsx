import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  defaultCatalogDictionaries,
  type ExternalMetadataReleaseDetailDto,
} from '../catalog/catalogApi'
import { DiscogsCandidateReview } from './DiscogsCandidateReview'
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
    expect(screen.getByText('Review 1 track match to continue.')).toBeVisible()

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
    expect(onApplyDraft).toHaveBeenCalledWith(
      detail,
      { ...applyGroups, tracklist: false },
      expectedMapping,
    )
  })
})
