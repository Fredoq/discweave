import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReleaseDateReviewDialog } from './ReleaseDateReviewDialog'
import {
  applyReleaseDate,
  discogsReleaseId,
  previewReleaseDate,
  type ReleaseDatePreview,
} from './releaseDateReviewApi'
import { requestAppNavigation } from '../../app/navigationGuard'
import { searchDiscogsReleases } from '../catalog/api/externalMetadataClient'

vi.mock('./releaseDateReviewApi', async (original) => ({
  ...(await original<typeof import('./releaseDateReviewApi')>()),
  applyReleaseDate: vi.fn(),
  previewReleaseDate: vi.fn(),
}))
vi.mock('../catalog/api/externalMetadataClient', () => ({
  searchDiscogsReleases: vi.fn(),
}))
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
  it('does not filter by track count or claim an empty search proves absence', async () => {
    mount()
    fireEvent.change(screen.getByLabelText('Search Discogs'), {
      target: { value: 'Album' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByText('No editions found in these results.')
    expect(searchDiscogsReleases).toHaveBeenCalledWith({
      query: 'Album',
      limit: 25,
    })
    expect(
      screen.getByText(/A missing result does not mean/),
    ).toBeInTheDocument()
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
  it('accepts only a release id or official HTTPS release URL', () => {
    expect(discogsReleaseId('123')).toBe('123')
    expect(discogsReleaseId('https://www.discogs.com/release/123-Album')).toBe(
      '123',
    )
    expect(discogsReleaseId('https://www.discogs.com/master/123')).toBeNull()
    expect(discogsReleaseId('https://example.com/release/123')).toBeNull()
  })
})
