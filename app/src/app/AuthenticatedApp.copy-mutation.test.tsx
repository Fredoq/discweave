import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthenticatedApp } from './AuthenticatedApp'
import { renderWorkspace } from './renderWorkspace'
import {
  createOwnedItem,
  emptyCatalogState,
  loadCatalog,
} from '../features/catalog/catalogApi'
import { ownedItemRecords } from '../features/ownedItems/ownedItemsData'

vi.mock('./renderWorkspace', () => ({
  manualEntryRoutes: new Set(['/owned-items']),
  renderWorkspace: vi.fn(() => null),
}))
vi.mock('../features/catalog/catalogApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/catalog/catalogApi')>()),
  getInitialCatalogStateForTests: () => null,
  loadCatalog: vi.fn(),
  createOwnedItem: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  window.history.replaceState({}, '', '/')
})

it('reports a persisted copy as saved when only the subsequent refresh fails, preventing duplicate retry', async () => {
  window.history.replaceState({}, '', '/owned-items')
  vi.mocked(loadCatalog)
    .mockResolvedValueOnce(emptyCatalogState)
    .mockRejectedValueOnce(new Error('Refresh unavailable'))
  vi.mocked(createOwnedItem).mockResolvedValue('persisted-copy')
  render(
    <AuthenticatedApp
      sessionEmail="test@example.com"
      sessionRole="Admin"
      sessionError={null}
      onLogout={vi.fn()}
      logoutPending={false}
    />,
  )
  await waitFor(() => expect(renderWorkspace).toHaveBeenCalled())
  const options = vi.mocked(renderWorkspace).mock.calls.at(-1)![5]
  let saved: boolean | string | undefined
  await act(async () => {
    saved = await options.onAddOwnedItem(ownedItemRecords[0])
  })
  expect(saved).toBe('persisted-copy')
  expect(createOwnedItem).toHaveBeenCalledTimes(1)
  expect(loadCatalog).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('alert')).toHaveTextContent('Refresh unavailable')
})
