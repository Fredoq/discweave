import type { ExternalMetadataReleaseCandidateDto } from '../catalog/api/externalMetadataClient'

export type DateSearchContext = {
  title: string
  artists: string[]
  catalogNumbers: string[]
  labels: string[]
  year?: number | null
}

export type RankedDateCandidate = {
  candidate: ExternalMetadataReleaseCandidateDto
  matches: string[]
  score: number
}

export function rankDateCandidates(
  candidates: readonly ExternalMetadataReleaseCandidateDto[],
  context: DateSearchContext,
): RankedDateCandidate[] {
  const seen = new Set<string>()
  const ranked: RankedDateCandidate[] = []
  for (const candidate of candidates) {
    const identity = JSON.stringify([
      candidate.source.providerName,
      candidate.source.resourceType,
      candidate.source.externalId,
    ])
    if (seen.has(identity)) continue
    seen.add(identity)
    ranked.push(rankCandidate(candidate, context))
  }
  // Stable sorting preserves the provider's ordering for equal evidence.
  return ranked.sort((left, right) => right.score - left.score)
}

function rankCandidate(
  candidate: ExternalMetadataReleaseCandidateDto,
  context: DateSearchContext,
): RankedDateCandidate {
  const evidence: [string, number, boolean][] = [
    [
      'Catalog number',
      100,
      matchesAny(
        candidate.catalogNumber ? [candidate.catalogNumber] : [],
        context.catalogNumbers,
        normalizeCatalogNumber,
      ),
    ],
    [
      'Artist',
      30,
      matchesAny(candidate.artists, context.artists, normalizeName),
    ],
    ['Label', 15, matchesAny(candidate.labels, context.labels, normalizeName)],
    ['Title', 20, matchesTitle(candidate, context.title)],
    ['Year', 5, Boolean(context.year && context.year === candidate.year)],
  ]
  const matching = evidence.filter(([, , matches]) => matches)
  return {
    candidate,
    matches: matching.map(([label]) => label),
    score: matching.reduce((total, [, weight]) => total + weight, 0),
  }
}

function matchesAny(
  actual: readonly string[],
  expected: readonly string[],
  normalize: (value: string) => string,
) {
  const keys = new Set(expected.map(normalize).filter(Boolean))
  return actual.some((value) => {
    const key = normalize(value)
    return key.length > 0 && keys.has(key)
  })
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function normalizeName(value: string) {
  return normalizeText(value).replace(/ \(\d+\)$/, '')
}

function normalizeCatalogNumber(value: string) {
  // Separator differences are weak presentation differences, not evidence to
  // merge records. Digits (including leading zeroes) and suffixes stay intact.
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s\p{Dash_Punctuation}._]/gu, '')
}

function matchesTitle(
  candidate: ExternalMetadataReleaseCandidateDto,
  title: string,
) {
  const expected = normalizeText(title)
  if (!expected) return false
  if (normalizeText(candidate.title) === expected) return true
  const separator = candidate.title.indexOf(' - ')
  if (separator < 0) return false
  const prefix = candidate.title.slice(0, separator)
  // Discogs search commonly prefixes a title with its artist. Do not strip
  // arbitrary title fragments unless the prefix is an actual candidate artist.
  return (
    matchesAny([prefix], candidate.artists, normalizeName) &&
    normalizeText(candidate.title.slice(separator + 3)) === expected
  )
}
