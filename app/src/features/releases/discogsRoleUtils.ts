import type {
  CatalogDictionaries,
  ExternalMetadataReleaseDetailDto,
  ExternalMetadataReleaseDraftArtistCreditDto,
} from '../catalog/catalogApi'

export type GroupedDiscogsReviewCredit = {
  name: string
  roles: string[]
}

export function discogsRoleLabels(
  role: string,
  dictionaries: CatalogDictionaries,
) {
  return splitDiscogsRoleLabels(role).map((part) =>
    discogsRoleLabelFromCode(part, dictionaries),
  )
}

export function discogsRoleLabelFromCode(
  role: string,
  dictionaries: CatalogDictionaries,
) {
  const trimmedRole = role.trim()

  return (
    dictionaries.creditRole.find(
      (entry) => entry.code === trimmedRole || entry.name === trimmedRole,
    )?.name ?? trimmedRole
  )
}

export function groupDiscogsReviewCredits(
  credits: ExternalMetadataReleaseDraftArtistCreditDto[],
) {
  const grouped = new Map<string, GroupedDiscogsReviewCredit>()

  credits.forEach((credit) => {
    const name = credit.name.trim()
    if (!name) {
      return
    }

    const key = name.toLowerCase()
    const existing = grouped.get(key)
    const roles = splitDiscogsRoleLabels(credit.role)

    if (existing) {
      existing.roles = [...new Set([...existing.roles, ...roles])]
    } else {
      grouped.set(key, { name, roles })
    }
  })

  return [...grouped.values()]
}

export function splitDiscogsRoleLabels(role: string) {
  const roles: string[] = []
  let depth = 0
  let current = ''

  for (const character of role) {
    if (character === '[' || character === '(') {
      depth += 1
    } else if ((character === ']' || character === ')') && depth > 0) {
      depth -= 1
    }

    if (character === ',' && depth === 0) {
      pushRole(current, roles)
      current = ''
    } else {
      current += character
    }
  }

  pushRole(current, roles)
  return roles
}

export function hasCompilationTrackArtists(
  detail: ExternalMetadataReleaseDetailDto,
) {
  return discogsTracklistNeedsVariousArtists(
    detail.draft.tracklist,
    detail.draft,
  )
}

export function discogsTracklistNeedsVariousArtists(
  tracklist: ExternalMetadataReleaseDetailDto['draft']['tracklist'],
  draft: ExternalMetadataReleaseDetailDto['draft'],
) {
  const releaseMainArtists = normalizedSet(
    draft.artistCredits
      .filter((credit) => normalizeText(credit.role) === 'mainartist')
      .map((credit) => credit.name),
  )
  const releaseArtists =
    releaseMainArtists.size > 0
      ? releaseMainArtists
      : normalizedSet(draft.artistCredits.map((credit) => credit.name))

  return tracklist.some((track) => {
    const trackMainArtists = normalizedSet(
      track.artistCredits
        .filter((credit) => normalizeText(credit.role) === 'mainartist')
        .map((credit) => credit.name),
    )

    return (
      trackMainArtists.size > 0 && !setsEqual(releaseArtists, trackMainArtists)
    )
  })
}

function pushRole(value: string, roles: string[]) {
  const trimmed = value.trim()
  if (trimmed) {
    roles.push(trimmed)
  }
}

function normalizedSet(values: string[]) {
  return new Set(values.map(normalizeText).filter(Boolean))
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function setsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }

  return true
}
