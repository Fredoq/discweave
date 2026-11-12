const PAGE_SIZE = 100
const MAX_ROWS = 50000

function catalogError(code, message) {
  return Object.assign(new Error(message), { code })
}
function invalid() {
  return catalogError(
    'catalog_incomplete',
    'The catalog changed or returned incomplete metadata. Reload and try again.',
  )
}
function checkAbort(signal) {
  signal?.throwIfAborted()
}
function id(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200)
    throw invalid()
  return value
}
function text(value) {
  if (typeof value !== 'string') throw invalid()
  return value.trim()
}
function list(value) {
  if (!Array.isArray(value)) throw invalid()
  return value
}
function strings(value) {
  return [...new Set(list(value).map(text).filter(Boolean))]
}
function names(value, field) {
  return strings(list(value).map((item) => item?.[field]))
}
function recordingArtists(credits) {
  const annotated = list(credits).map((credit) => ({
    name: text(credit?.artistName),
    roles: credit.roles?.length
      ? strings(credit.roles)
      : [credit.role ?? credit.primaryRole],
  }))
  const main = annotated.filter((credit) => credit.roles.includes('mainArtist'))
  const visible = main.length
    ? main
    : annotated.filter((credit) =>
        credit.roles.some(
          (role) => role === 'performer' || role === 'featuredArtist',
        ),
      )
  return [...new Set(visible.map((credit) => credit.name).filter(Boolean))]
}
function optionalNumber(value) {
  if (value == null) return null
  if (!Number.isSafeInteger(value)) throw invalid()
  return value
}

async function pages(sender, fetchBackend, route, signal) {
  const items = []
  const seen = new Set()
  let expectedTotal
  for (let offset = 0; ; offset += PAGE_SIZE) {
    checkAbort(signal)
    const separator = route.includes('?') ? '&' : '?'
    const page = await fetchBackend(
      sender,
      `${route}${separator}limit=${PAGE_SIZE}&offset=${offset}`,
      { signal },
    )
    checkAbort(signal)
    if (
      !page ||
      !Number.isSafeInteger(page.total) ||
      page.total < 0 ||
      page.offset !== offset ||
      page.limit !== PAGE_SIZE ||
      !Array.isArray(page.items)
    )
      throw invalid()
    if (page.total > MAX_ROWS)
      throw catalogError(
        'catalog_too_large',
        'This catalog exceeds the supported 50,000-record retrieval limit. No partial catalog was used.',
      )
    expectedTotal ??= page.total
    if (
      page.total !== expectedTotal ||
      page.items.length !== Math.min(PAGE_SIZE, expectedTotal - offset)
    )
      throw invalid()
    for (const item of page.items) {
      const key = id(item?.id)
      if (seen.has(key)) throw invalid()
      seen.add(key)
      items.push(item)
    }
    if (items.length === expectedTotal) return items
  }
}

/** All source records come from collection-scoped backend routes, never renderer data. */
async function loadPlaylistSuggestionCatalog(
  sender,
  fetchBackend,
  { signal } = {},
) {
  const tracks = await pages(sender, fetchBackend, '/api/tracks', signal)
  const releases = await pages(sender, fetchBackend, '/api/releases', signal)
  checkAbort(signal)
  // This endpoint deliberately returns all criteria in one list, not paginated.
  const criteria = await fetchBackend(sender, '/api/rating-criteria', {
    signal,
  })
  checkAbort(signal)
  if (
    !criteria ||
    !Array.isArray(criteria.items) ||
    criteria.offset !== 0 ||
    criteria.total !== criteria.items.length ||
    criteria.limit !== criteria.items.length
  )
    throw invalid()
  const overall = criteria.items.filter((item) => item.code === 'overall')
  if (overall.length > 1) throw invalid()
  const ratings = overall.length
    ? await pages(
        sender,
        fetchBackend,
        `/api/ratings?targetType=track&criterionId=${encodeURIComponent(id(overall[0].id))}`,
        signal,
      )
    : []
  const ratingByTrack = new Map()
  const trackIds = new Set(tracks.map((track) => track.id))
  for (const rating of ratings) {
    if (
      rating.targetType !== 'track' ||
      rating.criterionId !== overall[0].id ||
      !trackIds.has(rating.targetId) ||
      ratingByTrack.has(rating.targetId) ||
      !Number.isInteger(rating.value) ||
      rating.value < 1 ||
      rating.value > 5
    )
      throw invalid()
    ratingByTrack.set(rating.targetId, rating.value)
  }
  const releaseById = new Map(releases.map((release) => [release.id, release]))
  const result = tracks.map((track) => {
    const appearanceIds = [
      ...new Set(
        list(track.releaseAppearances).map((appearance) =>
          id(appearance?.releaseId),
        ),
      ),
    ]
    const appearances = appearanceIds.map((releaseId) => {
      const release = releaseById.get(releaseId)
      if (!release) throw invalid()
      return {
        title: text(release.title),
        year: optionalNumber(release.year),
        artists: recordingArtists(release.artistCredits),
        labels: names(release.labels, 'name'),
        genres: strings(release.genres),
      }
    })
    const artists = recordingArtists(track.credits)
    return {
      id: track.id,
      title: text(track.title),
      artists: artists.length
        ? artists
        : [...new Set(appearances.flatMap((release) => release.artists))],
      durationSeconds: optionalNumber(track.durationSeconds),
      genres: strings(track.genres),
      tags: strings(track.tags),
      releases: appearances,
      overallRating: ratingByTrack.get(track.id) ?? null,
    }
  })
  checkAbort(signal)
  return result
}
function createPlaylistSuggestionCatalog({ backend }) {
  return (sender, options) =>
    loadPlaylistSuggestionCatalog(sender, backend, options)
}
module.exports = {
  createPlaylistSuggestionCatalog,
  loadPlaylistSuggestionCatalog,
}
