import { useMemo } from 'react'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { type CatalogLinkData } from '../catalog/catalogLinks'
import { relationTouchesLink, uniqueValues } from '../catalog/catalogGraph'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { RatingsPanel } from '../ratings/RatingsPanel'
import { ReleaseCoverThumbnail } from '../releases/ReleaseCoverThumbnail'
import type { ReleaseCoverImage } from '../releases/releasesData'
import type { ArtistRecord } from './artistsData'

type ArtistDetailProps = {
  artist: ArtistRecord
  catalogData: CatalogLinkData
  onDelete?: () => void
  onEdit?: () => void
  ratingCriteria: RatingCriterion[]
  onDeleteRating?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
  ) => void
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
  ) => void
}

export function ArtistDetail({
  artist,
  catalogData,
  onDelete,
  onEdit,
  ratingCriteria,
  onDeleteRating,
  onRateTarget,
}: ArtistDetailProps) {
  const {
    creditRoles,
    ownedCopyAppearances,
    relationAppearances,
    releaseAppearances,
    trackAppearances,
  } = useMemo(
    () => buildArtistInsights(artist, catalogData),
    [artist, catalogData],
  )

  return (
    <aside
      className="panel detail-panel artist-detail-panel"
      aria-labelledby="artist-detail-title"
    >
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{artist.type}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="artist-detail-title">{artist.name}</h2>
        {artist.summary ? <p>{artist.summary}</p> : null}
        {onEdit ? (
          <div className="detail-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onEdit}
            >
              Edit record
            </button>
            {onDelete ? (
              <DeleteSessionRecordButton
                confirmationMessage="Delete this artist and remove their credits and relations?"
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <RatingsPanel
        criteria={ratingCriteria}
        ratings={artist.ratings}
        targetId={artist.id}
        targetType="artist"
        onDeleteRating={onDeleteRating}
        onRateTarget={onRateTarget}
      />

      <section
        className="detail-section"
        aria-labelledby="artist-relations-title"
      >
        <h3 id="artist-relations-title">Relations and credits</h3>
        <ArtistStats
          releases={releaseAppearances.length}
          tracks={trackAppearances.length}
          copies={ownedCopyAppearances.length}
          roles={creditRoles.length}
        />
        <BadgeList values={creditRoles} emptyText="No credit roles recorded" />
        <AppearanceList
          emptyText="No direct artist relations recorded."
          items={relationAppearances}
        />
      </section>

      <section
        className="detail-section"
        aria-labelledby="artist-credits-title"
      >
        <h3 id="artist-credits-title">Credit appearances</h3>
        <div className="artist-appearance-groups">
          <AppearanceGroup
            title="Releases"
            emptyText="No release appearances recorded."
            items={releaseAppearances}
          />
          <AppearanceGroup
            title="Tracks"
            emptyText="No track appearances recorded."
            items={trackAppearances}
          />
        </div>
      </section>

      <section className="detail-section" aria-labelledby="artist-copies-title">
        <h3 id="artist-copies-title">Collection copies</h3>
        <AppearanceList
          emptyText="No owned copies linked to this artist yet."
          items={ownedCopyAppearances}
        />
      </section>

      <section
        className="detail-section"
        aria-labelledby="artist-aliases-title"
      >
        <h3 id="artist-aliases-title">Aliases, members and tags</h3>
        <BadgeList
          values={[...artist.aliases, ...artist.members, ...artist.tags]}
          emptyText="No aliases, members or tags recorded"
        />
      </section>
    </aside>
  )
}

type ArtistAppearance = {
  context: string
  coverImage?: ReleaseCoverImage
  href?: string
  key: string
  label: string
  meta: string
  roles: string[]
  thumbnailTitle?: string
}

function buildArtistInsights(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
) {
  const artistLink = { kind: 'artist', id: artist.id } as const
  const artistName = normalizeText(artist.name)
  const creditRoles = uniqueValues(artist.credits.map((credit) => credit.role))

  const releaseAppearances = catalogData.releases.flatMap((release) => {
    const roles = new Set<string>()

    if (
      release.artistId === artist.id ||
      normalizeText(release.artist) === artistName
    ) {
      roles.add('Main artist')
    }

    for (const credit of release.artistCredits ?? []) {
      if (artistCreditMatches(credit, artist, artistName)) {
        roles.add(credit.role)
      }
    }

    for (const credit of matchingTargetCredits(
      artist,
      release.title,
      'Release',
    )) {
      roles.add(credit.role)
    }

    if (roles.size === 0) {
      return []
    }

    return [
      {
        key: `release-${release.id}`,
        coverImage: release.coverImage,
        href: `/releases?release=${encodeURIComponent(release.id)}`,
        label: release.title,
        roles: [...roles],
        thumbnailTitle: release.title,
        meta: [release.type, release.year, release.label]
          .filter(Boolean)
          .join(' · '),
        context: release.genres.join(', ') || release.releaseNotes,
      },
    ]
  })

  const releaseIds = new Set(
    releaseAppearances.map((appearance) =>
      appearance.href?.replace('/releases?release=', ''),
    ),
  )

  const trackAppearances = catalogData.tracks.flatMap((track) => {
    const roles = new Set<string>()

    if (
      track.artistId === artist.id ||
      normalizeText(track.artist) === artistName
    ) {
      roles.add('Main artist')
    }

    for (const credit of track.credits) {
      if (artistCreditMatches(credit, artist, artistName)) {
        roles.add(credit.role)
      }
    }

    for (const credit of matchingTargetCredits(artist, track.title, 'Track')) {
      roles.add(credit.role)
    }

    if (roles.size === 0) {
      return []
    }

    if (track.release.id) {
      releaseIds.add(encodeURIComponent(track.release.id))
    }

    for (const appearance of track.releaseAppearances) {
      if (appearance.releaseId) {
        releaseIds.add(encodeURIComponent(appearance.releaseId))
      }
    }

    return [
      {
        key: `track-${track.id}`,
        href: `/tracks?track=${encodeURIComponent(track.id)}`,
        label: track.title,
        roles: [...roles],
        meta: [
          track.trackNumber ? `Track ${track.trackNumber}` : '',
          track.release.title,
          track.duration,
        ]
          .filter(Boolean)
          .join(' · '),
        context: track.versionHint || track.relationHint,
      },
    ]
  })

  const ownedCopyAppearances = catalogData.ownedItems.flatMap((item) => {
    const itemReleaseId = item.releaseId
      ? encodeURIComponent(item.releaseId)
      : undefined

    if (
      normalizeText(item.artist) !== artistName &&
      (!itemReleaseId || !releaseIds.has(itemReleaseId))
    ) {
      return []
    }

    return [
      {
        key: `owned-item-${item.id}`,
        href: `/owned-items?ownedItem=${encodeURIComponent(item.id)}`,
        label: item.title,
        roles: [item.status],
        meta: [item.medium, item.fileFormat].filter(Boolean).join(' · '),
        context: [item.storage, item.condition].filter(Boolean).join(' · '),
      },
    ]
  })

  const catalogRelations = (catalogData.relations ?? []).filter(
    (relation) =>
      relationTouchesLink(relation, artistLink) ||
      normalizeText(relation.source) === artistName ||
      normalizeText(relation.target) === artistName ||
      normalizeText(relation.linkedEntity) === artistName,
  )

  const relationAppearances = [
    ...artist.relations.map((relation) => ({
      key: `artist-relation-${relation.type}-${relation.target}`,
      label: relation.target,
      roles: [relation.type],
      meta: 'Artist relation',
      context: relation.detail,
    })),
    ...catalogRelations.map((relation) => ({
      key: `catalog-relation-${relation.id}`,
      href: `/relations?relation=${encodeURIComponent(relation.id)}`,
      label: `${relation.source} to ${relation.target}`,
      roles: [relation.relationType, relation.role].filter(Boolean),
      meta: relation.linkedEntity
        ? `${relation.linkedEntityType} · ${relation.linkedEntity}`
        : relation.direction,
      context: relation.context,
    })),
  ]

  return {
    creditRoles,
    ownedCopyAppearances,
    relationAppearances: dedupeAppearances(relationAppearances),
    releaseAppearances: dedupeAppearances(releaseAppearances),
    trackAppearances: dedupeAppearances(trackAppearances),
  }
}

function matchingTargetCredits(
  artist: ArtistRecord,
  target: string,
  expectedScope: string,
) {
  const normalizedTarget = normalizeText(target)
  const normalizedScope = normalizeText(expectedScope)

  return artist.credits.filter(
    (credit) =>
      normalizeText(credit.target) === normalizedTarget &&
      normalizeText(credit.scope) === normalizedScope,
  )
}

function artistCreditMatches(
  credit: { artistId?: string; artist: string },
  artist: ArtistRecord,
  artistName: string,
) {
  return (
    credit.artistId === artist.id || normalizeText(credit.artist) === artistName
  )
}

function dedupeAppearances(appearances: ArtistAppearance[]) {
  const merged = new Map<string, ArtistAppearance>()

  for (const appearance of appearances) {
    const existing = merged.get(appearance.key)

    if (!existing) {
      merged.set(appearance.key, appearance)
      continue
    }

    merged.set(appearance.key, {
      ...existing,
      coverImage: existing.coverImage ?? appearance.coverImage,
      roles: uniqueValues([...existing.roles, ...appearance.roles]),
      thumbnailTitle: existing.thumbnailTitle ?? appearance.thumbnailTitle,
    })
  }

  return [...merged.values()]
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

type ArtistStatsProps = {
  copies: number
  releases: number
  roles: number
  tracks: number
}

function ArtistStats({ copies, releases, roles, tracks }: ArtistStatsProps) {
  return (
    <dl className="artist-stat-grid">
      <div>
        <dt>Releases</dt>
        <dd>{releases}</dd>
      </div>
      <div>
        <dt>Tracks</dt>
        <dd>{tracks}</dd>
      </div>
      <div>
        <dt>Copies</dt>
        <dd>{copies}</dd>
      </div>
      <div>
        <dt>Roles</dt>
        <dd>{roles}</dd>
      </div>
    </dl>
  )
}

type AppearanceGroupProps = {
  emptyText: string
  items: ArtistAppearance[]
  title: string
}

function AppearanceGroup({ emptyText, items, title }: AppearanceGroupProps) {
  return (
    <div className="artist-appearance-group">
      <div className="artist-appearance-heading">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      <AppearanceList emptyText={emptyText} items={items} />
    </div>
  )
}

type AppearanceListProps = {
  emptyText: string
  items: ArtistAppearance[]
}

function AppearanceList({ emptyText, items }: AppearanceListProps) {
  if (items.length === 0) {
    return <p className="detail-empty">{emptyText}</p>
  }

  return (
    <div className="artist-appearance-list">
      {items.map((item) => (
        <article
          className={
            item.thumbnailTitle
              ? 'artist-appearance-card artist-appearance-card-with-thumbnail'
              : 'artist-appearance-card'
          }
          key={item.key}
        >
          {item.thumbnailTitle ? (
            <ReleaseCoverThumbnail
              coverImage={item.coverImage}
              title={item.thumbnailTitle}
            />
          ) : null}
          <div className="artist-appearance-card-body">
            <div className="artist-appearance-card-header">
              {item.href ? (
                <a className="detail-link" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <strong>{item.label}</strong>
              )}
              <BadgeList values={item.roles} />
            </div>
            <p>{item.meta}</p>
            {item.context ? <p>{item.context}</p> : null}
          </div>
        </article>
      ))}
    </div>
  )
}

type EmptyDetailPanelProps = {
  title: string
}

export function EmptyDetailPanel({ title }: EmptyDetailPanelProps) {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-detail-title">{title}</h2>
      </div>

      <p className="detail-summary">
        Try another artist, alias, member or role.
      </p>
    </aside>
  )
}

type BadgeListProps = {
  emptyText?: string
  values: string[]
}

function BadgeList({ emptyText = 'None recorded', values }: BadgeListProps) {
  if (values.length === 0) {
    return <span className="detail-empty">{emptyText}</span>
  }

  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className="badge badge-tag">
          {value}
        </span>
      ))}
    </span>
  )
}
