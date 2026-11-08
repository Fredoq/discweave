import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { TrackDto } from '../catalog/api/catalogTypes'
import { DuplicateTrackReviewAction } from './DuplicateTrackReviewAction'
import {
  duplicateTrackIds,
  loadDuplicateTrackRecords,
} from './duplicateTrackReview'
import { ReviewWorkbenchTable } from './ReviewWorkbenchTable'
import type { ReviewWorkbenchItem } from './reviewWorkbenchApi'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ids = ['track-one', 'track-two', 'track-three']
const item: ReviewWorkbenchItem = {
  stableKey: 'duplicate-fire',
  category: 'duplicateCandidates',
  subtype: 'duplicateTracks',
  focus: 'actionable',
  title: 'Duplicate track title: Fire',
  state: 'open',
  reason: 'detected',
  sourceDetector: 'catalogQuality',
  targets: ids.map((id) => ({ kind: 'track', id, title: 'Fire' })),
}

function track(id: string, overrides: Partial<TrackDto> = {}): TrackDto {
  return {
    id,
    title: 'Fire',
    durationSeconds: 240,
    versionYear: 2004,
    isOriginal: false,
    genres: ['Electronic'],
    tags: [],
    credits: [
      {
        artistId: 'artist',
        artistName: 'Example Artist',
        role: 'mainArtist',
        roles: ['mainArtist', 'producer'],
      },
    ],
    releaseAppearances: [
      {
        releaseId: `release-${id}`,
        releaseTitle: `Release ${id}`,
        releaseArtist: 'Example Artist',
        year: 2005,
        label: 'Example Label',
        position: 3,
        disc: 'CD 2',
        side: 'A',
      },
    ],
    digitalFiles: [
      {
        digitalTrackFileLinkId: `link-${id}`,
        localAudioFileId: `file-${id}`,
        digitalOwnedItemId: 'copy',
        releaseId: `release-${id}`,
        releaseTitle: `Release ${id}`,
        releaseTrackId: `row-${id}`,
        position: 3,
        path: `/music/${id}.flac`,
        format: 'FLAC',
        codec: 'flac',
        durationSeconds: 240,
      },
    ],
    ...overrides,
  }
}

function setupFetch(records = ids.map((id) => track(id))) {
  const fetchMock = vi.fn<
    (input: string, init: RequestInit) => Promise<Response>
  >((input) => {
    const id = input.split('/').at(-1)
    const found = records.find((record) => record.id === id)
    return Promise.resolve(
      new Response(JSON.stringify(found ?? {}), {
        status: found ? 200 : 404,
      }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAction() {
  const onOpenTarget = vi.fn()
  const result = render(
    <DuplicateTrackReviewAction item={item} onOpenTarget={onOpenTarget} />,
  )
  return { ...result, onOpenTarget, user: userEvent.setup() }
}

async function openComparison(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: `Compare records ${item.title}` }),
  )
  await screen.findByRole('article', { name: 'Record 1: Fire' })
}

it('opens every exact candidate from the queue and previews only explicitly chosen duplicates without writes', async () => {
  const fetchMock = setupFetch()
  const onUpdateState = vi.fn()
  render(
    <ReviewWorkbenchTable
      items={[item]}
      pendingStableKey={null}
      onOpenTarget={vi.fn()}
      onUpdateState={onUpdateState}
    />,
  )
  const user = userEvent.setup()
  expect(fetchMock).not.toHaveBeenCalled()
  await openComparison(user)

  const dialog = screen.getByRole('dialog', {
    name: 'Compare duplicate tracks',
  })
  expect(within(dialog).getAllByRole('article')).toHaveLength(3)
  expect(
    within(dialog).getByText('No record selected to keep.'),
  ).toBeInTheDocument()
  expect(within(dialog).getByText(/Selection preview only/)).toBeInTheDocument()
  expect(
    within(dialog)
      .getAllByRole('radio')
      .every((input) => !(input as HTMLInputElement).checked),
  ).toBe(true)
  expect(
    within(dialog)
      .getAllByRole('checkbox')
      .every((input) => (input as HTMLInputElement).disabled),
  ).toBe(true)
  const first = within(screen.getByRole('article', { name: 'Record 1: Fire' }))
  expect(
    first.getByText('Example Artist: mainArtist, producer'),
  ).toBeInTheDocument()
  expect(first.getByText(/Example Artist · 4:00 · 2004/)).toBeInTheDocument()
  expect(first.getByText(/CD 2 \/ A \/ Track 3/)).toBeInTheDocument()
  expect(first.getByText(/\/music\/track-one.flac/)).toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: 'Keep record 1' }))
  await user.click(
    screen.getByRole('checkbox', { name: 'Record 2 is a duplicate' }),
  )
  const preview = within(
    screen.getByRole('region', { name: 'Selection preview' }),
  )
  expect(
    preview.getByText(
      /1 explicitly selected duplicate\. 1 other records remain separate/,
    ),
  ).toBeInTheDocument()
  expect(
    preview.getByText(/Proposed release links to redirect: 1/),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /^Merge/ }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Keep record 2' }))
  expect(
    screen.getByRole('checkbox', { name: 'Record 2 is a duplicate' }),
  ).toBeDisabled()
  expect(
    screen
      .getAllByRole('checkbox')
      .every((input) => !(input as HTMLInputElement).checked),
  ).toBe(true)
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
    ids.map((id) => `/api/tracks/${id}`),
  )
  expect(
    fetchMock.mock.calls.every(
      (call) => (call[1] as RequestInit | undefined)?.method === 'GET',
    ),
  ).toBe(true)
  expect(onUpdateState).not.toHaveBeenCalled()
})

