import type { CatalogLinkData } from '../catalog/catalogLinks'
import { isAliasOfRelation } from './artistIdentity'
import type { ArtistRecord } from './artistsData'

export type ArtistRelationshipGroup = {
  title: string
  items: ArtistRelationshipItem[]
}

type ArtistRelationshipItem = {
  detail: string
  key: string
  label: string
  roles: string[]
}

export function buildArtistRelationshipGroups(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
): ArtistRelationshipGroup[] {
  const memberships = shouldShowMemberships(artist)
    ? uniqueRelationshipItems(
        artist.relations
          .filter((relation) => normalizeText(relation.type) === 'member of')
          .map((relation) => ({
            key: `membership-${relation.target}`,
            label: relation.target,
            roles: ['Member of'],
            detail: relation.detail,
          })),
      )
    : []
  const members = isGroupArtist(artist)
    ? uniqueRelationshipItems(
        catalogData.artists.flatMap((candidate) =>
          candidate.relations
            .filter(
              (relation) =>
                normalizeText(relation.type) === 'member of' &&
                normalizeText(relation.target) === normalizeText(artist.name),
            )
            .map((relation) => ({
              key: `member-${candidate.id}-${relation.target}`,
              label: candidate.name,
              roles: ['Member'],
              detail: relation.detail,
            })),
        ),
      )
    : []
  const otherRelations = uniqueRelationshipItems(
    artist.relations
      .filter((relation) => {
        const relationType = normalizeText(relation.type)

        return relationType !== 'member of' && !isAliasOfRelation(relation.type)
      })
      .map((relation) => ({
        key: `relation-${relation.type}-${relation.target}`,
        label: relation.target,
        roles: [relation.type],
        detail: relation.detail,
      })),
  )

  return [
    { title: 'Member of', items: memberships },
    { title: 'Members', items: members },
    { title: 'Other relations', items: otherRelations },
  ].filter((group) => group.items.length > 0)
}

function shouldShowMemberships(artist: ArtistRecord) {
  return !isGroupArtist(artist)
}

function isGroupArtist(artist: ArtistRecord) {
  return (
    artist.type === 'Band' ||
    artist.type === 'Project' ||
    artist.type === 'Collective'
  )
}

function uniqueRelationshipItems(items: ArtistRelationshipItem[]) {
  const seen = new Set<string>()
  const result: ArtistRelationshipItem[] = []

  for (const item of items) {
    const key = [normalizeText(item.label), ...item.roles.map(normalizeText)]
      .sort(compareText)
      .join('|')

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(item)
  }

  return result
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function compareText(left: string, right: string) {
  return left.localeCompare(right)
}
