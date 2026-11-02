import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import { RecommendedReleaseReview } from './RecommendedReleaseReview'
import { draftValidationMessage } from './importHelpers'

afterEach(cleanup)

function reviewDraft(): ReleaseImportDraft {
  return {
    id: 'recommendation-draft',
    isRecommendedRelease: true,
    sourceKind: 'externalMetadata',
    sourcePath: null,
    relativePath: null,
    status: 'ready',
    title: 'A verified release',
    type: 'album',
    artistNames: ['Artist'],
    selectedArtistIds: [],
    artistSuggestions: [],
    isVariousArtists: false,
    notOnLabel: true,
    createCatalogTracks: false,
    genres: [],
    tags: [],
    issues: [],
    tracks: [],
    collectionItemIntent: { kind: 'newWanted', medium: null },
    externalSources: [
      {
        providerCode: 'discogs',
        resourceType: 'release',
        externalId: '123',
        sourceUrl: 'https://www.discogs.com/release/123',
      },
    ],
  }
}

describe('Recommended release review', () => {
  it('requires an explicit medium and confirmation without exposing track or ownership mutations', async () => {
    const confirm = vi.fn()
    const user = userEvent.setup()
    function Review() {
      const [draft, setDraft] = useState(reviewDraft)
      return (
        <RecommendedReleaseReview
          draft={draft}
          isPending={false}
          actionError={null}
          onChange={setDraft}
          onConfirm={confirm}
          onSkip={vi.fn()}
        />
      )
    }
    render(<Review />)
    expect(
      screen.getByRole('button', { name: 'Review confirmation' }),
    ).toBeDisabled()
    expect(
      screen.queryByRole('option', { name: 'Reuse an owned item' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Create catalog tracks'),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Original recording binding'),
    ).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Medium'), 'vinyl')
    await user.type(screen.getByLabelText('Format description'), '12-inch')
    expect(confirm).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Review confirmation' }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('link', { name: 'View verified release on Discogs' }),
    ).toHaveAttribute('href', 'https://www.discogs.com/release/123')
  })

  it('disables review actions after confirmation or while preflight is pending', () => {
    const draft = reviewDraft()
    draft.collectionItemIntent = {
      kind: 'newWanted',
      medium: { kind: 'digital' },
    }
    const props = {
      draft,
      isPending: true,
      actionError: null,
      onChange: vi.fn(),
      onConfirm: vi.fn(),
      onSkip: vi.fn(),
    }
    const { rerender } = render(<RecommendedReleaseReview {...props} />)
    expect(screen.getByLabelText('Medium')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Review confirmation' }),
    ).toBeDisabled()
    rerender(
      <RecommendedReleaseReview
        {...props}
        draft={{ ...draft, status: 'confirmed' }}
        isPending={false}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Added to Wanted' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Skip release' })).toBeDisabled()
  })

  it('keeps validation explicit for missing media or an incomplete existing item selection', () => {
    const draft = reviewDraft()
    expect(draftValidationMessage(draft)).toContain('Select a medium')
    draft.collectionItemIntent = {
      kind: 'reuseExisting',
      ownedItemId: '',
      expectedMedium: { kind: 'digital' },
    }
    expect(draftValidationMessage(draft)).toContain('Select an owned item')
  })
})
