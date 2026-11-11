import type {
  ReleaseImportSession,
  ReleaseImportDraft,
} from '../catalog/catalogApi'
import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import {
  importSessionDetailResponse,
  importSessionListResponse,
} from '../../test/importsDesktopFixtures'

h.setupAppTestHooks()

async function setupSession(search: string, pending = true) {
  vi.stubGlobal('__discweaveUseRealCatalogApi', true)
  window.history.pushState({}, '', `/imports?session=import-session-1${search}`)
  const session = (await importSessionDetailResponse(
    'confirmed',
  ).json()) as ReleaseImportSession & { drafts: ReleaseImportDraft[] }
  const first = session.drafts[0]
  first.title = 'Finished release'
  session.drafts = [
    first,
    { ...first, id: 'skipped', title: 'Skipped release', status: 'skipped' },
  ]
  if (pending) {
    session.drafts.push({
      ...first,
      id: 'pending',
      title: 'Pending release',
      status: 'needsReview',
    })
  }
  session.looseFileCandidates = [
    {
      id: 'loose-1',
      filePath: '/Music/Loose.flac',
      relativePath: 'Loose.flac',
      format: 'flac',
      sizeBytes: 100,
      lastModifiedAt: '',
      artistHints: [],
      albumArtistHints: [],
      reason: 'mixed_album_tags',
      decision: 'pending',
      createdAt: '',
      updatedAt: '',
    },
  ]
  session.looseFileCandidateCount = 1
  session.draftCount = session.drafts.length
  h.mockFetch(importSessionListResponse(), h.jsonResponse(session))
  h.render(<h.App />)
  await h.screen.findByText('Session loaded')
}

describe('Import continuation navigation', () => {
  it('continues at the first pending release rather than a finished or skipped draft', async () => {
    await setupSession('&resume=pending')
    expect(await h.screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
      'Pending release',
    )
  })

  it('keeps an explicit draft selection ahead of pending continuation', async () => {
    await setupSession('&resume=pending&draft=draft-1')
    expect(await h.screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
      'Finished release',
    )
  })

  it('preserves ordinary session opening for history', async () => {
    await setupSession('')
    expect(await h.screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
      'Finished release',
    )
  })

  it('leaves the release editor closed when only loose files remain', async () => {
    await setupSession('&resume=pending', false)
    expect(
      h.screen.queryByRole('textbox', { name: 'Title' }),
    ).not.toBeInTheDocument()
    expect(await h.screen.findByText('Loose.flac')).toBeVisible()
  })
})
