import { sendJson } from '../catalog/api/httpClient'

export type ReleaseDatePreview = {
  token: string | null
  currentTitle: string
  currentArtists: string[]
  currentCatalogNumbers: string[]
  currentLabels: string[]
  currentYear: number | null
  currentDate: string | null
  source: { externalId: string; sourceUrl: string; attribution: string }
  title: string
  artists: string[]
  catalogNumber: string | null
  labels: string[]
  formats: string[]
  date: {
    kind: 'year' | 'yearMonth' | 'fullDate'
    year: number
    month?: number
    day?: number
  } | null
}

export function previewReleaseDate(id: string, discogsReleaseId: string) {
  return sendJson<ReleaseDatePreview>(
    `/api/releases/${encodeURIComponent(id)}/date-preview`,
    'POST',
    { discogsReleaseId },
  )
}

export function applyReleaseDate(id: string, token: string) {
  return sendJson(
    `/api/releases/${encodeURIComponent(id)}/date-apply`,
    'POST',
    { token, confirmed: true },
  )
}

export function discogsReleaseId(value: string): string | null {
  const trimmed = value.trim()
  if (/^[1-9]\d*$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    if (
      url.protocol !== 'https:' ||
      !['www.discogs.com', 'discogs.com'].includes(url.hostname)
    )
      return null
    return /^\/release\/([1-9]\d*)(?:-|\/|$)/.exec(url.pathname)?.[1] ?? null
  } catch {
    return null
  }
}

export function dateEvidenceLabel(date: ReleaseDatePreview['date']): string {
  if (!date) return 'No reliable date available'
  const year = String(date.year).padStart(4, '0')
  if (date.kind === 'year') return year
  const month = String(date.month).padStart(2, '0')
  return date.kind === 'yearMonth'
    ? `${year}-${month}`
    : `${year}-${month}-${String(date.day).padStart(2, '0')}`
}
