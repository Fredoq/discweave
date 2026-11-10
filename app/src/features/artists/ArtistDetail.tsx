import { useEffect, useMemo, useRef } from 'react'
import { ArtistInspectorHeader } from './ArtistInspectorHeader'
import { type CatalogLinkData } from '../catalog/catalogLinks'
import { uniqueValues } from '../catalog/catalogGraph'
import type {
  RatingAverage,
  RatingCriterion,
  RatingTargetType,
} from '../catalog/catalogApi'
import { RatingsPanel } from '../ratings/RatingsPanel'
import type { ReleaseCoverImage } from '../releases/releasesData'
import { AppearanceGroup, BadgeList } from './ArtistDetailSections'
import { buildArtistRelationshipGroups } from './artistRelationshipGroups'
import type { ArtistRecord } from './artistsData'
import { ArtistInspectorTabs } from './ArtistInspectorTabs'
import { ArtistRelationships } from './ArtistRelationships'
import './artist-inspector.css'

type ArtistDetailProps = {
  artist: ArtistRecord
  catalogData: CatalogLinkData
  onSelectArtist?: (id: string) => void
  originArtist?: ArtistRecord
  onDelete?: () => void
  onEdit?: () => void
  onUpdateViaDiscogs?: () => void
  canUpdateViaDiscogs?: boolean
  trackStats?: RatingAverage
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
    standout?: boolean,
  ) => void
}

export function ArtistDetail({
  artist,
  catalogData,
  onSelectArtist,
  originArtist,
  onDelete,
  onEdit,
  onUpdateViaDiscogs,
  canUpdateViaDiscogs = true,
  trackStats,
  ratingCriteria,
  onDeleteRating,
  onRateTarget,
}: Readonly<ArtistDetailProps>) {
  const panelRef = useRef<HTMLElement>(null)
  const focusAfterNavigation = useRef(false)
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0
    if (focusAfterNavigation.current) {
      panelRef.current
        ?.querySelector<HTMLElement>('#artist-detail-title')
        ?.focus()
      focusAfterNavigation.current = false
    }
  }, [artist.id])
  const { creditRoles, releaseAppearances, trackAppearances } = useMemo(
    () => buildArtistInsights(artist, catalogData),
    [artist, catalogData],
  )
  const relationshipGroups = useMemo(
    () => buildArtistRelationshipGroups(artist, catalogData),
    [artist, catalogData],
  )

  const selectArtist = onSelectArtist
    ? (id: string) => {
        focusAfterNavigation.current = true
        onSelectArtist(id)
      }
    : undefined

  return (
    <aside
      ref={panelRef}
      className="panel detail-panel artist-detail-panel"
      aria-labelledby="artist-detail-title"
    >
      <ArtistInspectorHeader
        artist={artist}
        originArtist={originArtist}
        onSelectArtist={selectArtist}
        onEdit={onEdit}
        onDelete={onDelete}
        onUpdateViaDiscogs={onUpdateViaDiscogs}
        canUpdateViaDiscogs={canUpdateViaDiscogs}
      />

      <div className="artist-inspector-stats">
        <ArtistStats
          releases={releaseAppearances.length}
          tracks={trackStats?.trackCount ?? trackAppearances.length}
          rated={trackStats?.ratedTrackCount ?? 0}
          average={
            trackStats && trackStats.ratedTrackCount > 0
              ? trackStats.average.toFixed(2)
              : '–'
          }
        />
      </div>

      <ArtistInspectorTabs
        key={artist.id}
        relationships={
          <>
            <ArtistRelationships
              groups={relationshipGroups.groups}
              references={relationshipGroups.references}
              onSelectArtist={selectArtist}
            />
            {artist.identityHint || artist.summary ? (
              <details className="artist-inspector-about">
                <summary>About this artist</summary>
                {artist.identityHint ? <p>{artist.identityHint}</p> : null}
                {artist.summary ? <p>{artist.summary}</p> : null}
              </details>
            ) : null}
          </>
        }
        collection={
          <>
            <section aria-labelledby="artist-credits-title">
              <h3 id="artist-credits-title">Credit appearances</h3>
              <p className="artist-collection-note">
                Credits recorded for this artist.
              </p>
              <BadgeList
                values={creditRoles}
                emptyText="No credit roles recorded"
              />
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
            <RatingsPanel
              criteria={ratingCriteria}
              ratings={artist.ratings}
              targetId={artist.id}
              targetType="artist"
              onDeleteRating={onDeleteRating}
              onRateTarget={onRateTarget}
            />
          </>
        }
      />
    </aside>
  )
}

export type ArtistAppearance = {
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
        context: track.relationHint,
      },
    ]
  })

  return {
    creditRoles,
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
    const key = artistAppearanceIdentity(appearance)
    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, appearance)
      continue
    }

    merged.set(key, {
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

function compareText(left: string, right: string) {
  return left.localeCompare(right)
}

function artistAppearanceIdentity(appearance: ArtistAppearance) {
  return [
    appearance.href ?? '',
    normalizeText(appearance.label),
    normalizeText(appearance.meta),
    ...appearance.roles.map(normalizeText).sort(compareText),
  ].join('|')
}

type ArtistStatsProps = {
  releases: number
  rated: number
  average: string
  tracks: number
}

function ArtistStats({
  releases,
  rated,
  average,
  tracks,
}: Readonly<ArtistStatsProps>) {
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
        <dt>Rated</dt>
        <dd>{rated}</dd>
      </div>
      <div>
        <dt>Average</dt>
        <dd>{average}</dd>
      </div>
    </dl>
  )
}

type EmptyDetailPanelProps = {
  title: string
}

export function EmptyDetailPanel({ title }: Readonly<EmptyDetailPanelProps>) {
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
