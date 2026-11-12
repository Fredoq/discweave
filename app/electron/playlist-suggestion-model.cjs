const listSchema = {
  type: 'array',
  items: { type: 'string', minLength: 1, maxLength: 200 },
  maxItems: 50,
}
const objectSchema = (properties) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
})
const PLAN_SCHEMA = objectSchema({
  hard: objectSchema({
    genresAny: listSchema,
    tagsAny: listSchema,
    artistsAny: listSchema,
    labelsAny: listSchema,
    yearFrom: { type: ['integer', 'null'], minimum: 1000, maximum: 9999 },
    yearTo: { type: ['integer', 'null'], minimum: 1000, maximum: 9999 },
  }),
  exclude: objectSchema({
    artists: listSchema,
    genres: listSchema,
    tags: listSchema,
    labels: listSchema,
  }),
  softTerms: listSchema,
  unsupported: listSchema,
})
function validateValue(value, schema) {
  if (schema.type === 'object') {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== schema.required.length ||
      schema.required.some((key) => !Object.hasOwn(value, key))
    )
      throw new Error('Invalid playlist search plan structure.')
    for (const key of schema.required)
      validateValue(value[key], schema.properties[key])
  } else if (schema.type === 'array') {
    if (
      !Array.isArray(value) ||
      value.length > 50 ||
      value.some(
        (item) => typeof item !== 'string' || !item.trim() || item.length > 200,
      )
    )
      throw new Error('Invalid playlist search plan terms.')
  } else if (
    value !== null &&
    (!Number.isInteger(value) || value < 1000 || value > 9999)
  )
    throw new Error('Invalid playlist search plan year.')
}
function validatePlan(plan) {
  validateValue(plan, PLAN_SCHEMA)
  if (
    plan.hard.yearFrom !== null &&
    plan.hard.yearTo !== null &&
    plan.hard.yearFrom > plan.hard.yearTo
  )
    throw new Error('Playlist search year range is reversed.')
  return plan
}
const normalized = (value) =>
  typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
    : ''
const values = (value) =>
  (Array.isArray(value) ? value : [value]).map(normalized).filter(Boolean)
