export const beforeAppNavigation = 'discweave:before-navigation'

/** False means an active editor declined the navigation. */
export function requestAppNavigation(destination: string) {
  return window.dispatchEvent(
    new CustomEvent(beforeAppNavigation, {
      cancelable: true,
      detail: { destination },
    }),
  )
}
