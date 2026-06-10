import { useState } from 'react'
import { FilterSelect } from '../catalog/FilterSelect'
import type { ArtistRecord } from '../artists/artistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import type {
  EntityRating,
  RatingCriterion,
  RatingTargetType,
} from '../catalog/catalogApi'
import { ratingValueFor } from '../ratings/ratingUtils'
import { PlaylistViewModeSwitch } from './PlaylistViewModeSwitch'

export function RatingShowcasesView({
  artists,
  onViewModeChange,
  ratings,
  ratingCriteria,
  releases,
  tracks,
}: {
  artists: ArtistRecord[]
  onViewModeChange: (mode: 'playlists' | 'ratings') => void
  ratings: EntityRating[]
  ratingCriteria: RatingCriterion[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
}) {
  const applicableCriteria = ratingCriteria.filter(
    (criterion) => criterion.isActive,
  )
  const [criterionId, setCriterionId] = useState(
    applicableCriteria.find((criterion) => criterion.code === 'overall')?.id ??
      applicableCriteria[0]?.id ??
      '',
  )
  const selectedCriterion =
    applicableCriteria.find((criterion) => criterion.id === criterionId) ??
    applicableCriteria[0]
  const [targetType, setTargetType] = useState<RatingTargetType>(
    selectedCriterion?.targetTypes[0] ?? 'track',
  )
  const [mode, setMode] = useState<'top' | 'unrated'>('top')
  const availableTargetTypes = selectedCriterion?.targetTypes ?? []
  const normalizedTargetType = availableTargetTypes.includes(targetType)
    ? targetType
    : (availableTargetTypes[0] ?? 'track')
  const rows = buildRatingShowcaseRows(
    selectedCriterion,
    normalizedTargetType,
    mode,
    artists,
    ratings,
    releases,
    tracks,
  )

  return (
    <section className="catalog-layout" aria-label="Rating showcases">
      <div className="catalog-main">
        <div className="filter-bar">
          <PlaylistViewModeSwitch
            mode="ratings"
            onModeChange={onViewModeChange}
          />
          <FilterSelect
            label="Criterion"
            value={selectedCriterion?.name ?? ''}
            values={applicableCriteria.map((criterion) => criterion.name)}
            onChange={(name) => {
              const nextCriterion = applicableCriteria.find(
                (criterion) => criterion.name === name,
              )
              setCriterionId(nextCriterion?.id ?? '')
              setTargetType(nextCriterion?.targetTypes[0] ?? 'track')
            }}
          />
          <FilterSelect
            label="Target type"
            value={ratingTargetTypeLabel(normalizedTargetType, true)}
            values={availableTargetTypes.map((availableTargetType) =>
              ratingTargetTypeLabel(availableTargetType, true),
            )}
            onChange={(label) => {
              const nextType = availableTargetTypes.find(
                (candidate) => ratingTargetTypeLabel(candidate, true) === label,
              )
              setTargetType(nextType ?? normalizedTargetType)
            }}
          />
          <FilterSelect
            label="Scope"
            value="Collection"
            values={['Collection']}
            disabled
            onChange={() => {}}
          />
          <FilterSelect
            label="View"
            value={mode === 'top' ? 'Top rated' : 'Unrated'}
            values={['Top rated', 'Unrated']}
            onChange={(value) =>
              setMode(value === 'Unrated' ? 'unrated' : 'top')
            }
          />
          <span className="result-count">{rows.length} shown</span>
        </div>
        <section
          className="panel catalog-panel"
          aria-labelledby="rating-showcases-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="rating-showcases-title">Rating showcases</h2>
              <p>Computed ranked views from collection ratings.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="catalog-table workspace-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Title</th>
                  <th scope="col">Type</th>
                  <th scope="col">Rating</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.targetType}-${row.id}`}>
                    <td data-label="Rank">{index + 1}</td>
                    <th scope="row">
                      <a className="row-title" href={row.href}>
                        <strong>{row.title}</strong>
                        <span>{row.subtitle}</span>
                      </a>
                    </th>
                    <td data-label="Type">
                      {ratingTargetTypeLabel(row.targetType)}
                    </td>
                    <td data-label="Rating">
                      {row.value !== undefined ? `${row.value}/10` : 'Unrated'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside
        className="panel detail-panel"
        aria-label="Rating showcase filters"
      >
        <div className="detail-header">
          <span className="entity-type">Computed view</span>
          <h2>{selectedCriterion?.name ?? 'No criterion'}</h2>
          <p>{mode === 'top' ? 'Top rated' : 'Unrated'} collection targets.</p>
        </div>
      </aside>
    </section>
  )
}

type RatingShowcaseRow = {
  id: string
  href: string
  subtitle: string
  targetType: RatingTargetType
  title: string
  value?: number
}

type RatingTargetRow = Omit<RatingShowcaseRow, 'value'> & {
  ratings?: EntityRating[]
}

function buildRatingShowcaseRows(
  criterion: RatingCriterion | undefined,
  targetType: RatingTargetType,
  mode: 'top' | 'unrated',
  artists: ArtistRecord[],
  ratings: EntityRating[],
  releases: ReleaseRecord[],
  tracks: TrackRecord[],
) {
  if (!criterion) {
    return []
  }

  const rows = ratingTargetsFor(
    targetType,
    artists,
    ratings,
    releases,
    tracks,
  ).map((target) => ({
    ...target,
    value: ratingValueFor(target.ratings, criterion.id),
  }))

  return mode === 'top'
    ? rows
        .filter((row) => row.value !== undefined)
        .sort(
          (left, right) =>
            (right.value ?? 0) - (left.value ?? 0) ||
            left.title.localeCompare(right.title),
        )
    : rows
        .filter((row) => row.value === undefined)
        .sort((left, right) => left.title.localeCompare(right.title))
}

function ratingTargetsFor(
  targetType: RatingTargetType,
  artists: ArtistRecord[],
  ratings: EntityRating[],
  releases: ReleaseRecord[],
  tracks: TrackRecord[],
): RatingTargetRow[] {
  if (targetType === 'artist') {
    return artists.map((artist) => ({
      id: artist.id,
      href: `/artists?artist=${encodeURIComponent(artist.id)}`,
      subtitle: artist.type,
      targetType,
      title: artist.name,
      ratings: artist.ratings,
    }))
  }

  if (targetType === 'release') {
    return releases.map((release) => ({
      id: release.id,
      href: releaseHref(release.id),
      subtitle: `${release.artist} · ${release.year}`,
      targetType,
      title: release.title,
      ratings: release.ratings,
    }))
  }

  if (targetType === 'track') {
    return tracks.map((track) => ({
      id: track.id,
      href: trackHref(track.id),
      subtitle: `${showcaseTrackArtistDisplay(track)} · ${showcaseTrackReleaseDisplay(track)}`,
      targetType,
      title: track.title,
      ratings: track.ratings,
    }))
  }

  return uniqueLabelTargets(releases).map((label) => ({
    id: label.id,
    href: `/releases?label=${encodeURIComponent(label.title)}`,
    subtitle: 'Label',
    targetType,
    title: label.title,
    ratings: ratings.filter(
      (rating) => rating.targetType === 'label' && rating.targetId === label.id,
    ),
  }))
}

function showcaseTrackArtistDisplay(track: TrackRecord) {
  return (
    track.artist ||
    track.credits.map((credit) => credit.artist).join(', ') ||
    'Unknown artist'
  )
}

function showcaseTrackReleaseDisplay(track: TrackRecord) {
  return track.release.title || 'Unlinked release'
}

function uniqueLabelTargets(releases: ReleaseRecord[]) {
  const labels = new Map<string, { id: string; title: string }>()

  for (const release of releases) {
    for (const label of release.labels ?? []) {
      if (label.labelId) {
        labels.set(label.labelId, { id: label.labelId, title: label.name })
      }
    }
  }

  return [...labels.values()].sort((left, right) =>
    left.title.localeCompare(right.title),
  )
}

function ratingTargetTypeLabel(targetType: RatingTargetType, plural = false) {
  const labels: Record<RatingTargetType, { plural: string; singular: string }> =
    {
      artist: { plural: 'Artists', singular: 'Artist' },
      release: { plural: 'Releases', singular: 'Release' },
      track: { plural: 'Tracks', singular: 'Track' },
      label: { plural: 'Labels', singular: 'Label' },
    }

  return plural ? labels[targetType].plural : labels[targetType].singular
}

function releaseHref(releaseId: string) {
  return `/releases?release=${encodeURIComponent(releaseId)}`
}

function trackHref(trackId: string) {
  return `/tracks?track=${encodeURIComponent(trackId)}`
}
