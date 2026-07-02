export type SearchEntityType =
  | 'artist'
  | 'release'
  | 'track'
  | 'ownedItem'
  | 'label'
  | 'playlist'

export type CatalogEntityKind = SearchEntityType | 'relation'

export type CatalogGraphEntityType = CatalogEntityKind

export type CatalogLinkKind = CatalogEntityKind

export type CatalogLinkLookupItem = {
  kind: CatalogLinkKind
  id: string
  title: string
  subtitle?: string | null
}

export type CatalogLinkLookupParams = {
  query?: string
  kinds?: CatalogLinkKind[]
  limit?: number
}

export type CatalogSearchFacets = {
  roles: string[]
  media: string[]
  statuses: string[]
  tags: string[]
  labelId?: string | null
  collectorSignals: string[]
}

export type CatalogSearchResult = {
  id: string
  type: SearchEntityType
  title: string
  identityHint: string | null
  subtitle?: string | null
  summary?: string | null
  matchedFields: string[]
  snippets: string[]
  facets: CatalogSearchFacets
  rank: number
}

export type CatalogGraphLink = {
  id: string
  type: CatalogGraphEntityType
  title: string
  subtitle?: string | null
  relation?: string | null
}

export type CatalogGraphEntity = {
  id: string
  type: SearchEntityType
  title: string
  subtitle?: string | null
  summary?: string | null
}

export type CatalogGraphContext = {
  entity: CatalogGraphEntity
  sections: {
    artists: CatalogGraphLink[]
    releases: CatalogGraphLink[]
    tracks: CatalogGraphLink[]
    ownedCopies: CatalogGraphLink[]
    labels: CatalogGraphLink[]
    playlists: CatalogGraphLink[]
    credits: CatalogGraphLink[]
    relations: CatalogGraphLink[]
    media: CatalogGraphLink[]
  }
  collectorSignals: string[]
}

export type CatalogSearchParams = {
  query?: string
  entityType?: SearchEntityType | ''
  role?: string
  media?: string
  status?: string
  labelId?: string
  tag?: string
  savedView?: string
  limit?: number
  offset?: number
}