function compare(a, b) {
  if (a < b) return -1
  return a > b ? 1 : 0
}
function parsedYear(value) {
  const text = String(value ?? '').trim()
  return /^[1-9]\d{3}$/.test(text) ? Number(text) : null
}
const strings = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
function metadata(record) {
  return {
    id: record.id,
    title: typeof record.title === 'string' ? record.title : '',
    artists: strings(record.artists),
    durationSeconds: Number.isFinite(record.durationSeconds)
      ? record.durationSeconds
      : null,
    genres: strings(record.genres),
    tags: strings(record.tags),
    overallRating: Number.isFinite(record.overallRating)
      ? record.overallRating
      : null,
    releases: (Array.isArray(record.releases) ? record.releases : [])
      .filter((release) => release && typeof release === 'object')
      .map((release) => ({
        title: typeof release.title === 'string' ? release.title : '',
        year: parsedYear(release.year),
        artists: strings(release.artists),
        labels: strings(release.labels),
        genres: strings(release.genres),
      })),
  }
}
function searchFields(record) {
  return {
    title: record.title,
    artists: record.artists,
    releaseTitle: record.releases.map((release) => release.title),
    labels: record.releases.flatMap((release) => release.labels),
    genres: [
      ...record.genres,
      ...record.releases.flatMap((release) => release.genres),
    ],
    tags: record.tags,
  }
}
function matchesAny(present, terms) {
  return terms.find((term) => values(present).includes(normalized(term)))
}
function yearMatches(year, hard) {
  if (hard.yearFrom === null && hard.yearTo === null) return true
  if (year === null) return false
  if (hard.yearFrom !== null && year < hard.yearFrom) return false
  return hard.yearTo === null || year <= hard.yearTo
}
function appearanceMatches(release, hard) {
  if (hard.labelsAny.length && !matchesAny(release.labels, hard.labelsAny))
    return false
  return yearMatches(release.year, hard)
}
function hasReleaseConstraint(hard) {
  return (
    hard.labelsAny.length > 0 || hard.yearFrom !== null || hard.yearTo !== null
  )
}
function excludedByMetadata(record, fields, exclude) {
  return ['artists', 'labels', 'genres', 'tags'].some((field) => {
    if (!exclude[field].length) return false
    if (
      !values(fields[field]).length ||
      matchesAny(fields[field], exclude[field])
    )
      return true
    return (
      field === 'labels' &&
      record.releases.some((release) => !values(release.labels).length)
    )
  })
}
function fieldEvidence(fields, hard) {
  const evidence = []
  for (const [key, field] of [
    ['genresAny', 'genres'],
    ['tagsAny', 'tags'],
    ['artistsAny', 'artists'],
  ]) {
    if (!hard[key].length) continue
    const match = matchesAny(fields[field], hard[key])
    if (!match) return null
    evidence.push(`${field}: ${match}`)
  }
  return evidence
}
function hardMatch(record, plan) {
  const fields = searchFields(record)
  const evidence = fieldEvidence(fields, plan.hard)
  if (!evidence || excludedByMetadata(record, fields, plan.exclude)) return null
  if (!hasReleaseConstraint(plan.hard)) return evidence
  const appearance = record.releases.find((release) =>
    appearanceMatches(release, plan.hard),
  )
  if (!appearance) return null
  if (plan.hard.yearFrom !== null || plan.hard.yearTo !== null)
    evidence.push(`year: ${appearance.year}`)
  if (plan.hard.labelsAny.length)
    evidence.push(
      `label: ${matchesAny(appearance.labels, plan.hard.labelsAny)}`,
    )
  evidence.push(`release: ${appearance.title}`)
  return evidence
}
function artistQueues(candidates, score) {
  const groups = new Map()
  const tied = candidates
    .filter((item) => item.score === score)
    .sort((a, b) => compare(a.id, b.id))
  for (const candidate of tied) {
    const artist =
      values(candidate.artists).sort(compare).join('|') || candidate.id
    if (!groups.has(artist)) groups.set(artist, [])
    groups.get(artist).push(candidate)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, group]) => group)
}
function appendRoundRobin(result, queues) {
  for (let round = 0; queues.some((queue) => round < queue.length); round++) {
    for (const queue of queues) {
      if (queue[round]) result.push(queue[round])
      if (result.length === 100) return
    }
  }
}
function diversify(candidates) {
  const result = []
  const scores = [...new Set(candidates.map((item) => item.score))].sort(
    (a, b) => b - a,
  )
  for (const score of scores) {
    appendRoundRobin(result, artistQueues(candidates, score))
    if (result.length === 100) break
  }
  return result
}
function softEvidence(record, terms) {
  const fields = searchFields(record)
  const evidence = []
  for (const term of terms) {
    for (const field of [
      'title',
      'artists',
      'releaseTitle',
      'labels',
      'genres',
      'tags',
    ]) {
      if (
        values(fields[field]).some(
          (value) => value === term || ` ${value} `.includes(` ${term} `),
        )
      )
        evidence.push(`term “${term}” in ${field}`)
    }
  }
  return evidence
}
function validateTrackIdentity(source, ids) {
  if (
    !source ||
    typeof source.id !== 'string' ||
    !source.id.trim() ||
    ids.has(normalized(source.id))
  )
    throw new Error('Catalog tracks must have unique, non-empty IDs.')
  ids.add(normalized(source.id))
}
function rankedCatalog(catalog, plan, excludedTrackIds, softTerms) {
  const ids = new Set()
  const excluded = new Set(excludedTrackIds.map(normalized))
  const candidates = []
  for (const source of catalog) {
    validateTrackIdentity(source, ids)
    if (excluded.has(normalized(source.id))) continue
    const record = metadata(source)
    const evidence = hardMatch(record, plan)
    if (!evidence) continue
    const preferences = softEvidence(record, softTerms)
    candidates.push({
      ...record,
      score: preferences.length,
      evidence: [...evidence, ...preferences],
    })
  }
  return candidates
}
function eligibleCandidates(candidates, plan, softTerms, warnings) {
  if (!softTerms.length) return candidates
  const grounded = candidates.filter((item) => item.score > 0)
  const hasHard = Object.values(plan.hard).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== null,
  )
  if (!grounded.length)
    warnings.push(
      'No metadata evidence for the requested search terms. Mood, tempo and audio characteristics are not inferred.',
    )
  return hasHard ? candidates : grounded
}
function retrievePlaylistCandidates(
  catalog,
  plan,
  { excludedTrackIds = [] } = {},
) {
  validatePlan(plan)
  if (
    !Array.isArray(catalog) ||
    !Array.isArray(excludedTrackIds) ||
    excludedTrackIds.some((id) => typeof id !== 'string')
  )
    throw new Error('Invalid playlist catalog input.')
  const result = {
    supported: plan.unsupported.length === 0,
    examined: plan.unsupported.length ? 0 : catalog.length,
    matched: 0,
    shortlisted: 0,
    candidates: [],
    warnings: [],
  }
  if (!result.supported) {
    result.warnings.push(`Unsupported request: ${plan.unsupported.join('; ')}`)
    return result
  }
  const softTerms = [...new Set(plan.softTerms.map(normalized))]
  const candidates = rankedCatalog(catalog, plan, excludedTrackIds, softTerms)
  const eligible = eligibleCandidates(
    candidates,
    plan,
    softTerms,
    result.warnings,
  )
  result.matched = eligible.length
  result.candidates = diversify(eligible)
  result.shortlisted = result.candidates.length
  if (result.matched > result.shortlisted)
    result.warnings.push(
      `Automatically shortlisted ${result.shortlisted} of ${result.matched} matching tracks using metadata ranking and artist diversity. The remaining matches were not sent to AI.`,
    )
  return result
}
module.exports = { PLAN_SCHEMA, validatePlan, retrievePlaylistCandidates }
