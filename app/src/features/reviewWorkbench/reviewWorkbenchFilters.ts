import {
  readSavedDateAddedSort,
  type DateAddedSort,
} from '../catalog/dateAddedSort'
import type {
  ReviewWorkbenchCategory,
  ReviewWorkbenchFocus,
  ReviewWorkbenchStateFilter,
} from './reviewWorkbenchApi'

export const categoryOptions: {
  label: string
  value: ReviewWorkbenchCategory | ''
}[] = [
  { label: 'All categories', value: '' },
  { label: 'Duplicate candidates', value: 'duplicateCandidates' },
  { label: 'Missing metadata', value: 'missingMetadata' },
  { label: 'Format gaps', value: 'formatGaps' },
  { label: 'Relation gaps', value: 'relationGaps' },
  { label: 'Import cleanup', value: 'importCleanup' },
]

export const stateOptions: {
  label: string
  value: ReviewWorkbenchStateFilter
}[] = [
  { label: 'Active', value: 'active' },
  { label: 'Open', value: 'open' },
  { label: 'Reopened', value: 'reopened' },
  { label: 'Dismissed', value: 'dismissed' },
  { label: 'Resolved', value: 'resolved' },
]

export const focusOptions: { label: string; value: ReviewWorkbenchFocus }[] = [
  { label: 'Needs attention', value: 'actionable' },
  { label: 'Optional completeness', value: 'optional' },
  { label: 'All signals', value: 'all' },
]

export type ReviewWorkbenchFilters = {
  category?: ReviewWorkbenchCategory
  offset: number
  focus: ReviewWorkbenchFocus
  state: ReviewWorkbenchStateFilter
  sort: DateAddedSort
}

export function parseReviewWorkbenchFilters(
  locationSearch: string,
): ReviewWorkbenchFilters {
  const params = new URLSearchParams(locationSearch)
  const rawSort =
    params.get('sort') ?? readSavedDateAddedSort('review-workbench')
  const rawOffset = Number(params.get('offset') ?? '0')
  return {
    category:
      categoryOptions.find((option) => option.value === params.get('category'))
        ?.value || undefined,
    offset:
      Number.isSafeInteger(rawOffset) &&
      rawOffset > 0 &&
      rawOffset <= 2147483647
        ? rawOffset
        : 0,
    focus:
      focusOptions.find((option) => option.value === params.get('focus'))
        ?.value ?? 'actionable',
    state:
      stateOptions.find((option) => option.value === params.get('state'))
        ?.value ?? 'active',
    sort:
      rawSort === 'addedNewest' || rawSort === 'addedOldest'
        ? rawSort
        : 'default',
  }
}

export function reviewWorkbenchUrl(
  locationSearch: string,
  key: string,
  value: string,
) {
  const params = new URLSearchParams(locationSearch)
  if (
    !value ||
    (key === 'state' && value === 'active') ||
    (key === 'focus' && value === 'actionable') ||
    (key === 'offset' && value === '0')
  ) {
    params.delete(key)
  } else {
    params.set(key, value)
  }
  if (key !== 'offset') params.delete('offset')
  const query = params.toString()
  return query ? `/review-workbench?${query}` : '/review-workbench'
}
