import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const applyGroups: DiscogsApplyGroups = {
  core: true,
  artists: true,
  classification: true,
  labels: true,
  tracklist: true,
}

const currentTracks: DiscogsCurrentTrackForMapping[] = [
  {
    id: 'track-1',
    title: 'Song A',
    fileName: '01 Song A.m4a',
    position: 1,
  },
  {
    id: 'track-2',
    title: 'Song B',
    fileName: '02 Song B.m4a',
    position: 2,
  },
]

const current: DiscogsCurrentRelease = {
  artists: '',
  externalSourceCount: 0,
  genres: '',
  labels: '',
  releaseDate: '',
  title: 'Test release',
  trackCount: 2,
  year: '2000',
}

function detailForTitles(titles: string[]): ExternalMetadataReleaseDetailDto {
  return {
    source: {
      providerName: 'discogs',
      resourceType: 'release',
      externalId: '123',
      sourceUrl: 'https://www.discogs.com/release/123',
      attribution: 'Data provided by Discogs.',
    },
    title: 'Test release',
    artists: [],
    year: 2000,
    trackCount: titles.length,
    labels: [],
    formats: [],
    catalogNumber: null,
    barcodes: [],
    tracklist: [],
    identifiers: [],
    credits: [],
    draft: {
      title: 'Test release',
      type: 'album',
      genres: [],
      year: 2000,
      releaseDate: null,
      artistCredits: [],
      labels: [],
      tracklist: titles.map((title, index) => ({
        title,
        position: index + 1,
        artistCredits: [],
      })),
      externalSources: [],
    },
  }
}

function renderReview(
  detail: ExternalMetadataReleaseDetailDto,
  onApplyDraft: (
    detail: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
    trackMapping?: readonly DiscogsTrackMappingRow[],
    keptTrackIds?: readonly string[],
  ) => boolean | void | Promise<boolean | void>,
) {
  render(
    <DiscogsCandidateReview
      applyGroups={applyGroups}
      current={current}
      detail={detail}
      dictionaries={defaultCatalogDictionaries}
      hasSelectedGroup
      currentTracks={currentTracks}
      onApplyDraft={onApplyDraft}
      onUpdateApplyGroup={vi.fn()}
    />,
  )
}

describe('Discogs partial track mapping review', () => {
  it('allows a Discogs row to be skipped and restored', async () => {
    const user = userEvent.setup()
    const onApplyDraft = vi.fn(() => undefined)
    const detail = detailForTitles(['Song A', 'Song B', 'Video'])
    renderReview(detail, onApplyDraft)

    await user.click(screen.getByRole('button', { name: 'Skip Discogs row 3' }))
    expect(screen.getByText(/1 Discogs row skipped/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeEnabled()

    await user.click(
      screen.getByRole('button', { name: 'Restore Discogs row 3' }),
    )
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeDisabled()
  })

  it('keeps an unmapped local track and allows undoing that decision', async () => {
    const user = userEvent.setup()
    const onApplyDraft = vi.fn(() => undefined)
    const detail = detailForTitles(['Song A'])
    renderReview(detail, onApplyDraft)

    await user.click(
      screen.getAllByRole('button', { name: 'Keep my metadata' })[1],
    )
    expect(screen.getByText('Kept unchanged')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeEnabled()

    await user.click(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    )
    expect(onApplyDraft).toHaveBeenCalledWith(
      detail,
      applyGroups,
      expect.any(Array),
      ['track-2'],
      expect.any(Array),
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(
      screen.getByRole('button', { name: 'Apply selected Discogs fields' }),
    ).toBeDisabled()
  })
})
