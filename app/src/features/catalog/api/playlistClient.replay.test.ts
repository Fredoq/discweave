import { beforeEach, expect, it, vi } from 'vitest'
import { createPlaylist, updatePlaylist } from './playlistClient'
import { sendJson } from './httpClient'
import { playlistRecords } from '../../playlists/playlistsData'

vi.mock('./testCatalogStore', () => ({ updateTestCatalogState: () => false }))
vi.mock('./httpClient', () => ({
  sendJson: vi.fn(),
  getAllPages: vi.fn(),
  getJson: vi.fn(),
  sendDelete: vi.fn(),
}))
beforeEach(() => vi.resetAllMocks())
const requestId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const record = {
  ...playlistRecords[0],
  clientRequestId: requestId,
  serverEntries: [],
}
const response = {
  id: requestId,
  name: record.name,
  description: '',
  type: 'manual',
  entries: [],
  results: [],
  rules: null,
}

it('reuses the stable create identity after a lost response instead of requesting a new playlist identity', async () => {
  vi.mocked(sendJson)
    .mockRejectedValueOnce(new TypeError('Response lost'))
    .mockResolvedValueOnce(response)
  await expect(createPlaylist(record)).rejects.toThrow('Response lost')
  expect((await createPlaylist(record)).id).toBe(requestId)
  for (const call of vi.mocked(sendJson).mock.calls) {
    expect(call[0]).toBe('/api/playlists')
    expect(call[1]).toBe('POST')
    expect(call[2]).toMatchObject({
      clientRequestId: requestId,
    })
  }
})
it('does not send a create request identity with ordinary updates', async () => {
  vi.mocked(sendJson).mockResolvedValue(response)
  await updatePlaylist(record)
  expect(vi.mocked(sendJson).mock.calls[0][1]).toBe('PUT')
  expect(vi.mocked(sendJson).mock.calls[0][2]).not.toHaveProperty(
    'clientRequestId',
  )
})
