import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import {
  graphResponseForReleaseWithDuplicateArtists,
  releaseDetailWithoutCover,
  searchResponseWithRelease,
} from '../../test/catalogActionFixtures'
import { ServerCatalogWorkspace } from '../catalog/ServerCatalogWorkspace'
import { ReleasesWorkspace } from './ReleasesWorkspace'
import { releaseRecords } from './releasesData'
h.setupAppTestHooks()
const cover = {
  url: '/api/owned?v=new',
  contentType: 'image/jpeg',
  originalFileName: 'external.jpg',
  sizeBytes: 123,
  sourceType: 'coverArtArchive',
}
const edition = {
  releaseId: 'mb-edition',
  title: 'Edition',
  artists: ['Artist'],
  date: null,
  country: null,
  formats: [],
  labels: [],
  catalogNumbers: [],
  barcode: null,
  sourceUrl: 'https://musicbrainz.org/release/mb-edition',
}
const image = {
  imageId: '123',
  comment: 'Front',
  approved: true,
  types: ['Front'],
  sourceUrl: 'https://coverartarchive.org/release/mb-edition/123.jpg',
}
async function apply() {
  const user = h.userEvent.setup()
  await user.click(await h.screen.findByRole('button', { name: 'Find cover' }))
  await user.click(h.screen.getByRole('button', { name: 'Search editions' }))
  await user.click(
    await h.screen.findByRole('button', { name: 'Show covers for Edition' }),
  )
  await user.click(
    await h.screen.findByRole('button', { name: 'Use this cover' }),
  )
}
describe('cover changes notify the existing workspace data owner', () => {
  it('refreshes canonical release data for back navigation without replacing unrelated metadata', async () => {
    const onCatalogChanged = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(h.jsonResponse({ items: [edition] }))
        .mockResolvedValueOnce(h.jsonResponse({ items: [image] }))
        .mockResolvedValueOnce(h.jsonResponse(cover))
        .mockResolvedValue(h.jsonResponse({ provenance: null })),
    )
    function Workspace() {
      const [record, setRecord] = useState({
        ...releaseRecords[0],
        title: 'My album',
      })
      return (
        <ReleasesWorkspace
          releases={[
            record,
            { ...releaseRecords[1], id: 'other', title: 'Other album' },
          ]}
          onCatalogChanged={() => {
            onCatalogChanged()
            setRecord((current) => ({ ...current, coverImage: cover }))
          }}
        />
      )
    }
    h.render(<Workspace />)
    await apply()
    await h.waitFor(() => expect(onCatalogChanged).toHaveBeenCalledTimes(1))
    const user = h.userEvent.setup()
    await user.click(h.screen.getByRole('button', { name: /Other album/ }))
    await user.click(h.screen.getByRole('button', { name: /My album/ }))
    expect(
      h.screen.getByRole('img', { name: 'My album cover' }),
    ).toHaveAttribute('src', cover.url)
    expect(h.screen.getByRole('heading', { name: 'My album' })).toBeVisible()
  })
  it('forwards successful catalog-preview saves to catalog refresh', async () => {
    const onCatalogChanged = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(searchResponseWithRelease())
        .mockResolvedValueOnce(graphResponseForReleaseWithDuplicateArtists())
        .mockResolvedValueOnce(releaseDetailWithoutCover())
        .mockResolvedValueOnce(h.jsonResponse({ items: [edition] }))
        .mockResolvedValueOnce(h.jsonResponse({ items: [image] }))
        .mockResolvedValueOnce(h.jsonResponse(cover))
        .mockResolvedValueOnce(h.jsonResponse({ provenance: null })),
    )
    h.render(
      <ServerCatalogWorkspace
        labels={[]}
        locationSearch=""
        searchRefreshKey={0}
        onCatalogChanged={onCatalogChanged}
      />,
    )
    await h.userEvent
      .setup()
      .click(await h.screen.findByRole('button', { name: 'Preview Stripped' }))
    await h.screen.findByText('No cover image recorded')
    await apply()
    await h.waitFor(() => expect(onCatalogChanged).toHaveBeenCalledTimes(1))
    expect(
      h.screen.getByRole('img', { name: 'Stripped cover' }),
    ).toHaveAttribute('src', cover.url)
  })
  it('does not let a slow initial catalog cover read replace a successful external save', async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(searchResponseWithRelease())
      .mockResolvedValueOnce(graphResponseForReleaseWithDuplicateArtists())
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(h.jsonResponse({ items: [edition] }))
      .mockResolvedValueOnce(h.jsonResponse({ items: [image] }))
      .mockResolvedValueOnce(h.jsonResponse(cover))
      .mockResolvedValueOnce(h.jsonResponse({ provenance: null }))
    vi.stubGlobal('fetch', fetch)
    const onCatalogChanged = vi.fn()
    h.render(
      <ServerCatalogWorkspace
        labels={[]}
        locationSearch=""
        searchRefreshKey={0}
        onCatalogChanged={onCatalogChanged}
      />,
    )
    await h.userEvent
      .setup()
      .click(await h.screen.findByRole('button', { name: 'Preview Stripped' }))
    await apply()
    await h.waitFor(() => expect(onCatalogChanged).toHaveBeenCalledTimes(1))
    await h.act(async () => {
      finish(releaseDetailWithoutCover())
      await pending
    })
    expect(
      h.screen.getByRole('img', { name: 'Stripped cover' }),
    ).toHaveAttribute('src', cover.url)
  })
})
