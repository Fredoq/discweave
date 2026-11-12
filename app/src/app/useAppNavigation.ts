import { useEffect, useRef, useState } from 'react'
import { requestAppNavigation } from './navigationGuard'
import { isAppRoutePath, resolveRoute, type AppRoutePath } from './routes'

export function useAppNavigation({
  onLocationChange,
  onNavigate,
}: {
  onLocationChange: () => void
  onNavigate: () => void
}) {
  const [activeRoute, setActiveRoute] = useState(() =>
    resolveRoute(window.location.pathname),
  )
  const [locationSearch, setLocationSearch] = useState(
    () => window.location.search,
  )

  const acceptedUrl = useRef(currentUrl())

  useEffect(() => {
    const handleLocationChange = () => {
      const nextUrl = currentUrl()
      if (nextUrl !== acceptedUrl.current && !requestAppNavigation(nextUrl)) {
        // popstate has already moved the browser cursor. Restore the editor's
        // URL without unmounting it; an unknown external history entry cannot
        // be safely traversed by index.
        window.history.pushState({}, '', acceptedUrl.current)
        return
      }
      acceptedUrl.current = nextUrl
      setActiveRoute(resolveRoute(window.location.pathname))
      setLocationSearch(window.location.search)
      onLocationChange()
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('discweave:navigation', handleLocationChange)

    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('discweave:navigation', handleLocationChange)
    }
  }, [onLocationChange])

  const navigateToUrl = (href: string, options?: { replace?: boolean }) => {
    const nextUrl = new URL(href, window.location.origin)

    if (
      nextUrl.origin !== window.location.origin ||
      !isAppRoutePath(nextUrl.pathname)
    ) {
      return false
    }

    const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (currentPath !== nextPath) {
      // This is still a handled internal link when the user declines to leave.
      if (!requestAppNavigation(nextPath)) return true
      if (options?.replace) {
        window.history.replaceState({}, '', nextPath)
      } else {
        window.history.pushState({}, '', nextPath)
      }
    }

    acceptedUrl.current = nextPath
    setActiveRoute(resolveRoute(nextUrl.pathname))
    setLocationSearch(nextUrl.search)
    onNavigate()

    return true
  }

  return {
    activeRoute,
    locationSearch,
    navigate: (path: AppRoutePath) => {
      navigateToUrl(path)
    },
    navigateToUrl,
  }
}

function currentUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}
