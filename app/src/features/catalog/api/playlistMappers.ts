import type {
  LinkedReleaseAvailability,
  PlaylistEntryRef,
  PlaylistRecord,
  PlaylistTrack,
  SmartPlaylistServerRules,
} from '../../playlists/playlistsData'
import type {
  PlaylistDto,
  PlaylistItemDto,
  SmartPlaylistRulesDto,
} from './catalogTypes'

export function toPlaylistRecord(playlist: PlaylistDto): PlaylistRecord {
  const rules = normalizePlaylistRules(playlist.rules)
  const results =
    playlist.results.length > 0 ? playlist.results : playlist.entries
  const tracks = results
    .filter((item) => item.kind === 'track')
    .map(toPlaylistTrack)
  const linkedReleases = results
    .filter((item) => item.kind === 'release')
    .map(toLinkedRelease)
  const base = {
    id: playlist.id,
    name: playlist.name,
    description:
      playlist.description?.trim() ||
      (playlist.type === 'smart'
        ? 'Dynamic smart playlist from collection rules.'
        : 'Manual playlist from saved catalog links.'),
    curator:
      playlist.type === 'smart' ? 'Smart criteria' : 'Default collection',
    updatedAt: 'Server',
    yearRange: playlistYearRange(rules),
    ruleHints: playlistRuleHints(rules, playlist.type),
    tracks,
    linkedReleases,
    serverEntries: playlist.entries.map(toPlaylistEntryRef),
    serverRules: rules,
  }

  if (playlist.type === 'smart') {
    return {
      ...base,
      type: 'Smart',
      smartRules: {
        summary: smartPlaylistSummary(rules),
        criteria: smartPlaylistCriteria(rules),
      },
    }
  }

  return {
    ...base,
    type: 'Manual',
    manualSelection: {
      source: 'Saved catalog links',
      note: 'Manual entries keep their explicit server order.',
    },
  }
}

export function toPlaylistRequest(playlist: PlaylistRecord) {
  return {
    name: playlist.name,
    description: playlist.description.trim() || null,
    type: playlist.type === 'Smart' ? 'smart' : 'manual',
    entries: playlist.type === 'Manual' ? playlistEntryRequests(playlist) : [],
    rules: playlist.type === 'Smart' ? playlistRulesRequest(playlist) : null,
  }
}

function toPlaylistTrack(item: PlaylistItemDto): PlaylistTrack {
  return {
    id: item.id,
    title: item.title,
    artist: item.subtitle ?? 'Unknown artist',
    release: {
      id: '',
      title: 'Unlinked release',
      artist: item.subtitle ?? 'Unknown artist',
      year: 'Unknown year',
      label: 'Unknown label',
    },
    trackNumber: 'Not recorded',
    duration: 'Not recorded',
    tags: [],
    fileFormat: 'Not recorded',
    media: [],
    ownershipStatus: [],
    availability: item.subtitle ?? 'Server playlist result',
  }
}

function toLinkedRelease(item: PlaylistItemDto): LinkedReleaseAvailability {
  return {
    releaseId: item.id,
    title: item.title,
    artist: item.subtitle ?? 'Unknown artist',
    year: item.subtitle ?? 'Unknown year',
    media: [],
    ownershipStatus: [],
    availability: item.subtitle ?? 'Server playlist result',
  }
}

function toPlaylistEntryRef(item: PlaylistItemDto): PlaylistEntryRef {
  return {
    kind: item.kind,
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
  }
}

function normalizePlaylistRules(
  rules: SmartPlaylistRulesDto | null | undefined,
): SmartPlaylistServerRules {
  return {
    tags: rules?.tags ?? [],
    genres: rules?.genres ?? [],
    media: rules?.media ?? [],
    ownershipStatuses: rules?.ownershipStatuses ?? [],
    yearFrom: rules?.yearFrom ?? null,
    yearTo: rules?.yearTo ?? null,
  }
}

function playlistYearRange(rules: SmartPlaylistServerRules) {
  if (rules.yearFrom && rules.yearTo) {
    return `${rules.yearFrom}-${rules.yearTo}`
  }

  if (rules.yearFrom) {
    return `${rules.yearFrom}+`
  }

  if (rules.yearTo) {
    return `Up to ${rules.yearTo}`
  }

  return 'Any year'
}

function playlistRuleHints(
  rules: SmartPlaylistServerRules,
  type: PlaylistDto['type'],
) {
  if (type === 'manual') {
    return ['manual selection']
  }

  return [
    ...rules.tags.map((value) => `tag ${value}`),
    ...rules.genres.map((value) => `genre ${value}`),
    ...rules.media.map((value) => `media ${value}`),
    ...rules.ownershipStatuses.map((value) => `status ${value}`),
    ...(rules.yearFrom || rules.yearTo
      ? [`years ${playlistYearRange(rules)}`]
      : []),
  ]
}

function smartPlaylistSummary(rules: SmartPlaylistServerRules) {
  const criteria = smartPlaylistCriteria(rules)

  return criteria.length > 0
    ? `Dynamic playlist matching ${criteria.length} rule categories.`
    : 'Dynamic playlist with no filters recorded.'
}

function smartPlaylistCriteria(rules: SmartPlaylistServerRules) {
  const criteria = [
    ruleCriteria('Tags', rules.tags),
    ruleCriteria('Genres', rules.genres),
    ruleCriteria('Media', rules.media),
    ruleCriteria('Ownership statuses', rules.ownershipStatuses),
    rules.yearFrom || rules.yearTo ? `Years: ${playlistYearRange(rules)}` : '',
  ].filter(Boolean)

  return criteria.length > 0 ? criteria : ['No criteria recorded.']
}

function ruleCriteria(label: string, values: string[]) {
  return values.length > 0 ? `${label}: ${values.join(' or ')}` : ''
}

function playlistEntryRequests(playlist: PlaylistRecord) {
  const entries = playlist.serverEntries ?? [
    ...playlist.tracks.map(
      (track): PlaylistEntryRef => ({
        kind: 'track',
        id: track.id,
      }),
    ),
    ...playlist.linkedReleases.map(
      (release): PlaylistEntryRef => ({
        kind: 'release',
        id: release.releaseId,
      }),
    ),
  ]

  return entries
    .filter((entry) => isGuid(entry.id))
    .map((entry) => ({ kind: entry.kind, id: entry.id }))
}

function playlistRulesRequest(
  playlist: Extract<PlaylistRecord, { type: 'Smart' }>,
) {
  if (playlist.serverRules) {
    return normalizePlaylistRules(playlist.serverRules)
  }

  return {
    tags: playlist.ruleHints,
    genres: [],
    media: [],
    ownershipStatuses: [],
    yearFrom: null,
    yearTo: null,
  }
}

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}
