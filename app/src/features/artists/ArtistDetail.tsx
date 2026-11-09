import { useEffect, useMemo, useRef } from 'react'
import { ArtistConnections } from './ArtistConnections'
import { artistConnectionGroups } from './artistConnectionGroups'
import { buildArtistGraph } from './artistStacks'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { type CatalogLinkData } from '../catalog/catalogLinks'
import { uniqueValues } from '../catalog/catalogGraph'
import type {
  RatingAverage,
  RatingCriterion,
  RatingTargetType,
} from '../catalog/catalogApi'
import { RatingsPanel } from '../ratings/RatingsPanel'
import type { ReleaseCoverImage } from '../releases/releasesData'
import { buildArtistIdentity } from './artistIdentity'
import {
  AppearanceGroup,
  ArtistIdentitySection,
  ArtistRelationshipGroups,
  BadgeList,
} from './ArtistDetailSections'
import { buildArtistRelationshipGroups } from './artistRelationshipGroups'
import type { ArtistRecord } from './artistsData'

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
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [artist.id])
  const graph = useMemo(
    () => buildArtistGraph(catalogData.artists, catalogData.relations ?? []),
    [catalogData.artists, catalogData.relations],
  )
  const hasLinkedConnections =
    artistConnectionGroups(artist.id, graph).length > 0
  const { creditRoles, releaseAppearances, trackAppearances } = useMemo(
    () => buildArtistInsights(artist, catalogData),
    [artist, catalogData],
  )
  const relationshipGroups = useMemo(
    () => buildArtistRelationshipGroups(artist, catalogData),
    [artist, catalogData],
  )
  const artistIdentity = useMemo(
    () =>
      artist.type === 'Person'
        ? buildArtistIdentity(artist, catalogData)
        : null,
    [artist, catalogData],
  )

  return (
    <aside
      ref={panelRef}
      className="panel detail-panel artist-detail-panel"
      aria-labelledby="artist-detail-title"
    >
      {originArtist && onSelectArtist ? (
        <nav
          className="artist-inspector-breadcrumb"
          aria-label="Artist context"
        >
          <button
            type="button"
            onClick={() => onSelectArtist(originArtist.id)}
            aria-label={`Return to ${originArtist.name}`}
          >
            ←
          </button>
          <span>From</span>
          <button type="button" onClick={() => onSelectArtist(originArtist.id)}>
            {originArtist.name}
          </button>
          <span aria-hidden="true">›</span>
          <strong>{artist.name}</strong>
        </nav>
      ) : null}
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{artist.type}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="artist-detail-title">{artist.name}</h2>
        {artist.identityHint ? <p>{artist.identityHint}</p> : null}
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
            {onUpdateViaDiscogs ? (
              <span className="discogs-action-state">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!canUpdateViaDiscogs}
                  onClick={onUpdateViaDiscogs}
                >
                  Update via Discogs
                </button>
                {!canUpdateViaDiscogs ? (
                  <span className="discogs-disabled-note">
                    Add a Discogs token in Settings to use Discogs lookup.
                  </span>
                ) : null}
              </span>
            ) : null}
            {onDelete ? (
              <DeleteSessionRecordButton
                confirmationMessage="Delete this artist and remove their credits and relations?"
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="detail-section artist-inspector-stats">
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

      {onSelectArtist && hasLinkedConnections ? (
        <section
          className="detail-section artist-inspector-connections"
          aria-label="Artist connections"
        >
          <ArtistConnections
            artistId={artist.id}
            graph={graph}
            selectedArtistId={artist.id}
            onSelect={onSelectArtist}
          />
        </section>
      ) : null}

      <RatingsPanel
        criteria={ratingCriteria}
        ratings={artist.ratings}
        targetId={artist.id}
        targetType="artist"
        onDeleteRating={onDeleteRating}
        onRateTarget={onRateTarget}
      />

      {artistIdentity && !hasLinkedConnections ? (
        <ArtistIdentitySection identity={artistIdentity} />
      ) : null}

      <section
        className="detail-section"
        aria-labelledby="artist-relations-title"
      >
        <h3 id="artist-relations-title">Relations and credits</h3>

        <BadgeList values={creditRoles} emptyText="No credit roles recorded" />
        {!hasLinkedConnections ? (
          <ArtistRelationshipGroups groups={relationshipGroups} />
        ) : relationshipGroups.length > 0 ? (
          <details>
            <summary>Relationship notes</summary>
            <ArtistRelationshipGroups groups={relationshipGroups} />
          </details>
        ) : null}
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
