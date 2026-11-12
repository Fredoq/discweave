import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useStackRefreshingRelations } from './useStackRefreshingRelations'

it('ignores a pending mutation completion after the workspace unmounts', async () => {
  let resolve!: (value: boolean) => void
  const onDeleteRelation = vi.fn(
    () =>
      new Promise<boolean>((done) => {
        resolve = done
      }),
  )
  const refresh = vi.fn()
  const view = renderHook(() =>
    useStackRefreshingRelations({ onDeleteRelation }, refresh),
  )
  const pending = view.result.current.onDeleteRelation!('relation-a')
  view.unmount()
  await act(async () => {
    resolve(true)
    await pending
  })
  expect(refresh).not.toHaveBeenCalled()
})

it('leaves absent mutations absent and does not refresh a rejected write', async () => {
  const refresh = vi.fn()
  const view = renderHook(() =>
    useStackRefreshingRelations(
      {
        onDeleteRelation: () => Promise.reject(new Error('offline')),
      },
      refresh,
    ),
  )
  expect(view.result.current.onAddRelation).toBeUndefined()
  expect(view.result.current.onUpdateRelation).toBeUndefined()
  await expect(view.result.current.onDeleteRelation!('a')).rejects.toThrow(
    'offline',
  )
  expect(refresh).not.toHaveBeenCalled()
})
