import type { CatalogLinkData } from '../catalog/catalogLinks'
import { buildArtistIdentity } from './artistIdentity'
import type { ArtistRecord } from './artistsData'

type ArtistMasterListProps = Readonly<{
  artists: ArtistRecord[]
  catalogData: CatalogLinkData
  selectedArtistId: string
  onSelectArtist: (artistId: string) => void
}>

export function ArtistMasterList({
  artists,
  catalogData,
  selectedArtistId,
  onSelectArtist,
}: ArtistMasterListProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="artist-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="artist-results-title">Artist master list</h2>
          <p>Aliases, memberships and collection activity for graph lookup.</p>
        </div>
      </div>

      <ul className="artist-master-list" aria-label="Artist master list">
        {artists.map((artist) => (
          <ArtistMasterRow
            key={artist.id}
            artist={artist}
            catalogData={catalogData}
            isSelected={artist.id === selectedArtistId}
            onSelect={() => onSelectArtist(artist.id)}
          />
        ))}
      </ul>
    </section>
  )
}

type ArtistMasterRowProps = Readonly<{
  artist: ArtistRecord
  catalogData: CatalogLinkData
  isSelected: boolean
  onSelect: () => void
}>

function ArtistMasterRow({
  artist,
  catalogData,
  isSelected,
  onSelect,
}: ArtistMasterRowProps) {
  const summary = buildArtistMasterRowSummary(artist, catalogData)

  return (
    <li>
      <button
        className={
          isSelected ? 'artist-master-row is-selected' : 'artist-master-row'
        }
        type="button"
        aria-label={`${artist.name} artist row`}
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <span className="artist-master-row-main">
          <span className="artist-master-row-title">
            <strong>{artist.name}</strong>
            <span className="badge badge-tag">{artist.type}</span>
          </span>
          <span className="artist-master-relationship">
            {summary.relationshipSummary}
          </span>
        </span>

        <span className="artist-master-activity" aria-label="Activity counts">
          <ArtistActivityCount label="Releases" value={summary.releases} />
          <ArtistActivityCount label="Tracks" value={summary.tracks} />
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
  value: number
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
      ) ||
      artist.credits.some(
        (credit) =>
          normalizeText(credit.target) === normalizeText(release.title) &&
          normalizeText(credit.scope) === 'release',
      )
    )
  })
  const tracks = catalogData.tracks.filter((track) => {
    return (
      track.artistId === artist.id ||
      normalizeText(track.artist) === artistName ||
      track.credits.some((credit) =>
        artistCreditMatches(credit, artist, artistName),
      ) ||
      artist.credits.some(
        (credit) =>
          normalizeText(credit.target) === normalizeText(track.title) &&
          normalizeText(credit.scope) === 'track',
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
