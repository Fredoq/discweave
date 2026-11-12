import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrackDigitalFile, TrackRecord } from '../tracks/tracksData'
import type { PlaylistRecord } from './playlistsData'
import type {
  PlaylistExportBridge,
  PlaylistExportInspection,
  PlaylistExportStatus,
} from './playlistExportTypes'
import { PlaylistExportPanel } from './PlaylistExportPanel'

function file(id: string): TrackDigitalFile {
  return {
    digitalTrackFileLinkId: `link-${id}`,
    localAudioFileId: `local-${id}`,
    digitalOwnedItemId: 'copy-demo',
    releaseId: 'release-demo',
    releaseTitle: 'Demo album',
    releaseTrackId: `release-track-${id}`,
    position: '1',
    path: `/synthetic/audio/${id}.flac`,
    format: 'FLAC',
    codec: 'FLAC',
    quality: 'Lossless',
    contentHash: '',
    duration: '3:00',
    bitrate: '',
    sampleRate: '',
    channels: '',
  }
}
function track(
  id: string,
  files: TrackDigitalFile[] = [file(id)],
): TrackRecord {
  return {
    id,
    title: id,
    artist: 'Demo artist',
    release: {
      title: 'Demo album',
      artist: 'Demo artist',
      year: '',
      label: '',
    },
    trackNumber: '',
    duration: '3:00',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: files,
  }
}
function playlist(ids = ['A', 'B', 'A']): PlaylistRecord {
  return {
    id: 'playlist-demo',
    name: 'Evening',
    description: '',
    type: 'Manual',
    curator: '',
    updatedAt: '',
    yearRange: '',
    ruleHints: [],
    linkedReleases: [],
    tracks: [],
    serverEntries: ids.map((id) => ({ kind: 'track', id, title: id })),
    manualSelection: { source: '', note: '' },
  }
}
function inspection(
  statuses: PlaylistExportStatus[],
  inspectionId = 'inspection-1',
): PlaylistExportInspection {
  return {
    inspectionId,
    availableCount: statuses.filter((status) => status === 'available').length,
    entries: statuses.map((status, index) => ({
      key: `entry-${index}`,
      status,
      message: status === 'missing' ? 'File missing from this Mac' : undefined,
    })),
  }
}
function setupBridge(
  statuses: PlaylistExportStatus[] = ['available', 'available', 'available'],
) {
  const inspect = vi
    .fn<PlaylistExportBridge['inspect']>()
    .mockResolvedValue(inspection(statuses))
  const save = vi.fn<PlaylistExportBridge['export']>().mockResolvedValue({
    cancelled: false,
    path: '/synthetic/output/Evening.m3u8',
    exportedCount: statuses.filter((status) => status === 'available').length,
    omittedCount: statuses.filter((status) => status !== 'available').length,
  })
  vi.stubGlobal('discweaveDesktop', {
    isDesktop: true,
    playlists: { inspect, export: save },
  })
  return { inspect, save }
}
afterEach(() => vi.unstubAllGlobals())

