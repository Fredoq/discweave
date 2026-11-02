/** Deduplicate repeated provider labels for display without changing catalog facts. */
export function discoverDisplayValues(values: readonly string[]) {
  const seen = new Set<string>()
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(', ')
}
