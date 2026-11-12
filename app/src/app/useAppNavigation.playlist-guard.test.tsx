import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppNavigation } from './useAppNavigation'
import { usePlaylistNavigationGuard } from '../features/playlists/usePlaylistNavigationGuard'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
})
function setup(dirty = true, pending = false) {
  window.history.replaceState({}, '', '/playlists')
  const onNavigate = vi.fn()
  const onLocationChange = vi.fn()
  const hook = renderHook(() => {
    const navigation = useAppNavigation({ onNavigate, onLocationChange })
    usePlaylistNavigationGuard(dirty, pending)
    return navigation
  })
  return { ...hook, onNavigate, onLocationChange }
}
it('keeps an unsaved editor and its URL when sidebar or link navigation is declined', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { result, onNavigate } = setup()
  act(() => result.current.navigate('/tracks'))
  expect(window.location.pathname).toBe('/playlists')
  expect(onNavigate).not.toHaveBeenCalled()
  expect(result.current.activeRoute.path).toBe('/playlists')
  let handled = false
  act(() => {
    handled = result.current.navigateToUrl('/releases')
  })
  expect(handled).toBe(true)
  expect(window.location.pathname).toBe('/playlists')
})
it('allows an explicitly confirmed departure', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const { result } = setup()
  act(() => result.current.navigate('/tracks'))
  expect(window.location.pathname).toBe('/tracks')
  expect(result.current.activeRoute.path).toBe('/tracks')
})
it('blocks departure during save without showing a discard confirmation', () => {
  const confirm = vi.spyOn(window, 'confirm')
  const { result } = setup(true, true)
  act(() => result.current.navigate('/tracks'))
  expect(window.location.pathname).toBe('/playlists')
  expect(confirm).not.toHaveBeenCalled()
})
it('restores the editor URL if a history event attempts an unconfirmed departure', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { result, onLocationChange } = setup()
  act(() => {
    window.history.replaceState({}, '', '/tracks')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(window.location.pathname).toBe('/playlists')
  expect(result.current.activeRoute.path).toBe('/playlists')
  expect(onLocationChange).not.toHaveBeenCalled()
})
it('allows selection changes that keep the editor mounted, including the saved server identity', () => {
  const confirm = vi.spyOn(window, 'confirm')
  const { result } = setup(true, true)
  act(() => {
    window.history.pushState({}, '', '/playlists?playlist=server-id')
    window.dispatchEvent(new Event('discweave:navigation'))
  })
  expect(result.current.locationSearch).toBe('?playlist=server-id')
  expect(confirm).not.toHaveBeenCalled()
})
it('unregisters the guard when its editor unmounts', () => {
  const confirm = vi.spyOn(window, 'confirm')
  const { unmount } = setup()
  unmount()
  const event = new CustomEvent('discweave:before-navigation', {
    cancelable: true,
    detail: { destination: '/tracks' },
  })
  expect(window.dispatchEvent(event)).toBe(true)
  expect(confirm).not.toHaveBeenCalled()
})
