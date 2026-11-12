import { useEffect } from 'react'
import { beforeAppNavigation } from '../../app/navigationGuard'

export function usePlaylistNavigationGuard(dirty: boolean, pending: boolean) {
  useEffect(() => {
    if (!dirty && !pending) return
    const guard = (event: Event) => {
      const destination = (event as CustomEvent<{ destination: string }>).detail
        .destination
      // Selection changes keep this editor mounted, including selection of a
      // newly persisted record before the workspace closes its form.
      if (
        new URL(destination, window.location.origin).pathname === '/playlists'
      )
        return
      if (
        pending ||
        !window.confirm(
          'Discard unsaved playlist changes and leave? Your saved playlist will stay unchanged.',
        )
      ) {
        event.preventDefault()
      }
    }
    window.addEventListener(beforeAppNavigation, guard)
    return () => window.removeEventListener(beforeAppNavigation, guard)
  }, [dirty, pending])
}
