import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DuplicateTrackMerge } from './DuplicateTrackMerge'

const selection = { keeperTrackId: 'keeper', duplicateTrackIds: ['duplicate'] }
const preview = {
  ...selection,
  records: [
    {
      id: 'keeper',
      title: 'Fire',
      durationSeconds: 240,
      versionYear: 2004,
      isOriginal: false,
      genres: [],
      tags: [],
    },
    {
      id: 'duplicate',
      title: 'Fire',
      durationSeconds: 241,
      versionYear: 2005,
      isOriginal: false,
      genres: [],
      tags: [],
    },
  ],
  previewToken: 'snapshot',
  metadataPolicy: 'keepKeeper',
  canMerge: true,
  conflicts: [],
  counts: {
    releaseAppearances: 2,
    linkedFiles: 3,
    playlistEntries: 1,
    credits: 1,
    ratings: 0,
    relations: 0,
    importReferences: 1,
  },
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function setup() {
  const fetch = vi
    .fn()
    .mockImplementation(() => Promise.resolve(response(preview)))
  vi.stubGlobal('fetch', fetch)
  const props = {
    selection,
    onBusy: vi.fn(),
    onPreviewRecords: vi.fn(),
    onMerged: vi.fn(),
    onUncertain: vi.fn(),
  }
  const view = render(<DuplicateTrackMerge {...props} />)
  return { fetch, ...props, ...view, user: userEvent.setup() }
}
async function review(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Preview merge' }))
  await screen.findByRole('button', { name: 'Merge selected duplicates' })
}

it('previews exact keeper/subset, requires explicit confirmation, and refreshes only after success', async () => {
  const { fetch, user, onMerged } = setup()
  await review(user)
  expect(fetch).toHaveBeenCalledWith(
    '/api/tracks/merge/preview',
    expect.objectContaining({
      credentials: 'include',
      body: JSON.stringify(selection),
    }),
  )
  expect(
    screen.getByRole('button', { name: 'Merge selected duplicates' }),
  ).toBeDisabled()
  expect(onMerged).not.toHaveBeenCalled()
  await user.click(screen.getByRole('checkbox'))
  let finish!: (value: Response) => void
  fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  const button = screen.getByRole('button', {
    name: 'Merge selected duplicates',
  })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch).toHaveBeenLastCalledWith(
    '/api/tracks/merge',
    expect.objectContaining({
      body: JSON.stringify({
        ...selection,
        previewToken: 'snapshot',
        confirmed: true,
      }),
    }),
  )
  await act(async () => {
    await Promise.resolve()
    finish(response({ keeperTrackId: 'keeper', mergedTrackIds: ['duplicate'] }))
  })
  expect(onMerged).toHaveBeenCalledOnce()
})

it('shows server conflicts and never offers confirmation for a blocked plan', async () => {
  const { fetch, user } = setup()
  fetch.mockResolvedValueOnce(
    response({
      ...preview,
      canMerge: false,
      conflicts: [
        { code: 'rating', message: 'Resolve conflicting ratings first.' },
      ],
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Preview merge' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Resolve conflicting ratings first.',
  )
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('requires a new preview and new confirmation after a stale plan', async () => {
  const { fetch, user, onMerged } = setup()
  await review(user)
  await user.click(screen.getByRole('checkbox'))
  fetch.mockResolvedValueOnce(
    response({ code: 'track_merge.preview_stale', message: 'Stale' }, 409),
  )
  await user.click(
    screen.getByRole('button', { name: 'Merge selected duplicates' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'collection changed',
  )
  expect(onMerged).not.toHaveBeenCalled()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  await review(user)
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

it('does not retry an uncertain result and offers collection reconciliation', async () => {
  const { fetch, user, onUncertain, onMerged } = setup()
  await review(user)
  await user.click(screen.getByRole('checkbox'))
  fetch.mockRejectedValueOnce(new TypeError('Network failure'))
  await user.click(
    screen.getByRole('button', { name: 'Merge selected duplicates' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'It may have completed',
  )
  expect(
    screen.queryByRole('button', { name: 'Preview merge' }),
  ).not.toBeInTheDocument()
  expect(onMerged).not.toHaveBeenCalled()
  await user.click(
    screen.getByRole('button', { name: 'Close and refresh collection' }),
  )
  expect(onUncertain).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('drops a late preview after changing the selection', async () => {
  const { fetch, user, rerender, onBusy, onMerged, onUncertain } = setup()
  let finish!: (value: Response) => void
  fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  await user.click(screen.getByRole('button', { name: 'Preview merge' }))
  rerender(
    <DuplicateTrackMerge
      key="new-selection"
      selection={{ keeperTrackId: 'other', duplicateTrackIds: ['keeper'] }}
      onPreviewRecords={vi.fn()}
      onBusy={onBusy}
      onMerged={onMerged}
      onUncertain={onUncertain}
    />,
  )
  await act(async () => {
    await Promise.resolve()
    finish(response(preview))
  })
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Preview merge' })).toBeEnabled()
})

it('still invalidates catalog state if navigation unmounts an in-flight successful merge', async () => {
  const { fetch, user, unmount, onMerged } = setup()
  await review(user)
  await user.click(screen.getByRole('checkbox'))
  let finish!: (value: Response) => void
  fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Merge selected duplicates' }),
  )
  unmount()
  await act(async () => {
    await Promise.resolve()
    finish(response({ keeperTrackId: 'keeper', mergedTrackIds: ['duplicate'] }))
  })
  expect(onMerged).toHaveBeenCalledOnce()
})

it.each([
  undefined,
  [],
  [preview.records[0], preview.records[0]],
  [preview.records[0], { ...preview.records[1], id: 'other' }],
  [preview.records[0], { ...preview.records[1], title: undefined }],
  [preview.records[0], { ...preview.records[1], durationSeconds: 'bad' }],
  [preview.records[0], { ...preview.records[1], credits: [null] }],
])(
  'rejects incomplete or mismatched snapshot records without offering confirmation (%j)',
  async (records) => {
    const { fetch, user, onPreviewRecords } = setup()
    fetch.mockResolvedValueOnce(response({ ...preview, records }))
    await user.click(screen.getByRole('button', { name: 'Preview merge' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be loaded',
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(onPreviewRecords).not.toHaveBeenCalled()
  },
)

it('shows newly previewed scalar values and differences and resets prior confirmation', async () => {
  const { fetch, user, onPreviewRecords } = setup()
  await review(user)
  await user.click(screen.getByRole('checkbox'))
  const records = [
    {
      ...preview.records[0],
      title: 'Current keeper',
      durationSeconds: null,
      versionYear: null,
      isOriginal: true,
    },
    {
      ...preview.records[1],
      title: 'Current duplicate',
      durationSeconds: 302,
      versionYear: 2007,
    },
  ]
  fetch.mockResolvedValueOnce(
    response({ ...preview, previewToken: 'new-snapshot', records }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Refresh merge preview' }),
  )
  expect(await screen.findByText('Title: Current keeper')).toBeInTheDocument()
  expect(
    screen.getByText('Duration: 5:02 → Unknown duration'),
  ).toBeInTheDocument()
  expect(screen.getByText('Year: 2007 → Unknown year')).toBeInTheDocument()
  expect(
    screen.getByText('Original recording: Not marked → Yes'),
  ).toBeInTheDocument()
  expect(onPreviewRecords).toHaveBeenLastCalledWith(records)
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(
    screen.getByRole('button', { name: 'Merge selected duplicates' }),
  ).toBeDisabled()
})
