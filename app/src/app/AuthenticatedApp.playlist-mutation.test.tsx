import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthenticatedApp } from './AuthenticatedApp'
import { renderWorkspace } from './renderWorkspace'
import {
  createPlaylist,
  updatePlaylist,
  emptyCatalogState,
  loadCatalog,
} from '../features/catalog/catalogApi'
import { playlistRecords } from '../features/playlists/playlistsData'

vi.mock('./renderWorkspace', () => ({
  manualEntryRoutes: new Set(['/playlists']),
  renderWorkspace: vi.fn(() => null),
}))
vi.mock('../features/catalog/catalogApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/catalog/catalogApi')>()),
  getInitialCatalogStateForTests: () => null,
  loadCatalog: vi.fn(),
  createPlaylist: vi.fn(),
  updatePlaylist: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  window.history.replaceState({}, '', '/')
})
const saved = { ...playlistRecords[0], id: 'server-playlist-id' }
async function setup() {
  window.history.replaceState({}, '', '/playlists')
  vi.mocked(loadCatalog).mockResolvedValueOnce(emptyCatalogState)
  const view = render(
    <AuthenticatedApp
      sessionEmail="test@example.com"
      sessionRole="Admin"
      sessionError={null}
      onLogout={vi.fn()}
      logoutPending={false}
    />,
  )
  await waitFor(() => expect(renderWorkspace).toHaveBeenCalled())
  return { ...view, options: vi.mocked(renderWorkspace).mock.calls.at(-1)![5] }
}

it('applies the persisted playlist without loading the full catalog again', async () => {
  const { options } = await setup()
  vi.mocked(createPlaylist).mockResolvedValue(saved)
  await act(async () => {
    expect(await options.onAddPlaylist(playlistRecords[0])).toEqual(saved)
  })
  expect(createPlaylist).toHaveBeenCalledTimes(1)
  expect(loadCatalog).toHaveBeenCalledTimes(1)
  expect(
    vi.mocked(renderWorkspace).mock.calls.at(-1)![5].playlists,
  ).toContainEqual(saved)
})

it('propagates a failed write without reloading or closing the editor', async () => {
  const { options } = await setup()
  vi.mocked(updatePlaylist).mockRejectedValueOnce(
    new Error('Write unavailable'),
  )
  await act(async () => {
    await expect(options.onUpdatePlaylist(saved)).rejects.toThrow(
      'Write unavailable',
    )
  })
  expect(loadCatalog).toHaveBeenCalledTimes(1)
})

it('does not refresh a session after its view is unmounted while a write is pending', async () => {
  const { options, unmount } = await setup()
  let resolveWrite!: (value: typeof saved) => void
  vi.mocked(createPlaylist).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveWrite = resolve
      }),
  )
  let pending!: ReturnType<typeof options.onAddPlaylist>
  await act(async () => {
    pending = options.onAddPlaylist(playlistRecords[0])
    await Promise.resolve()
  })
  unmount()
  await act(async () => {
    resolveWrite(saved)
    await pending
  })
  expect(loadCatalog).toHaveBeenCalledTimes(1)
})

it('keeps a header-open playlist draft open across same-path history selection changes', async () => {
  await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Add playlist' }))
  expect(vi.mocked(renderWorkspace).mock.calls.at(-1)![1]).toBe(true)
  act(() => {
    window.history.replaceState({}, '', '/playlists?playlist=another-record')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(vi.mocked(renderWorkspace).mock.calls.at(-1)![0]).toBe('/playlists')
  expect(vi.mocked(renderWorkspace).mock.calls.at(-1)![1]).toBe(true)
})
