import type { LabelDiscogsRelease } from './labelDiscogsApi'

// A search key, never a replacement for the number printed on an edition.
export function catalogSearchKey(value: string) {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}
export function hasCatalogNumber(value: string) {
  return value.trim().length > 0 && value.trim().toLowerCase() !== 'none'
}
export function suggestedCatalogPrefix(value: string) {
  if (!hasCatalogNumber(value)) return ''
  const key = catalogSearchKey(value)
  // Keep leading numbers in brands such as 50WEAPONS; the final numeric run
  // belongs to the release number. A suffix may be edition-specific.
  return /^(.*?\p{L}+)(?=\d)/u.exec(key)?.[1] ?? ''
}
export function catalogPrefixOptions(
  items: LabelDiscogsRelease[],
  selected: string[],
) {
  const values = new Set(selected)
  for (const item of items) {
    const prefix = suggestedCatalogPrefix(item.catalogNumber)
    if (prefix) values.add(prefix)
  }
  const counts = [...values].map((prefix): [string, number] => [
    prefix,
    items.filter(
      (item) =>
        hasCatalogNumber(item.catalogNumber) &&
        catalogSearchKey(item.catalogNumber).startsWith(
          catalogSearchKey(prefix),
        ),
    ).length,
  ])
  return [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true }),
  )
}
export function filterDiscogsCatalog(
  items: LabelDiscogsRelease[],
  prefixes: string[],
  query: string,
) {
  const text = query.trim().toLowerCase()
  const number = catalogSearchKey(query)
  return items
    .filter((item) => {
      const catno = catalogSearchKey(item.catalogNumber)
      const matchesPrefix =
        prefixes.length === 0 ||
        (hasCatalogNumber(item.catalogNumber) &&
          prefixes.some((prefix) => catno.startsWith(catalogSearchKey(prefix))))
      const matchesQuery =
        !text ||
        `${item.artist} ${item.title} ${item.year} ${item.format}`
          .toLowerCase()
          .includes(text) ||
        (hasCatalogNumber(item.catalogNumber) &&
          number.length > 0 &&
          catno.includes(number))
      return matchesPrefix && matchesQuery
    })
    .sort((a, b) => {
      const aHasNumber = hasCatalogNumber(a.catalogNumber)
      const bHasNumber = hasCatalogNumber(b.catalogNumber)
      if (aHasNumber !== bHasNumber) return aHasNumber ? -1 : 1
      return (
        catalogSearchKey(a.catalogNumber).localeCompare(
          catalogSearchKey(b.catalogNumber),
          'en',
          { numeric: true },
        ) ||
        a.catalogNumber.localeCompare(b.catalogNumber) ||
        a.externalId.localeCompare(b.externalId, 'en', { numeric: true })
      )
    })
}
