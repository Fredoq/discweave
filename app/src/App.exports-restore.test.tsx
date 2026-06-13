import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App JSON restore imports', () => {
  it('restores JSON backups without a full catalog reload', async () => {
    window.history.pushState({}, '', '/imports')
    h.clearCatalogForTests()
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    const fetchMock = h.mockFetch(
      h.emptyImportSessionsResponse(),
      h.jsonResponse({
        restored: true,
        formatVersion: 1,
        artists: 1,
        labels: 1,
        releases: 1,
        tracks: 1,
        ownedItems: 1,
        playlists: 0,
        credits: 1,
        artistRelations: 0,
        trackRelations: 0,
        dictionaries: 10,
        importPatterns: 2,
        ratingCriteria: 1,
        ratings: 0,
      }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const restoreInput = await h.screen.findByLabelText(/restore json backup/i)
    await h.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => url === '/api/imports?limit=100&offset=0',
        ),
      ).toBe(true),
    )

    await user.upload(
      restoreInput,
      new File([JSON.stringify({ formatVersion: 1 })], 'discweave.json', {
        type: 'application/json',
      }),
    )

    await h.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => url === '/api/exports/json/restore',
        ),
      ).toBe(true),
    )
    const restoreCall = fetchMock.mock.calls.find(
      ([url]) => url === '/api/exports/json/restore',
    )
    expect(restoreCall).toBeDefined()
    expect(restoreCall?.[1]).toMatchObject({
      body: JSON.stringify({ formatVersion: 1 }),
      credentials: 'include',
      method: 'POST',
    })
    expect((restoreCall?.[1] as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-DiscWeave-Confirm-Restore': 'restore-empty-collection',
    })
    expect(
      await h.screen.findByText(
        'JSON restore completed: 1 artists, 1 releases, 1 tracks, 1 owned items.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the empty collection restore requirement from the API', async () => {
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      h.jsonResponse(
        {
          code: 'export_restore.collection_not_empty',
          message: 'Collection is not empty',
        },
        409,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.upload(
      h.screen.getByLabelText(/restore json backup/i),
      new File([JSON.stringify({ formatVersion: 1 })], 'discweave.json', {
        type: 'application/json',
      }),
    )

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Restore requires an empty collection.',
    )
  })

  it('rejects invalid JSON restore files before calling the API', async () => {
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch()
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.upload(
      h.screen.getByLabelText(/restore json backup/i),
      new File(['{invalid'], 'discweave.json', { type: 'application/json' }),
    )

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Select a valid JSON backup.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
