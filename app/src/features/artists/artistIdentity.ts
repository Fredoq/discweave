import type { CatalogLinkData } from '../catalog/catalogLinks'
import type { ArtistRecord } from './artistsData'

export type ArtistIdentity = {
  aliases: string[]
  realName: string
}

export function buildArtistIdentity(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
): ArtistIdentity {
  const realNameRelation = artist.relations.find(
    (relation) =>
      isOutgoingRelation(relation) &&
      isAliasOfRelation(relation.type) &&
      relation.target.trim(),
  )
  const aliases = uniqueNonEmpty(
    catalogData.artists.flatMap((candidate) => {
      if (candidate.id === artist.id) {
        return []
      }

      return candidate.relations
        .filter(
          (relation) =>
            isOutgoingRelation(relation) &&
            isAliasOfRelation(relation.type) &&
            normalizeText(relation.target) === normalizeText(artist.name),
        )
        .map(() => candidate.name)
    }),
  )

  return {
    aliases,
    realName: realNameRelation?.target.trim() || artist.name,
  }
}

export function isAliasOfRelation(type: string) {
  return normalizeRelationType(type) === 'aliasof'
}

function isOutgoingRelation(relation: ArtistRecord['relations'][number]) {
  return relation.direction !== 'incoming'
}

function normalizeRelationType(type: string) {
  return type
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
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
