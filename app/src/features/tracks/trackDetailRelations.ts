import type { TrackRelation } from './tracksData'

export function trackDetailRelationGroups(relations: TrackRelation[]) {
  const origin: TrackRelation[] = []
  const remixes: TrackRelation[] = []
  const versions: TrackRelation[] = []
  const other: TrackRelation[] = []

  for (const relation of relations) {
    const relationTypeCode = productTrackRelationTypeCode(relation)
    if (relation.direction === 'outgoing' && relationTypeCode) {
      origin.push(relation)
    } else if (
      relation.direction === 'incoming' &&
      relationTypeCode === 'remixOf'
    ) {
      remixes.push(relation)
    } else if (
      relation.direction === 'incoming' &&
      relationTypeCode === 'versionOf'
    ) {
      versions.push(relation)
    } else {
      other.push(relation)
    }
  }

  return { origin, remixes, versions, other }
}

function productTrackRelationTypeCode(relation: TrackRelation) {
  const relationType = (relation.typeCode ?? relation.type).trim().toLowerCase()
  const relationLabel = relation.type.trim().toLowerCase()

  if (relationType === 'remixof' || relationLabel === 'remix of') {
    return 'remixOf'
  }

  if (relationType === 'versionof' || relationLabel === 'version of') {
    return 'versionOf'
  }

  return ''
}
