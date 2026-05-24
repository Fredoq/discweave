import type { ReactNode } from 'react'
import './catalog.css'
import type { ArtistRecord } from '../artists/artistsData'
import type { LabelRecord } from '../labels/labelsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import { LocalCatalogWorkspace } from './LocalCatalogWorkspace'
import { ServerCatalogWorkspace } from './ServerCatalogWorkspace'

type CatalogWorkspaceProps = {
  addEntryPanel?: ReactNode
  artists: ArtistRecord[]
  labels?: LabelRecord[]
  locationSearch?: string
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  ownedItems: OwnedItemRecord[]
  relations: RelationRecord[]
  playlists: PlaylistRecord[]
  searchRefreshKey?: number
  serverBacked?: boolean
}

export function CatalogWorkspace(props: CatalogWorkspaceProps) {
  if (props.serverBacked) {
    return (
      <ServerCatalogWorkspace
        addEntryPanel={props.addEntryPanel}
        labels={props.labels ?? []}
        locationSearch={props.locationSearch ?? window.location.search}
        searchRefreshKey={props.searchRefreshKey ?? 0}
      />
    )
  }

  return <LocalCatalogWorkspace {...props} />
}
