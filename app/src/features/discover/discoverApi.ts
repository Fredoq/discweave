import { sendJson } from '../catalog/api/httpClient'
import type { DiscoverFeedback } from './discoverTypes'

export function discoverBridge() {
  return globalThis.window?.discweaveDesktop?.discover
}

export async function saveDiscoverFeedback(
  externalId: string,
  kind: DiscoverFeedback,
  signal: AbortSignal,
) {
  await sendJson(
    '/api/discover/feedback',
    'POST',
    { externalId, kind },
    { signal },
  )
}

export function safeDiscogsUrl(url: string, externalId: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' &&
      ['discogs.com', 'www.discogs.com'].includes(parsed.hostname) &&
      parsed.pathname.match(/^\/release\/(\d+)(?:-|$)/)?.[1] === externalId &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : null
  } catch {
    return null
  }
}

export function appleMusicSearchUrl(artists: string[], title: string) {
  return `https://music.apple.com/search?term=${encodeURIComponent([...artists, title].join(' '))}`
}

export async function createRecommendedReleaseDraft(
  discogsReleaseId: string,
  idempotencyKey: string,
  signal: AbortSignal,
) {
  return sendJson<import('../catalog/catalogApi').ReleaseImportSession>(
    '/api/imports/recommended-release-drafts',
    'POST',
    { discogsReleaseId, idempotencyKey },
    { signal },
  )
}
