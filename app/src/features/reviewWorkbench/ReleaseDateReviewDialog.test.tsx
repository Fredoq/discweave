import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReleaseDateReviewDialog } from './ReleaseDateReviewDialog'
import {
  applyReleaseDate,
  discogsReleaseId,
  previewReleaseDate,
  type ReleaseDatePreview,
} from './releaseDateReviewApi'
import { requestAppNavigation } from '../../app/navigationGuard'
import { loadRelease } from '../catalog/api/releaseClient'
import type { ReleaseDto } from '../catalog/api/catalogDtoTypes'
import { searchDiscogsReleases } from '../catalog/api/externalMetadataClient'

vi.mock('../catalog/api/releaseClient', () => ({ loadRelease: vi.fn() }))
vi.mock('./releaseDateReviewApi', async (original) => ({
  ...(await original<typeof import('./releaseDateReviewApi')>()),
  applyReleaseDate: vi.fn(),
  previewReleaseDate: vi.fn(),
}))
vi.mock('../catalog/api/externalMetadataClient', () => ({
  searchDiscogsReleases: vi.fn(),
}))
const release: ReleaseDto = {
  id: 'local',
  title: 'Album',
  type: 'album',
  genres: [],
  tags: [],
  year: 2000,
  artistCredits: [
    { artistId: 'a', artistName: 'Artist', roles: ['mainArtist'] },
    { artistId: 'b', artistName: 'Producer', roles: ['producer'] },
  ],
  labels: [
    { name: 'Label', catalogNumber: 'ABC01', hasNoCatalogNumber: false },
  ],
}
const preview: ReleaseDatePreview = {
  token: 'signed',
  currentTitle: 'Album',
  currentArtists: ['Artist'],
  currentCatalogNumbers: ['ABC01'],
  currentLabels: ['Label'],
  currentYear: 2000,
  currentDate: null,
  source: {
    externalId: '123',
    sourceUrl: 'https://www.discogs.com/release/123',
    attribution: 'Discogs',
  },
  title: 'Album',
  artists: ['Artist'],
  catalogNumber: 'ABC01',
  labels: ['Label'],
  formats: ['CD'],
  date: { kind: 'fullDate', year: 2000, month: 2, day: 3 },
}
function mount() {
  return render(
    <ReleaseDateReviewDialog
      releaseId="local"
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  )
}
async function load() {
  fireEvent.change(screen.getByLabelText('Exact Discogs release ID or URL'), {
    target: { value: '123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Preview edition' }))
  await screen.findByText('Compare editions')
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadRelease).mockResolvedValue(release)
  vi.mocked(previewReleaseDate).mockResolvedValue(preview)
  vi.mocked(applyReleaseDate).mockResolvedValue({})
  vi.mocked(searchDiscogsReleases).mockResolvedValue({
    items: [],
    total: 0,
    limit: 25,
  })
})
describe('release date review', () => {
  it('previews the specific edition without mutation and explicitly applies only its token', async () => {
    mount()
    await load()
    expect(screen.getByText('2000-02-03')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Discogs edition #123' }),
    ).toHaveAttribute('href', preview.source.sourceUrl)
    expect(applyReleaseDate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply date' }))
    await screen.findByText(
      'Release date updated. No other metadata was changed.',
    )
    expect(applyReleaseDate).toHaveBeenCalledExactlyOnceWith('local', 'signed')
  })
  it('shows month precision without inventing a day or enabling apply', async () => {
    vi.mocked(previewReleaseDate).mockResolvedValue({
      ...preview,
      token: null,
      date: { kind: 'yearMonth', year: 2000, month: 2 },
    })
    mount()
    await load()
    expect(screen.getByText('2000-02')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Apply date' }),
    ).not.toBeInTheDocument()
  })
  it('invalidates the preview when the source changes', async () => {
    mount()
    await load()
    fireEvent.click(screen.getByRole('button', { name: 'Back to results' }))
    fireEvent.change(screen.getByLabelText('Exact Discogs release ID or URL'), {
      target: { value: '456' },
    })
    expect(
      screen.queryByRole('button', { name: 'Apply date' }),
    ).not.toBeInTheDocument()
  })
  it('requires a new preview after a rejected apply', async () => {
    vi.mocked(applyReleaseDate).mockRejectedValue(new Error('Preview expired'))
    mount()
    await load()
    fireEvent.click(screen.getByRole('button', { name: 'Apply date' }))
    await screen.findByRole('alert')
    expect(
      screen.queryByRole('button', { name: 'Apply date' }),
    ).not.toBeInTheDocument()
  })
  it('prefills focused fields and searches artist/title separately from catalog number', async () => {
    mount()
    await waitFor(() =>
      expect(screen.getByLabelText('Main artist')).toHaveValue('Artist'),
    )
    expect(screen.getByLabelText('Release title')).toHaveValue('Album')
    expect(screen.getByLabelText('Catalog number')).toHaveValue('ABC01')
    fireEvent.click(
      screen.getByRole('button', { name: 'Find matching editions' }),
    )
    await screen.findByText('No editions found in these results.')
    expect(searchDiscogsReleases).toHaveBeenCalledTimes(2)
    expect(searchDiscogsReleases).toHaveBeenCalledWith({
      title: 'Album',
      artist: 'Artist',
      limit: 25,
    })
    expect(searchDiscogsReleases).toHaveBeenCalledWith({
      catalogNumber: 'ABC01',
      limit: 25,
    })
    expect(
      screen.getByText(/A missing result does not mean/),
    ).toBeInTheDocument()
  })
  it('broadens only after an explicit title-only search', async () => {
    mount()
    await waitFor(() =>
      expect(screen.getByLabelText('Main artist')).toHaveValue('Artist'),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Broaden to title only' }),
    )
    await screen.findByText('No editions found in these results.')
    expect(searchDiscogsReleases).toHaveBeenCalledExactlyOnceWith({
      title: 'Album',
      limit: 25,
    })
  })
  it('does not overwrite edits when local metadata arrives late', async () => {
    let finish!: (value: ReleaseDto) => void
    vi.mocked(loadRelease).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    mount()
    fireEvent.change(screen.getByLabelText('Release title'), {
      target: { value: 'Edited album' },
    })
    finish(release)
    await waitFor(() =>
      expect(
        screen.queryByText('Loading release details…'),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Release title')).toHaveValue('Edited album')
  })
  it('keeps exact edition lookup available if collection details cannot load', async () => {
    vi.mocked(loadRelease).mockRejectedValue(new Error('offline'))
    mount()
    await screen.findByText(/Release details could not be loaded/)
    await load()
    expect(screen.getByRole('button', { name: 'Apply date' })).toBeEnabled()
  })
  it('does not use Various Artists as a required search artist', async () => {
    vi.mocked(loadRelease).mockResolvedValue({
      ...release,
      isVariousArtists: true,
    })
    mount()
    await waitFor(() =>
      expect(screen.getByLabelText('Catalog number')).toHaveValue('ABC01'),
    )
    expect(screen.getByLabelText('Main artist')).toHaveValue('')
    fireEvent.click(
      screen.getByRole('button', { name: 'Find matching editions' }),
    )
    await screen.findByText('No editions found in these results.')
    expect(searchDiscogsReleases).toHaveBeenCalledExactlyOnceWith({
      catalogNumber: 'ABC01',
      limit: 25,
    })
  })
  it('retains successful search results and explains a failed branch', async () => {
    vi.mocked(searchDiscogsReleases)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        items: [
          {
            source: {
              ...preview.source,
              providerName: 'Discogs',
              resourceType: 'release',
            },
            title: 'Album',
            artists: ['Artist'],
            labels: ['Label'],
            formats: ['CD'],
            catalogNumber: 'ABC01',
            barcodes: [],
          },
        ],
        total: 1,
        limit: 25,
      })
    mount()
    await waitFor(() =>
      expect(screen.getByLabelText('Main artist')).toHaveValue('Artist'),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Find matching editions' }),
    )
    await screen.findByText(/One search could not complete/)
    expect(screen.getByRole('button', { name: 'Preview #123' })).toBeEnabled()
  })
  it('preserves actionable provider errors when every search fails', async () => {
    vi.mocked(searchDiscogsReleases).mockRejectedValue(
      new Error('Configure Discogs access in Settings'),
    )
    mount()
    await waitFor(() =>
      expect(screen.getByLabelText('Main artist')).toHaveValue('Artist'),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Find matching editions' }),
    )
    await screen.findByText(/Configure Discogs access in Settings/)
  })
  it('ignores search completions after the dialog is unmounted', async () => {
    let finish!: (value: { items: []; total: number; limit: number }) => void
    vi.mocked(searchDiscogsReleases).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const view = mount()
    await waitFor(() =>
      expect(screen.getByLabelText('Main artist')).toHaveValue('Artist'),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Broaden to title only' }),
    )
    view.unmount()
    finish({ items: [], total: 0, limit: 25 })
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Discogs editions'),
      ).not.toBeInTheDocument(),
    )
    expect(previewReleaseDate).not.toHaveBeenCalled()
  })
  it('ignores late preview completion after unmount', async () => {
    let finish!: (value: ReleaseDatePreview) => void
    vi.mocked(previewReleaseDate).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const view = mount()
    fireEvent.change(screen.getByLabelText('Exact Discogs release ID or URL'), {
      target: { value: '123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview edition' }))
    view.unmount()
    finish(preview)
    await waitFor(() => expect(applyReleaseDate).not.toHaveBeenCalled())
  })
  it('blocks repeated apply and navigation until the request completes', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(applyReleaseDate).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    mount()
    await load()
    const apply = screen.getByRole('button', { name: 'Apply date' })
    fireEvent.click(apply)
    fireEvent.click(apply)
    expect(applyReleaseDate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    expect(requestAppNavigation('/tracks')).toBe(false)
    finish({})
    await screen.findByText(
      'Release date updated. No other metadata was changed.',
    )
    expect(requestAppNavigation('/tracks')).toBe(true)
  })
  it.each(['1', '50'])(
    'opens edition %s in a visible preview step instead of below a long result list',
    async (id) => {
      const items = Array.from({ length: 50 }, (_, index) => ({
        source: {
          ...preview.source,
          externalId: String(index + 1),
          providerName: 'Discogs',
          resourceType: 'release',
        },
        title: `Edition ${index + 1}`,
        artists: ['Artist'],
        labels: ['Label'],
        formats: ['CD'],
        catalogNumber: 'ABC01',
        barcodes: [],
      }))
      vi.mocked(searchDiscogsReleases).mockResolvedValue({
        items,
        total: 50,
        limit: 50,
      })
      let finish!: (value: ReleaseDatePreview) => void
      vi.mocked(previewReleaseDate).mockReturnValue(
        new Promise((resolve) => {
          finish = resolve
        }),
      )
      mount()
      await waitFor(() =>
        expect(screen.getByLabelText('Main artist')).toHaveValue('Artist'),
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'Find matching editions' }),
      )
      await screen.findByRole('button', { name: `Preview #${id}` })
      const dialog = screen.getByRole('dialog')
      dialog.scrollTop = 1000
      fireEvent.click(screen.getByRole('button', { name: `Preview #${id}` }))
      expect(
        screen.queryByLabelText('Discogs editions'),
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(`Loading Discogs edition #${id}…`),
      ).toBeInTheDocument()
      expect(
        screen.getByText(`Selected Discogs edition #${id}`),
      ).toBeInTheDocument()
      expect(dialog.scrollTop).toBe(0)
      expect(
        screen.getByRole('heading', { name: 'Review release date' }),
      ).toHaveFocus()
      expect(
        screen.getByRole('button', { name: 'Back to results' }),
      ).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
      expect(previewReleaseDate).toHaveBeenCalledExactlyOnceWith('local', id)
      dialog.scrollTop = 500
      await act(async () => {
        finish({ ...preview, source: { ...preview.source, externalId: id } })
        await Promise.resolve()
      })
      expect(
        screen.getByRole('heading', { name: 'Compare editions' }),
      ).toBeInTheDocument()
      expect(dialog.scrollTop).toBe(0)
      expect(applyReleaseDate).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Back to results' }))
      expect(screen.getByLabelText('Release title')).toHaveValue('Album')
      expect(screen.getByLabelText('Main artist')).toHaveValue('Artist')
      expect(screen.getByRole('button', { name: 'Preview #50' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Preview #1' })).toBeEnabled()
      expect(
        screen.queryByRole('button', { name: 'Apply date' }),
      ).not.toBeInTheDocument()
      vi.mocked(previewReleaseDate).mockResolvedValue({
        ...preview,
        token: 'fresh',
      })
      fireEvent.click(screen.getByRole('button', { name: 'Preview #2' }))
      await screen.findByRole('heading', { name: 'Compare editions' })
      expect(previewReleaseDate).toHaveBeenLastCalledWith('local', '2')
      expect(applyReleaseDate).not.toHaveBeenCalled()
    },
  )
  it('shows preview errors at the top with an explicit retry, without losing the selected edition', async () => {
    vi.mocked(previewReleaseDate)
      .mockRejectedValueOnce(new Error('Discogs temporarily unavailable'))
      .mockResolvedValueOnce(preview)
    mount()
    fireEvent.change(screen.getByLabelText('Exact Discogs release ID or URL'), {
      target: { value: '123' },
    })
    const dialog = screen.getByRole('dialog')
    dialog.scrollTop = 1000
    fireEvent.click(screen.getByRole('button', { name: 'Preview edition' }))
    await screen.findByRole('alert')
    expect(dialog.scrollTop).toBe(0)
    expect(
      screen.getByRole('heading', { name: 'Review release date' }),
    ).toHaveFocus()
    expect(screen.queryByLabelText('Find this edition')).not.toBeInTheDocument()
    expect(
      screen.getByText('Selected Discogs edition #123'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }))
    await screen.findByRole('heading', { name: 'Compare editions' })
    expect(previewReleaseDate).toHaveBeenCalledTimes(2)
    expect(applyReleaseDate).not.toHaveBeenCalled()
  })
  it('accepts only a release id or official HTTPS release URL', () => {
    expect(discogsReleaseId('123')).toBe('123')
    expect(discogsReleaseId('https://www.discogs.com/release/123-Album')).toBe(
      '123',
    )
    expect(discogsReleaseId('https://www.discogs.com/master/123')).toBeNull()
    expect(discogsReleaseId('https://example.com/release/123')).toBeNull()
  })
})
