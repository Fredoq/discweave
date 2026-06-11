import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const handleLocationChange = () => {
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

  const navigateToUrl = (href: string) => {
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
      window.history.pushState({}, '', nextPath)
    }

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
