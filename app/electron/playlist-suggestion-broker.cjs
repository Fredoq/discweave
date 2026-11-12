const { metadataTruncated } = require('./playlist-suggestion-openai.cjs')
const {
  validatePlan,
  retrievePlaylistCandidates,
} = require('./playlist-suggestion-model.cjs')

function validateRequest(request) {
  if (request?.consented !== true)
    throw new Error('Playlist suggestions require consent for this request')
  if (
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > 1000 ||
    /\0/.test(request.prompt)
  )
    throw new Error('Enter a playlist request of up to 1000 characters')
  if (
    !Array.isArray(request.excludedTrackIds) ||
    request.excludedTrackIds.length > 10000 ||
    request.excludedTrackIds.some(
      (id) =>
        typeof id !== 'string' ||
        !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id),
    )
  )
    throw new Error('Invalid playlist exclusions')
  return {
    prompt: request.prompt.trim(),
    excludedTrackIds: [...request.excludedTrackIds],
  }
}
function interpret(plan) {
  const lines = []
  for (const [field, label] of [
    ['genresAny', 'Genres'],
    ['tagsAny', 'Tags'],
    ['artistsAny', 'Artists'],
    ['labelsAny', 'Labels'],
  ])
    if (plan.hard[field].length)
      lines.push(`${label}: ${plan.hard[field].join(', ')}`)
  if (plan.hard.yearFrom !== null || plan.hard.yearTo !== null)
    lines.push(
      `Years: ${plan.hard.yearFrom ?? 'any'}–${plan.hard.yearTo ?? 'any'}`,
    )
  for (const field of ['artists', 'genres', 'tags', 'labels'])
    if (plan.exclude[field].length)
      lines.push(`Exclude ${field}: ${plan.exclude[field].join(', ')}`)
  if (plan.softTerms.length)
    lines.push(`Preferences: ${plan.softTerms.join(', ')}`)
  return lines
}
function createPlaylistSuggestionBroker({
  discoverBroker,
  provider,
  loadCatalog,
}) {
  return {
    status: () => discoverBroker.status(),
    cancel: (sender) => discoverBroker.cancelPlaylist(sender),
    generate: async (sender, request) => {
      const validated = validateRequest(request)
      return discoverBroker.runPlaylist(
        sender,
        async (credentials, signal, beforeRequest) => {
          const plan = await provider.plan(
            credentials,
            validated.prompt,
            signal,
            beforeRequest,
          )
          signal.throwIfAborted()
          validatePlan(plan)
          if (plan.unsupported.length)
            return {
              items: [],
              interpreted: interpret(plan),
              warnings: [`Unsupported request: ${plan.unsupported.join('; ')}`],
              examined: 0,
              matched: 0,
              shortlisted: 0,
            }
          const catalog = await loadCatalog(sender, { signal })
          signal.throwIfAborted()
          const result = retrievePlaylistCandidates(catalog, plan, {
            excludedTrackIds: validated.excludedTrackIds,
          })
          const response = {
            items: [],
            interpreted: interpret(plan),
            warnings: result.warnings,
            examined: result.examined,
            matched: result.matched,
            shortlisted: result.shortlisted,
          }
          if (!result.candidates.length) return response
          const candidates = result.candidates.map((candidate, index) => ({
            ...candidate,
            artist: candidate.artists.join(', '),
            releaseTitle: candidate.releases
              .map((release) => release.title)
              .join(' · '),
            ref: `p${index}`,
          }))
          if (candidates.some(metadataTruncated))
            response.warnings.push(
              'Some long metadata fields or lists were shortened for AI selection. Local filtering still used the complete catalog; local match evidence is included.',
            )
          const selected = await provider.select(
            credentials,
            validated.prompt,
            candidates,
            signal,
            beforeRequest,
          )
          signal.throwIfAborted()
          const lookup = new Map(
            candidates.map((candidate) => [candidate.ref, candidate]),
          )
          const seen = new Set()
          if (!Array.isArray(selected) || selected.length > 20)
            throw new Error('Invalid playlist selection')
          response.items = selected.map((row) => {
            const candidate = lookup.get(row.ref)
            if (
              !candidate ||
              seen.has(row.ref) ||
              typeof row.reason !== 'string' ||
              row.reason.length > 300
            )
              throw new Error('Invalid playlist selection')
            seen.add(row.ref)
            return {
              trackId: candidate.id,
              title: candidate.title,
              artist: candidate.artist,
              releaseTitle: candidate.releaseTitle,
              reason: row.reason,
            }
          })
          return response
        },
      )
    },
  }
}
module.exports = { createPlaylistSuggestionBroker }
