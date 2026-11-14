import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import { importSessionDetailResponse } from '../../test/importsDesktopFixtures'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import { DraftEditor } from './ImportDraftEditor'
h.setupAppTestHooks()
describe('cover selection in the import editor', () => {
  it('protects save and confirmation while preserving metadata edited during cover save', async () => {
    const user = h.userEvent.setup()
    const session = (await importSessionDetailResponse(
      'needsReview',
    ).json()) as { id: string; drafts: ReleaseImportDraft[] }
    const cover = {
      id: 'front',
      fileName: 'front.png',
      contentType: 'image/png',
      sizeBytes: 1024,
      url: '/api/front',
      sourcePath: '/music/front.png',
    }
    const initial = {
      selected: null,
      candidates: [cover],
      canEdit: true,
      warnings: [],
    }
    let finish!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(h.jsonResponse(initial))
        .mockReturnValueOnce(pending),
    )
    const onSave = vi.fn(),
      onConfirm = vi.fn(),
      onSkip = vi.fn(),
      onCoverPendingChange = vi.fn()
    function Editor() {
      const [draft, setDraft] = useState<ReleaseImportDraft>(session.drafts[0])
      return (
        <>
          <DraftEditor
            sessionId={session.id}
            actionError={null}
            artists={[]}
            creditRoleOptions={h.defaultCatalogDictionaries.creditRole}
            dictionaries={h.defaultCatalogDictionaries}
            draft={draft}
            genreOptions={h.defaultCatalogDictionaries.genre}
            releaseTypeOptions={h.defaultCatalogDictionaries.releaseType}
            validationMessage="Ready"
            onChange={setDraft}
            onSave={onSave}
            onConfirm={onConfirm}
            onSkip={onSkip}
            onCoverPendingChange={onCoverPendingChange}
          />
          <output aria-label="Draft state">{JSON.stringify(draft)}</output>
        </>
      )
    }
    h.render(<Editor />)
    await user.click(
      await h.screen.findByRole('button', { name: 'Use front.png as cover' }),
    )
    expect(onCoverPendingChange).toHaveBeenLastCalledWith(true)
    for (const name of ['Save', 'Confirm', 'Skip'])
      expect(h.screen.getByRole('button', { name })).toBeDisabled()
    const title = h.screen.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'My edited title')
    await h.act(async () => {
      finish(h.jsonResponse({ ...initial, selected: cover }))
      await pending
    })
    await h.waitFor(() =>
      expect(h.screen.getByRole('button', { name: 'Save' })).toBeEnabled(),
    )
    expect(onCoverPendingChange).toHaveBeenLastCalledWith(false)
    expect(title).toHaveValue('My edited title')
    const saved = JSON.parse(
      h.screen.getByLabelText('Draft state').textContent ?? '{}',
    ) as { title: string; coverPath: string }
    expect(saved.title).toBe('My edited title')
    expect(saved.coverPath).toBe(cover.sourcePath)
    expect(onSave).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
  })
})
