import {
  Album,
  Boxes,
  GitBranch,
  ListMusic,
  Tag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ArtistEntryForm } from '../artists/ArtistsWorkspace'
import type { ArtistRecord } from '../artists/artistsData'
import {
  LabelEntryForm,
  type LabelEntryFormProps,
} from '../labels/LabelsWorkspace'
import type { LabelRecord } from '../labels/labelsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import {
  OwnedItemEntryForm,
  type OwnedItemEntryFormProps,
} from '../ownedItems/OwnedItemsWorkspace'
import type { PlaylistRecord } from '../playlists/playlistsData'
import {
  ReleaseEntryForm,
  type ReleaseEntryFormProps,
} from '../releases/ReleasesWorkspace'
import type { ReleaseRecord } from '../releases/releasesData'
import {
  RelationEntryForm,
  type RelationEntryFormProps,
} from '../relations/RelationEntryForm'
import type { RelationRecord } from '../relations/relationsData'
import {
  TrackEntryForm,
  type TrackEntryFormProps,
} from '../tracks/TrackEntryForm'
import type { TrackRecord } from '../tracks/tracksData'
import type { CatalogDictionaries } from './catalogApi'
import { catalogLinkOptions } from './catalogLinks'

type CatalogAddEntryKind =
  | 'artist'
  | 'label'
  | 'release'
  | 'track'
  | 'ownedItem'
  | 'relation'

type CatalogAddEntryFlowProps = {
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  labels: LabelRecord[]
  ownedItems: OwnedItemRecord[]
  playlists: PlaylistRecord[]
  relations: RelationRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onAddArtist: (artist: ArtistRecord) => void
  onAddLabel: LabelEntryFormProps['onSubmit']
  onAddRelease: ReleaseEntryFormProps['onSubmit']
  onAddTrack: TrackEntryFormProps['onSubmit']
  onAddOwnedItem: OwnedItemEntryFormProps['onSubmit']
  onAddRelation: RelationEntryFormProps['onSubmit']
  onCancel: () => void
}

const addEntryOptions: {
  kind: CatalogAddEntryKind
  label: string
  description: string
  icon: LucideIcon
}[] = [
  {
    kind: 'artist',
    label: 'Artist',
    description: 'Person, band, project, alias or collective.',
    icon: Users,
  },
  {
    kind: 'label',
    label: 'Label',
    description: 'Imprint, label, or catalog source.',
    icon: Tag,
  },
  {
    kind: 'release',
    label: 'Release',
    description: 'Album, EP, single, compilation or other publication.',
    icon: Album,
  },
  {
    kind: 'track',
    label: 'Track',
    description: 'Track metadata, credits, versions and file details.',
    icon: ListMusic,
  },
  {
    kind: 'ownedItem',
    label: 'Owned item',
    description: 'Physical or digital copy in the private collection.',
    icon: Boxes,
  },
  {
    kind: 'relation',
    label: 'Relation',
    description: 'Alias, membership, remix, version or collaboration link.',
    icon: GitBranch,
  },
]

export function CatalogAddEntryFlow({
  artists,
  dictionaries,
  labels,
  ownedItems,
  playlists,
  relations,
  releases,
  tracks,
  onAddArtist,
  onAddLabel,
  onAddRelease,
  onAddTrack,
  onAddOwnedItem,
  onAddRelation,
  onCancel,
}: CatalogAddEntryFlowProps) {
  const [selectedKind, setSelectedKind] = useState<CatalogAddEntryKind | null>(
    null,
  )
  const relationLinkOptions = useMemo(
    () =>
      catalogLinkOptions({
        artists,
        ownedItems,
        playlists,
        relations,
        releases,
        tracks,
      }),
    [artists, ownedItems, playlists, relations, releases, tracks],
  )

  if (selectedKind === 'artist') {
    return (
      <ArtistEntryForm
        artists={artists}
        onCancel={onCancel}
        onSubmit={(artist) => {
          onAddArtist(artist)
          onCancel()
        }}
      />
    )
  }

  if (selectedKind === 'label') {
    return (
      <LabelEntryForm
        labels={labels}
        onCancel={onCancel}
        onSubmit={(label) => {
          onAddLabel(label)
          onCancel()
        }}
      />
    )
  }

  if (selectedKind === 'release') {
    return (
      <ReleaseEntryForm
        artists={artists}
        dictionaries={dictionaries}
        releases={releases}
        tracks={tracks}
        onCancel={onCancel}
        onSubmit={(release, createdTracks) => {
          onAddRelease(release, createdTracks)
          onCancel()
        }}
      />
    )
  }

  if (selectedKind === 'track') {
    return (
      <TrackEntryForm
        artists={artists}
        dictionaries={dictionaries}
        releases={releases}
        tracks={tracks}
        onCancel={onCancel}
        onSubmit={(track) => {
          onAddTrack(track)
          onCancel()
        }}
      />
    )
  }

  if (selectedKind === 'ownedItem') {
    return (
      <OwnedItemEntryForm
        dictionaries={dictionaries}
        items={ownedItems}
        releases={releases}
        onCancel={onCancel}
        onSubmit={(ownedItem) => {
          onAddOwnedItem(ownedItem)
          onCancel()
        }}
      />
    )
  }

  if (selectedKind === 'relation') {
    return (
      <RelationEntryForm
        dictionaries={dictionaries}
        linkOptions={relationLinkOptions}
        relations={relations}
        onCancel={onCancel}
        onSubmit={(relation) => {
          onAddRelation(relation)
          onCancel()
        }}
      />
    )
  }

  return (
    <section
      className="panel catalog-add-entry-panel"
      aria-label="Add catalog entry"
    >
      <div className="panel-heading">
        <div>
          <h2>Add catalog entry</h2>
          <p>Choose the archive record type to create.</p>
        </div>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={onCancel}
        >
          <X size={15} aria-hidden="true" />
          Cancel add entry
        </button>
      </div>
      <div className="catalog-add-entry-options">
        {addEntryOptions.map((option) => {
          const Icon = option.icon

          return (
            <button
              className="catalog-add-entry-option"
              key={option.kind}
              type="button"
              aria-label={`Create ${option.label.toLowerCase()} entry`}
              onClick={() => setSelectedKind(option.kind)}
            >
              <span
                className="catalog-add-entry-option-icon"
                aria-hidden="true"
              >
                <Icon size={18} />
              </span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
