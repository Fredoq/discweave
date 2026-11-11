import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LabelDiscogsCatalog } from './LabelDiscogsCatalog'
import {
  labelDiscogsApi,
  type LabelDiscogsPage,
  type LabelDiscogsPreferences,
} from './labelDiscogsApi'
import { createRecommendedReleaseDraft } from '../discover/discoverApi'

vi.mock('./labelDiscogsApi', () => ({
  labelDiscogsApi: {
    preferences: vi.fn(),
    search: vi.fn(),
    save: vi.fn(),
    page: vi.fn(),
  },
}))
vi.mock('../discover/discoverApi', () => ({
  createRecommendedReleaseDraft: vi.fn(),
}))
const preferences: LabelDiscogsPreferences = {
  discogsLabelId: '398551',
  discogsLabelName: '50Weapons',
  prefixes: [],
}
const page: LabelDiscogsPage = {
  discogsLabelId: '398551',
  discogsLabelName: '50Weapons',
  page: 1,
  pages: 2,
  pageSize: 100,
  total: 144,
  items: [
    {
      externalId: '1',
      catalogNumber: '50WEAPONSLP08',
      artist: 'Shed',
      title: 'The Killer',
      year: 2012,
      format: 'LP',
      matchKind: 'unmatched',
      matches: [],
    },
    {
      externalId: '2',
      catalogNumber: 'GROOVE 141',
      artist: 'Various',
      title: 'Magazine compilation',
      year: 2013,
      format: 'CD',
      matchKind: 'possible',
      matches: [
        {
          releaseId: 'local-1',
          title: 'My compilation',
          inCollection: true,
          wanted: false,
        },
      ],
    },
    {
      externalId: '3',
      catalogNumber: 'none',
      artist: 'Other',
      title: 'No number edition',
      year: 0,
      format: 'File',
      matchKind: 'exact',
      matches: [
        {
          releaseId: 'local-2',
          title: 'My file',
          inCollection: false,
          wanted: true,
        },
      ],
    },
  ],
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return {
    promise,
    resolve: (value: T) => {
      resolve(value)
      return Promise.resolve()
    },
  }
}
beforeEach(() => {
  vi.mocked(labelDiscogsApi.preferences).mockResolvedValue(preferences)
  vi.mocked(labelDiscogsApi.page).mockResolvedValue(page)
  vi.mocked(labelDiscogsApi.save).mockImplementation(
    (_id, discogsLabelId, prefixes) =>
      Promise.resolve({
        ...preferences,
        discogsLabelId,
        prefixes,
      }),
  )
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
async function ready() {
  const user = userEvent.setup()
  const onNavigate = vi.fn().mockReturnValue(true)
  const view = render(
    <LabelDiscogsCatalog
      labelId="label-1"
      labelName="50Weapons"
      onNavigate={onNavigate}
    />,
  )
  await screen.findByRole('link', { name: 'The Killer' })
  return { user, onNavigate, ...view }
}

describe('Discogs label catalog', () => {
  it('requires an explicit label selection and does not guess from its name', async () => {
    vi.mocked(labelDiscogsApi.preferences).mockResolvedValue({
      ...preferences,
      discogsLabelId: null,
      discogsLabelName: null,
    })
    vi.mocked(labelDiscogsApi.search).mockResolvedValue({
      items: [{ externalId: '398551', name: '50Weapons' }],
      total: 21,
    })
    const user = userEvent.setup()
    render(
      <LabelDiscogsCatalog
        labelId="label-1"
        labelName="50Weapons"
        onNavigate={() => true}
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Find labels' }))
    expect(labelDiscogsApi.page).not.toHaveBeenCalled()
    expect(
      await screen.findByText(/Showing 1 of 21 label matches/),
    ).toBeVisible()
    await user.click(
      await screen.findByRole('button', { name: 'Choose 50Weapons' }),
    )
    expect(labelDiscogsApi.save).toHaveBeenCalledWith(
      'label-1',
      '398551',
      [],
      expect.any(AbortSignal),
    )
    expect(
      await screen.findByRole('link', { name: 'The Killer' }),
    ).toBeVisible()
  })
  it('saves prefix filters while temporarily revealing other and unnumbered entries', async () => {
    const { user } = await ready()
    await user.click(screen.getByText('Catalog prefixes · All numbers'))
    await user.click(screen.getByRole('checkbox', { name: '50WEAPONSLP (1)' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'Magazine compilation' }),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('link', { name: 'No number edition' }),
    ).not.toBeInTheDocument()
    expect(labelDiscogsApi.save).toHaveBeenCalledWith(
      'label-1',
      '398551',
      ['50WEAPONSLP'],
      expect.any(AbortSignal),
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Show other prefixes temporarily' }),
    )
    expect(
      screen.getByRole('link', { name: 'Magazine compilation' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'No number edition' }),
    ).toBeVisible()
  })
  it('discloses partial catalog coverage and preserves rows when pagination fails', async () => {
    const { user } = await ready()
    expect(screen.getByText(/3 loaded of 144/)).toHaveTextContent(
      'Filters apply only to loaded entries',
    )
    vi.mocked(labelDiscogsApi.page).mockRejectedValueOnce(
      new Error('private provider details'),
    )
    await user.click(screen.getByRole('button', { name: 'Load more releases' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Previous results are unchanged',
    )
    expect(screen.getByRole('link', { name: 'The Killer' })).toBeVisible()
    expect(
      screen.queryByText('private provider details'),
    ).not.toBeInTheDocument()
  })
  it('opens Wanted review without adding an item and deduplicates repeated clicks', async () => {
    const { user, onNavigate } = await ready()
    const request =
      deferred<Awaited<ReturnType<typeof createRecommendedReleaseDraft>>>()
    vi.mocked(createRecommendedReleaseDraft).mockReturnValue(request.promise)
    const button = screen.getByRole('button', {
      name: 'Review The Killer for Wanted',
    })
    await user.dblClick(button)
    expect(createRecommendedReleaseDraft).toHaveBeenCalledTimes(1)
    await act(() =>
      request.resolve({
        id: 'session-1',
        drafts: [{ id: 'draft-1' }],
      } as Awaited<ReturnType<typeof createRecommendedReleaseDraft>>),
    )
    expect(onNavigate).toHaveBeenCalledWith(
      '/imports?session=session-1&draft=draft-1',
    )
    expect(screen.getByText(/choose a medium in Imports/)).toBeVisible()
  })
  it('ignores late pages after cancellation and keeps the existing catalog', async () => {
    const { user } = await ready()
    const request = deferred<LabelDiscogsPage>()
    vi.mocked(labelDiscogsApi.page).mockReturnValueOnce(request.promise)
    await user.click(screen.getByRole('button', { name: 'Load more releases' }))
    await user.click(screen.getByRole('button', { name: 'Cancel request' }))
    await act(() =>
      request.resolve({
        ...page,
        page: 2,
        items: [{ ...page.items[0], externalId: '4', title: 'Late release' }],
      }),
    )
    expect(
      screen.queryByRole('link', { name: 'Late release' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'The Killer' })).toBeVisible()
  })
  it('does not navigate to a late Wanted result after the panel is closed', async () => {
    const { user, onNavigate, unmount } = await ready()
    const request =
      deferred<Awaited<ReturnType<typeof createRecommendedReleaseDraft>>>()
    vi.mocked(createRecommendedReleaseDraft).mockReturnValue(request.promise)
    await user.click(
      screen.getByRole('button', { name: 'Review The Killer for Wanted' }),
    )
    unmount()
    await act(() =>
      request.resolve({
        id: 'session-1',
        drafts: [{ id: 'draft-1' }],
      } as Awaited<ReturnType<typeof createRecommendedReleaseDraft>>),
    )
    expect(onNavigate).not.toHaveBeenCalled()
  })
  it('shows exact and possible matches separately without calling unmatched entries missing', async () => {
    await ready()
    expect(screen.getByText('Exact edition match')).toBeVisible()
    expect(screen.getByText('Possible match')).toBeVisible()
    expect(screen.getByText('Unmatched', { exact: true })).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'My compilation' }),
    ).toHaveAttribute('href', '/releases?release=local-1')
    expect(
      screen.queryByRole('button', {
        name: 'Review No number edition for Wanted',
      }),
    ).not.toBeInTheDocument()
  })
  it('keeps saved filters unchanged when a filter write fails', async () => {
    vi.mocked(labelDiscogsApi.preferences).mockResolvedValue({
      ...preferences,
      prefixes: ['50WEAPONSLP'],
    })
    const { user } = await ready()
    await user.click(screen.getByText('Catalog prefixes · 50WEAPONSLP'))
    vi.mocked(labelDiscogsApi.save).mockRejectedValueOnce(
      new Error('Save failed'),
    )
    await user.click(screen.getByRole('checkbox', { name: 'GROOVE (1)' }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(
      screen.getByRole('checkbox', { name: 'GROOVE (1)' }),
    ).not.toBeChecked()
    expect(
      screen.queryByRole('link', { name: 'Magazine compilation' }),
    ).not.toBeInTheDocument()
  })
  it('rejects a new label page after a cancelled selection and reloads its first page', async () => {
    const { user } = await ready()
    vi.mocked(labelDiscogsApi.search).mockResolvedValue({
      items: [{ externalId: '99', name: 'New label' }],
      total: 1,
    })
    const save = deferred<LabelDiscogsPreferences>()
    vi.mocked(labelDiscogsApi.save).mockReturnValueOnce(save.promise)
    await user.click(screen.getByRole('button', { name: 'Change label' }))
    await user.click(screen.getByRole('button', { name: 'Find labels' }))
    await user.click(
      await screen.findByRole('button', { name: 'Choose New label' }),
    )
    await user.click(screen.getByRole('button', { name: 'Cancel request' }))
    const nextPreferences = {
      ...preferences,
      discogsLabelId: '99',
      discogsLabelName: 'New label',
    }
    await act(() => save.resolve(nextPreferences))
    vi.mocked(labelDiscogsApi.page).mockResolvedValueOnce({
      ...page,
      page: 2,
      discogsLabelId: '99',
      discogsLabelName: 'New label',
      items: [
        { ...page.items[0], externalId: '4', title: 'Other catalog entry' },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'Load more releases' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry catalog')
    expect(
      screen.queryByRole('link', { name: 'Other catalog entry' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'The Killer' })).toBeVisible()
    vi.mocked(labelDiscogsApi.preferences).mockResolvedValueOnce(
      nextPreferences,
    )
    vi.mocked(labelDiscogsApi.page).mockResolvedValueOnce({
      ...page,
      page: 1,
      discogsLabelId: '99',
      discogsLabelName: 'New label',
      items: [
        { ...page.items[0], externalId: '4', title: 'Other catalog entry' },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'Retry catalog' }))
    expect(
      await screen.findByRole('link', { name: 'Other catalog entry' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'The Killer' }),
    ).not.toBeInTheDocument()
  })
  it('retains catalog number variants while reporting raw Discogs pagination counts', async () => {
    vi.mocked(labelDiscogsApi.page).mockResolvedValueOnce({
      ...page,
      items: [
        page.items[0],
        page.items[0],
        { ...page.items[0], catalogNumber: '50WLP08' },
      ],
    })
    const user = userEvent.setup()
    render(
      <LabelDiscogsCatalog
        labelId="label-1"
        labelName="50Weapons"
        onNavigate={() => true}
      />,
    )
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: 'The Killer' })).toHaveLength(
        2,
      ),
    )
    expect(
      screen.getByText(/2 catalog rows shown · 3 loaded of 144/),
    ).toBeVisible()
    expect(screen.getByText('50WEAPONSLP08', { exact: true })).toBeVisible()
    expect(screen.getByText('50WLP08', { exact: true })).toBeVisible()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search loaded releases' }),
      '50 wlp08',
    )
    expect(screen.getAllByRole('link', { name: 'The Killer' })).toHaveLength(1)
  })
  it('clears stale rows when retry discovers a disconnected catalog', async () => {
    const { user } = await ready()
    const save = deferred<LabelDiscogsPreferences>()
    vi.mocked(labelDiscogsApi.save).mockReturnValueOnce(save.promise)
    await user.click(screen.getByRole('button', { name: 'Disconnect catalog' }))
    await user.click(screen.getByRole('button', { name: 'Cancel request' }))
    await act(() =>
      save.resolve({
        ...preferences,
        discogsLabelId: null,
        discogsLabelName: null,
      }),
    )
    vi.mocked(labelDiscogsApi.page).mockRejectedValueOnce(
      new Error('No selection'),
    )
    await user.click(screen.getByRole('button', { name: 'Load more releases' }))
    vi.mocked(labelDiscogsApi.preferences).mockResolvedValueOnce({
      ...preferences,
      discogsLabelId: null,
      discogsLabelName: null,
    })
    await user.click(
      await screen.findByRole('button', { name: 'Retry catalog' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Find labels' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'The Killer' }),
    ).not.toBeInTheDocument()
  })
})
