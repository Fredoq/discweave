import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import { ExternalOriginalReleaseReview } from './ExternalOriginalReleaseReview'
import { DraftEditor } from './ImportDraftEditor'

h.setupAppTestHooks()

describe('ExternalOriginalReleaseReview', () => {
  it('shows the user-facing release decision without technical binding controls', () => {
    h.render(
      <ExternalOriginalReleaseReview
        actionError={null}
        draft={externalDraft()}
        isPending={false}
        onChange={vi.fn()}
        onConfirm={vi.fn()}
        onEditDetails={vi.fn()}
      />,
    )

    expect(
      h.screen.getByRole('heading', { name: 'Review original release' }),
    ).toBeVisible()
    expect(h.screen.getByText('Anomaly Calling Your Name')).toBeVisible()
    expect(
      h.screen.getByText('Earoica / Anomaly Calling Your Name'),
    ).toBeVisible()
    expect(
      h.screen.getByText('1995 · Musicnow Records · MNR-008'),
    ).toBeVisible()
    expect(h.screen.getByText('Vinyl · 12-inch')).toBeVisible()
    expect(h.screen.getByText('Track A · 9:54')).toBeVisible()
    expect(h.screen.getByText('MusicBrainz verified')).toBeVisible()
    expect(h.screen.getByText('Discogs matched')).toBeVisible()
    expect(
      h.screen.getByRole('button', {
        name: 'Add to Wanted and link original',
      }),
    ).toBeEnabled()

    expect(h.screen.queryByText('Recording MBID')).not.toBeInTheDocument()
    expect(h.screen.queryByText('Release MBID')).not.toBeInTheDocument()
    expect(h.screen.queryByText('Fingerprint')).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('button', { name: 'Rebind Discogs-backed' }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByText('cf6fb784-b070-4c74-a9a3-3ceb530470d0'),
    ).not.toBeInTheDocument()
  })

  it('changes collection intent through visible choices and confirms once', async () => {
    const user = h.userEvent.setup()
    const onChange = vi.fn()
    const onConfirm = vi.fn()
    const draft = externalDraft()

    h.render(
      <ExternalOriginalReleaseReview
        actionError={null}
        draft={draft}
        isPending={false}
        onChange={onChange}
        onConfirm={onConfirm}
        onEditDetails={vi.fn()}
      />,
    )

    await user.click(
      h.screen.getByRole('radio', { name: /I own this release/ }),
    )
    expect(onChange).toHaveBeenCalledWith({
      ...draft,
      collectionItemIntent: {
        kind: 'reuseExisting',
        ownedItemId: '',
        expectedMedium: { kind: 'vinyl', formatDescription: '12-inch' },
      },
    })

    await user.click(
      h.screen.getByRole('button', {
        name: 'Add to Wanted and link original',
      }),
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('lets the user select a matching owned copy before reusing it', async () => {
    const user = h.userEvent.setup()
    const onChange = vi.fn()
    const draft = externalDraft()
    draft.localProvenanceSelection = {
      selectedReleaseId: 'blue-monday',
      selectedTrackId: null,
    }
    draft.collectionItemIntent = {
      kind: 'reuseExisting',
      ownedItemId: '',
      expectedMedium: { kind: 'vinyl', formatDescription: '12-inch' },
    }

    h.render(
      <ExternalOriginalReleaseReview
        actionError={null}
        draft={draft}
        isPending={false}
        onChange={onChange}
        onConfirm={vi.fn()}
        onEditDetails={vi.fn()}
        ownedItems={[
          {
            ...h.ownedItemRecords.find(
              (item) => item.id === 'blue-monday-vinyl',
            )!,
            id: 'owned-copy-1',
            releaseId: 'blue-monday',
          },
        ]}
      />,
    )

    const selector = h.screen.getByRole('combobox', { name: 'Owned copy' })
    expect(selector).toBeVisible()
    await user.selectOptions(selector, 'owned-copy-1')

    expect(onChange).toHaveBeenLastCalledWith({
      ...draft,
      collectionItemIntent: {
        kind: 'reuseExisting',
        ownedItemId: 'owned-copy-1',
        expectedMedium: { kind: 'vinyl', formatDescription: '12-inch' },
      },
    })
  })

  it('presents a MusicBrainz-only binding as a valid informational state', () => {
    const draft = externalDraft()
    draft.selectedOriginalBinding = {
      ...draft.selectedOriginalBinding!,
      releaseRoute: {
        ...draft.selectedOriginalBinding!.releaseRoute,
        discogsRelease: null,
      },
      discogsRow: null,
    }

    h.render(
      <ExternalOriginalReleaseReview
        actionError={null}
        draft={draft}
        isPending={false}
        onChange={vi.fn()}
        onConfirm={vi.fn()}
        onEditDetails={vi.fn()}
      />,
    )

    expect(h.screen.getByText('MusicBrainz only')).toBeVisible()
    expect(h.screen.queryByText('Discogs matched')).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('button', {
        name: 'Add to Wanted and link original',
      }),
    ).toBeEnabled()
  })

  it('routes an external original draft to compact review by default', () => {
    renderDraftEditor(externalDraft())

    expect(
      h.screen.getByRole('heading', { name: 'Review original release' }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('heading', { name: 'Release metadata' }),
    ).not.toBeInTheDocument()
  })

  it('reveals editable release metadata without technical binding fields', async () => {
    const user = h.userEvent.setup()
    renderDraftEditor(externalDraft())

    await user.click(
      h.screen.getByRole('button', { name: 'Edit release details' }),
    )

    expect(
      h.screen.getByRole('heading', { name: 'Release metadata' }),
    ).toBeVisible()
    expect(h.screen.getByLabelText('Title')).toHaveValue(
      'Earoica / Anomaly Calling Your Name',
    )
    expect(h.screen.queryByText('Release MBID')).not.toBeInTheDocument()
    expect(h.screen.queryByText('Selected release ID')).not.toBeInTheDocument()
  })
})

function renderDraftEditor(draft: ReleaseImportDraft) {
  h.render(
    <DraftEditor
      actionError={null}
      artists={[]}
      creditRoleOptions={h.defaultCatalogDictionaries.creditRole}
      dictionaries={h.defaultCatalogDictionaries}
      draft={draft}
      genreOptions={h.defaultCatalogDictionaries.genre}
      releaseTypeOptions={h.defaultCatalogDictionaries.releaseType}
      validationMessage=""
      onChange={vi.fn()}
      onConfirm={vi.fn()}
      onSave={vi.fn()}
      onSkip={vi.fn()}
    />,
  )
}

function externalDraft(): ReleaseImportDraft {
  return {
    id: 'draft-external',
    sourceKind: 'externalMetadata',
    sourcePath: null,
    relativePath: null,
    status: 'ready',
    title: 'Earoica / Anomaly Calling Your Name',
    type: 'single',
    catalogNumber: 'MNR-008',
    labelName: 'Musicnow Records',
    releaseDate: '1995-01-01',
    year: 1995,
    isVariousArtists: false,
    notOnLabel: false,
    createCatalogTracks: true,
    artistNames: ['Libra', 'Taylor'],
    artistCredits: [
      { name: 'Libra', role: 'mainArtist' },
      { name: 'Taylor', role: 'mainArtist' },
    ],
    selectedArtistIds: [],
    artistSuggestions: [],
    labels: [
      {
        name: 'Musicnow Records',
        catalogNumber: 'MNR-008',
        hasNoCatalogNumber: false,
      },
    ],
    genres: [],
    tags: [],
    externalSources: [
      {
        providerCode: 'musicbrainz',
        resourceType: 'release',
        externalId: 'cf6fb784-b070-4c74-a9a3-3ceb530470d0',
        sourceUrl:
          'https://musicbrainz.org/release/cf6fb784-b070-4c74-a9a3-3ceb530470d0',
      },
      {
        providerCode: 'discogs',
        resourceType: 'release',
        externalId: '104110',
        sourceUrl: 'https://www.discogs.com/release/104110',
      },
    ],
    coverPath: null,
    issues: [],
    tracks: [
      {
        id: 'draft-track-original',
        sourceKind: 'externalMetadata',
        filePath: null,
        relativePath: null,
        format: null,
        sizeBytes: null,
        lastModifiedAt: null,
        localFile: null,
        title: 'Anomaly Calling Your Name',
        durationSeconds: 594,
        position: 1,
        disc: '1',
        side: 'A',
        versionYear: 1995,
        artistNames: ['Libra', 'Taylor'],
        artistSuggestions: [],
        trackSuggestions: [],
        trackMode: 'create',
        isSkipped: false,
        selectedTrackId: null,
        selectedArtistIds: [],
        issues: [],
        isOriginal: true,
      },
    ],
    selectedOriginalBinding: {
      sourceTrackId: 'source-track',
      draftTrackId: 'draft-track-original',
      recordingSource: {
        providerCode: 'musicbrainz',
        resourceType: 'recording',
        externalId: '07db035a-6e81-4458-a82c-0d0eda9a5659',
        sourceUrl:
          'https://musicbrainz.org/recording/07db035a-6e81-4458-a82c-0d0eda9a5659',
      },
      releaseRoute: {
        musicBrainzRelease: {
          providerCode: 'musicbrainz',
          resourceType: 'release',
          externalId: 'cf6fb784-b070-4c74-a9a3-3ceb530470d0',
          sourceUrl:
            'https://musicbrainz.org/release/cf6fb784-b070-4c74-a9a3-3ceb530470d0',
        },
        discogsRelease: {
          providerCode: 'discogs',
          resourceType: 'release',
          externalId: '104110',
          sourceUrl: 'https://www.discogs.com/release/104110',
        },
      },
      musicBrainzRow: {
        releaseMbid: 'cf6fb784-b070-4c74-a9a3-3ceb530470d0',
        mediumPosition: '1',
        trackMbid: 'ecb6c9bf-1b32-46e1-913f-d24bfdfbfb0c',
      },
      discogsRow: {
        releaseId: '104110',
        rowOrdinal: 0,
        position: 'A',
        fingerprint: 'anomaly-calling-your-name|594',
      },
      promoteLinkedTargetConfirmed: false,
    },
    localProvenanceSelection: {
      selectedReleaseId: null,
      selectedTrackId: null,
    },
    collectionItemIntent: {
      kind: 'newWanted',
      medium: { kind: 'vinyl', formatDescription: '12-inch' },
    },
  }
}
