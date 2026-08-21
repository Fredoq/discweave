export function warningText(
  movedCount: number,
  reviewCount: number,
  unmatchedCount: number,
) {
  const parts = [
    countWarningPart(movedCount, 'track', 'tracks', 'will change position'),
    countWarningPart(
      reviewCount,
      'match',
      'matches',
      'needs review',
      'need review',
    ),
    countWarningPart(
      unmatchedCount,
      'track',
      'tracks',
      'has no safe match',
      'have no safe match',
    ),
  ].filter(Boolean)

  if (parts.length === 0) {
    return ''
  }

  const lead =
    movedCount > 0
      ? 'Discogs order differs from imported files.'
      : 'Track mapping needs attention.'
  return `${lead} ${parts.join('; ')}.`
}

function countWarningPart(
  count: number,
  singular: string,
  plural: string,
  singularEnding: string,
  pluralEnding = singularEnding,
) {
  if (count === 0) {
    return ''
  }

  const noun = count === 1 ? singular : plural
  const ending = count === 1 ? singularEnding : pluralEnding
  return `${count} ${noun} ${ending}`
}
