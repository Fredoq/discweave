import { useMemo } from 'react'
import { ArtistStackDetails } from './ArtistStackDetails'
import { buildArtistGraph, visibleArtistStacks } from './artistStacks'
import './artist-stacks.css'
import type { RatingAverage } from '../catalog/catalogApi'
import type { CatalogLinkData } from '../catalog/catalogLinks'
import { buildArtistIdentity } from './artistIdentity'
import type { ArtistRecord } from './artistsData'

type ArtistMasterListProps = Readonly<{
  artists: ArtistRecord[]
  catalogData: CatalogLinkData
  selectedArtistId: string
  trackStats?: Map<string, RatingAverage>
  onSelectArtist: (artistId: string) => void
  onSelectRelatedArtist: (artistId: string, originArtistId: string) => void
}>

export function ArtistMasterList({
  artists,
  catalogData,
  selectedArtistId,
  trackStats,
  onSelectArtist,
  onSelectRelatedArtist,
}: ArtistMasterListProps) {
  const graph = useMemo(
    () => buildArtistGraph(catalogData.artists, catalogData.relations ?? []),
    [catalogData.artists, catalogData.relations],
  )
  const stacks = visibleArtistStacks(artists, graph.familyById)
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="artist-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="artist-results-title">Artist master list</h2>
          <p>
            {stacks.length} stacks · {artists.length} matching artist records
          </p>
          <p>
            Expand a stack to explore aliases, groups and members. Each name
            keeps its own collection activity.
          </p>
        </div>
      </div>

      <ul className="artist-master-list" aria-label="Artist master list">
        {stacks.map((stack) => (
          <li key={stack.root.id} className="artist-stack">
            {stack.representative.id !== selectedArtistId &&
            stack.artists.some((artist) => artist.id === selectedArtistId) ? (
              <p className="artist-stack-selection">
                Selected:{' '}
                {
                  stack.artists.find((artist) => artist.id === selectedArtistId)
                    ?.name
                }
              </p>
            ) : null}
            {stack.representative.id !== stack.root.id ? (
              <p className="artist-stack-selection">
                Identity: {stack.root.name}
              </p>
            ) : null}
            <ul className="artist-master-list">
              <ArtistMasterRow
                artist={stack.representative}
                catalogData={catalogData}
                isSelected={stack.representative.id === selectedArtistId}
                trackStats={trackStats?.get(stack.representative.id)}
                onSelect={() => onSelectArtist(stack.representative.id)}
              />
            </ul>
            {stack.artists.length > 1 ? (
              <p className="artist-stack-selection">
                Names: {stack.artists.map((artist) => artist.name).join(', ')}
              </p>
            ) : null}
            {(graph.connections.get(stack.representative.id)?.length ?? 0) >
            0 ? (
              <ArtistStackDetails
                artist={stack.representative}
                artistCount={stack.artists.length}
                selectedArtistId={selectedArtistId}
                graph={graph}
                onSelect={onSelectRelatedArtist}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

type ArtistMasterRowProps = Readonly<{
  artist: ArtistRecord
  catalogData: CatalogLinkData
  isSelected: boolean
  trackStats?: RatingAverage
  onSelect: () => void
}>

function ArtistMasterRow({
  artist,
  catalogData,
  isSelected,
  trackStats,
  onSelect,
}: ArtistMasterRowProps) {
  const summary = buildArtistMasterRowSummary(artist, catalogData)
  const accessibleLabel = [artist.name, artist.identityHint, 'artist row']
    .filter(Boolean)
    .join(' ')

  return (
    <li>
      <button
        className={
          isSelected ? 'artist-master-row is-selected' : 'artist-master-row'
        }
        type="button"
        aria-label={accessibleLabel}
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <span className="artist-master-row-main">
          <span className="artist-master-row-title">
            <strong>{artist.name}</strong>
            <span className="badge badge-tag">{artist.type}</span>
          </span>
          {artist.identityHint ? (
            <span className="artist-master-relationship">
              {artist.identityHint}
            </span>
          ) : null}
          <span className="artist-master-relationship">
            {summary.relationshipSummary}
          </span>
        </span>

        <span className="artist-master-activity" aria-label="Activity counts">
          <ArtistActivityCount label="Releases" value={summary.releases} />
          <ArtistActivityCount
            label="Tracks"
            value={trackStats?.trackCount ?? 0}
          />
          <ArtistActivityCount
            label="Rated"
            value={trackStats?.ratedTrackCount ?? 0}
          />
          <ArtistActivityCount
            label="Average"
            value={
              trackStats && trackStats.ratedTrackCount > 0
                ? trackStats.average.toFixed(2)
                : '–'
            }
          />
        </span>
      </button>
    </li>
  )
}

function ArtistActivityCount({
  label,
  value,
}: Readonly<{
  label: string
  value: number | string
}>) {
  return (
    <span className="artist-master-count">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

function buildArtistMasterRowSummary(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
) {
  const artistName = normalizeText(artist.name)
  const releases = catalogData.releases.filter((release) => {
    return (
      release.artistId === artist.id ||
      normalizeText(release.artist) === artistName ||
      (release.artistCredits ?? []).some((credit) =>
        artistCreditMatches(credit, artist, artistName),
      )
    )
  })
  const tracks = catalogData.tracks.filter((track) => {
    return (
      track.artistId === artist.id ||
      normalizeText(track.artist) === artistName ||
      track.credits.some((credit) =>
        artistCreditMatches(credit, artist, artistName),
      )
    )
  })

  return {
    relationshipSummary: artistRelationshipSummary(artist, catalogData),
    releases: releases.length,
    tracks: tracks.length,
  }
}

function artistRelationshipSummary(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
) {
  if (artist.type === 'Person') {
    const identity = buildArtistIdentity(artist, catalogData)

    if (normalizeText(identity.realName) !== normalizeText(artist.name)) {
      return `Real name: ${identity.realName}`
    }

    if (identity.aliases.length > 0) {
      return `Aliases: ${identity.aliases.join(', ')}`
    }
  }

  const memberships = directRelationTargets(artist, 'member of')
  const members = groupMemberNames(artist, catalogData)

  if (isGroupArtist(artist) && members.length > 0) {
    return `Members: ${members.join(', ')}`
  }

  if (!isGroupArtist(artist) && memberships.length > 0) {
    return memberships.map((target) => `Member of ${target}`).join(', ')
  }

  return 'No direct relations recorded'
}

function directRelationTargets(artist: ArtistRecord, type: string) {
  const normalizedType = normalizeText(type)

  return uniqueNonEmpty(
    artist.relations
      .filter((relation) => normalizeText(relation.type) === normalizedType)
      .map((relation) => relation.target),
  )
}

function groupMemberNames(artist: ArtistRecord, catalogData: CatalogLinkData) {
  const groupName = normalizeText(artist.name)

  return uniqueNonEmpty(
    catalogData.artists.flatMap((candidate) =>
      candidate.relations
        .filter(
          (relation) =>
            normalizeText(relation.type) === 'member of' &&
            normalizeText(relation.target) === groupName,
        )
        .map(() => candidate.name),
    ),
  )
}

function isGroupArtist(artist: ArtistRecord) {
  return (
    artist.type === 'Band' ||
    artist.type === 'Project' ||
    artist.type === 'Collective'
  )
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    const key = normalizeText(trimmed)

    if (!trimmed || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(trimmed)
  }

  return result
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
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