describe('PlaylistExportPanel', () => {
  it('automatically selects sole file links and preserves order and repeated occurrences in export', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge()
    render(
      <PlaylistExportPanel
        playlist={playlist()}
        tracks={[track('A'), track('B')]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    const entries = bridge.inspect.mock.calls[0][0].entries
    expect(entries.map((entry) => entry.trackId)).toEqual(['A', 'B', 'A'])
    expect(entries.map((entry) => entry.key)).toEqual([
      'entry-0',
      'entry-1',
      'entry-2',
    ])
    expect(entries.map((entry) => entry.file?.path)).toEqual([
      '/synthetic/audio/A.flac',
      '/synthetic/audio/B.flac',
      '/synthetic/audio/A.flac',
    ])
    await user.click(screen.getByRole('button', { name: 'Save M3U8' }))
    expect(bridge.save).toHaveBeenCalledWith({
      name: 'Evening',
      entries,
      allowPartial: false,
      inspectionId: 'inspection-1',
    })
    expect(await screen.findByText(/Saved 3 tracks/)).toBeInTheDocument()
  })
  it('requires an explicit file choice for every multi-file occurrence', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge(['available'])
    render(
      <PlaylistExportPanel
        playlist={playlist(['A'])}
        tracks={[track('A', [file('first'), file('second')])]}
        onClose={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('combobox', { name: 'Audio file for track 1' }),
    ).toHaveValue('')
    expect(
      screen.getByRole('button', { name: 'Check local files' }),
    ).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox'), '1')
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    expect(bridge.inspect.mock.calls[0][0].entries[0].file?.path).toBe(
      '/synthetic/audio/second.flac',
    )
  })
  it('shows unavailable tracks and requires explicit consent to omit them', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge(['available', 'unlinked'])
    render(
      <PlaylistExportPanel
        playlist={playlist(['A', 'B'])}
        tracks={[track('A'), track('B', [])]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('No linked local audio file')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 of 2 tracks available; 1 unavailable',
    )
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Save M3U8' }))
    expect(bridge.save.mock.calls[0][0].allowPartial).toBe(true)
    expect(bridge.save.mock.calls[0][0].entries).toHaveLength(2)
    expect(
      await screen.findByText(/1 unavailable tracks omitted/),
    ).toBeInTheDocument()
  })
  it('does not permit export when no files are available', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge(['missing'])
    render(
      <PlaylistExportPanel
        playlist={playlist(['A'])}
        tracks={[track('A')]}
        onClose={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    expect(screen.getByText('File missing from this Mac')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeDisabled()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(bridge.save).not.toHaveBeenCalled()
  })
  it('reports a cancelled save without claiming a file was written', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge(['available'])
    bridge.save.mockResolvedValueOnce({ cancelled: true })
    render(
      <PlaylistExportPanel
        playlist={playlist(['A'])}
        tracks={[track('A')]}
        onClose={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    await user.click(screen.getByRole('button', { name: 'Save M3U8' }))
    expect(
      await screen.findByText('Export cancelled. No playlist file was saved.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeEnabled()
  })
  it('requires fresh partial-export consent after file availability changes', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge(['available', 'missing', 'available'])
    bridge.save.mockResolvedValueOnce({
      cancelled: false,
      blocked: true,
      ...inspection(['available', 'missing', 'missing'], 'inspection-2'),
    })
    render(
      <PlaylistExportPanel
        playlist={playlist()}
        tracks={[track('A'), track('B')]}
        onClose={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Save M3U8' }))
    expect(
      await screen.findByText(/File availability changed/),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Save M3U8' }))
    expect(bridge.save.mock.calls[1][0]).toMatchObject({
      inspectionId: 'inspection-2',
      allowPartial: true,
    })
  })
  it('invalidates the inspection when a different local file is selected', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge(['available'])
    render(
      <PlaylistExportPanel
        playlist={playlist(['A'])}
        tracks={[track('A', [file('first'), file('second')])]}
        onClose={vi.fn()}
      />,
    )
    await user.selectOptions(screen.getByRole('combobox'), '0')
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeEnabled()
    await user.selectOptions(screen.getByRole('combobox'), '1')
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeDisabled()
    expect(screen.queryByText('Available on this Mac')).not.toBeInTheDocument()
    expect(bridge.save).not.toHaveBeenCalled()
  })
  it('prevents duplicate async requests and retains file choices after an export error', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge(['available'])
    let resolveInspect!: (result: PlaylistExportInspection) => void
    bridge.inspect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInspect = resolve
        }),
    )
    render(
      <PlaylistExportPanel
        playlist={playlist(['A'])}
        tracks={[track('A', [file('first'), file('second')])]}
        onClose={vi.fn()}
      />,
    )
    await user.selectOptions(screen.getByRole('combobox'), '1')
    const check = screen.getByRole('button', { name: 'Check local files' })
    fireEvent.click(check)
    fireEvent.click(check)
    expect(bridge.inspect).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Close export' })).toBeDisabled()
    await act(async () => {
      resolveInspect(inspection(['available']))
      await Promise.resolve()
    })
    let rejectSave!: (error: Error) => void
    bridge.save.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject
        }),
    )
    const save = screen.getByRole('button', { name: 'Save M3U8' })
    fireEvent.click(save)
    fireEvent.click(save)
    expect(bridge.save).toHaveBeenCalledOnce()
    await act(async () => {
      rejectSave(new Error('Cannot write output'))
      await Promise.resolve()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot write output')
    expect(screen.getByRole('combobox')).toHaveValue('1')
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save M3U8' }))
    expect(bridge.save).toHaveBeenCalledTimes(2)
  })
  it('reports inspection errors and allows retry without losing the selection', async () => {
    const user = userEvent.setup()
    const bridge = setupBridge(['available'])
    bridge.inspect.mockRejectedValueOnce(new Error('File check unavailable'))
    render(
      <PlaylistExportPanel
        playlist={playlist(['A'])}
        tracks={[track('A')]}
        onClose={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'File check unavailable',
    )
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Check local files' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeEnabled(),
    )
    expect(bridge.inspect).toHaveBeenCalledTimes(2)
  })
  it('explains the desktop requirement in a browser without invoking export', () => {
    vi.stubGlobal('discweaveDesktop', undefined)
    render(
      <PlaylistExportPanel
        playlist={playlist(['A'])}
        tracks={[track('A')]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'require the desktop app',
    )
    expect(
      screen.getByRole('button', { name: 'Check local files' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save M3U8' })).toBeDisabled()
  })
})