it('navigates to the chosen release instead of the first track target and closes comparison', async () => {
  setupFetch()
  const { user, onOpenTarget } = renderAction()
  await openComparison(user)
  await user.click(screen.getByRole('button', { name: 'Release track-three' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(onOpenTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      navigationTarget: null,
      targets: [
        {
          kind: 'release',
          id: 'release-track-three',
          title: 'Release track-three',
        },
      ],
    }),
  )
})

it('closes on Escape, restores focus, and reloads fresh records without keeping selections', async () => {
  const fetchMock = setupFetch()
  const { user } = renderAction()
  await openComparison(user)
  await user.click(screen.getByRole('radio', { name: 'Keep record 1' }))
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { cancelable: true, bubbles: true }),
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Compare records ${item.title}` }),
  ).toHaveFocus()
  await openComparison(user)
  expect(screen.getByText('No record selected to keep.')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(6)
})

it('blocks partial candidate review when one target is missing and supports a read-only retry', async () => {
  const fetchMock = setupFetch(ids.slice(0, 2).map((id) => track(id)))
  const { user } = renderAction()
  await user.click(
    screen.getByRole('button', { name: `Compare records ${item.title}` }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A candidate is no longer available',
  )
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  fetchMock.mockImplementation((input) =>
    Promise.resolve(
      new Response(JSON.stringify(track(input.split('/').at(-1)!)), {
        status: 200,
      }),
    ),
  )
  await user.click(screen.getByRole('button', { name: 'Retry comparison' }))
  await screen.findByRole('article', { name: 'Record 1: Fire' })
  expect(screen.getAllByRole('article')).toHaveLength(3)
})

it('ignores late results from a closed comparison after reopening', async () => {
  let finish!: (response: Response) => void
  const late = new Promise<Response>((resolve) => {
    finish = resolve
  })
  const fetchMock = setupFetch()
  fetchMock.mockReturnValueOnce(late)
  const { user } = renderAction()
  await user.click(
    screen.getByRole('button', { name: `Compare records ${item.title}` }),
  )
  await user.click(screen.getByRole('button', { name: 'Close comparison' }))
  await openComparison(user)
  await act(async () => {
    finish(
      new Response(JSON.stringify(track(ids[0], { title: 'Stale title' })), {
        status: 200,
      }),
    )
    await late
  })
  expect(screen.queryByText(/Stale title/)).not.toBeInTheDocument()
  expect(
    screen.getByRole('article', { name: 'Record 1: Fire' }),
  ).toBeInTheDocument()
})

it('does not reload a comparison on unrelated queue item updates and resets when candidate membership changes', async () => {
  const fetchMock = setupFetch()
  const { user, rerender, onOpenTarget } = renderAction()
  await openComparison(user)
  await user.click(screen.getByRole('radio', { name: 'Keep record 1' }))
  rerender(
    <DuplicateTrackReviewAction
      item={{ ...item, state: 'reopened' }}
      onOpenTarget={onOpenTarget}
    />,
  )
  expect(fetchMock).toHaveBeenCalledTimes(3)
  rerender(
    <DuplicateTrackReviewAction
      item={{ ...item, targets: item.targets.slice(1) }}
      onOpenTarget={onOpenTarget}
    />,
  )
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
  expect(screen.getByText('No record selected to keep.')).toBeInTheDocument()
})

it('deduplicates target identities and never offers comparison for unrelated signals', () => {
  expect(
    duplicateTrackIds({
      ...item,
      targets: [
        item.targets[0],
        item.targets[0],
        { kind: 'release', id: 'release', title: 'Release' },
      ],
    }),
  ).toEqual([ids[0]])
  expect(duplicateTrackIds({ ...item, subtype: 'duplicateReleases' })).toEqual(
    [],
  )
})

it('rejects mismatched candidate identity and collection metadata instead of exposing partial results', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(track('other')), { status: 200 }),
      ),
  )
  await expect(loadDuplicateTrackRecords([ids[0]])).rejects.toThrow(
    'A candidate is no longer available',
  )
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...track(ids[0]), collectionId: 'private' }),
          { status: 200 },
        ),
      ),
  )
  await expect(loadDuplicateTrackRecords([ids[0]])).rejects.toThrow(
    'Catalog responses must not expose collection ids.',
  )
})

it('shows release evidence for the actual primary target, not an unrelated target subtitle', () => {
  render(
    <ReviewWorkbenchTable
      items={[
        {
          ...item,
          subtype: 'duplicateReleases',
          navigationTarget: { id: 'second', kind: 'release', path: '' },
          targets: [
            {
              kind: 'release',
              id: 'first',
              title: 'First',
              subtitle: 'Wrong evidence',
            },
            {
              kind: 'release',
              id: 'second',
              title: 'Second',
              subtitle: 'Artist · Label · CAT 002 · 2005',
            },
          ],
        },
      ]}
      onOpenTarget={vi.fn()}
      onUpdateState={vi.fn()}
      pendingStableKey={null}
    />,
  )
  expect(
    screen.getByText('Artist · Label · CAT 002 · 2005'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Wrong evidence')).not.toBeInTheDocument()
})
