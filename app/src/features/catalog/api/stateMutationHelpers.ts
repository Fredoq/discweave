import type { LabelRecord } from '../../labels/labelsData'
import type { RelationRecord } from '../../relations/relationsData'
import type { CatalogState } from './catalogTypes'
import type { ReleaseRecord } from '../../releases/releasesData'

export function findArtistName(state: CatalogState, artistId: string) {
  return state.artists.find((artist) => artist.id === artistId)?.name ?? ''
}

export function unlinkRelationRecord(
  relation: RelationRecord,
  kind: NonNullable<RelationRecord['sourceLink']>['kind'],
  id: string,
): RelationRecord {
  return {
    ...relation,
    sourceLink:
      relation.sourceLink?.kind === kind && relation.sourceLink.id === id
        ? undefined
        : relation.sourceLink,
    targetLink:
      relation.targetLink?.kind === kind && relation.targetLink.id === id
        ? undefined
        : relation.targetLink,
    linkedEntityLink:
      relation.linkedEntityLink?.kind === kind &&
      relation.linkedEntityLink.id === id
        ? undefined
        : relation.linkedEntityLink,
  }
}

export function updateReleaseLabelName(
  release: ReleaseRecord,
  label: LabelRecord,
): ReleaseRecord {
  if (
    !(release.labels ?? []).some(
      (releaseLabel) => releaseLabel.labelId === label.id,
    )
  ) {
    return release
  }

  return {
    ...release,
    label:
      release.labels?.[0]?.labelId === label.id ? label.name : release.label,
    labels: release.labels?.map((releaseLabel) =>
      releaseLabel.labelId === label.id
        ? { ...releaseLabel, name: label.name }
        : releaseLabel,
    ),
  }
}

export function releaseHasLabelId(
  releaseId: string,
  state: CatalogState,
  label: LabelRecord,
) {
  return state.releases.some(
    (release) =>
      release.id === releaseId &&
      (release.labels ?? []).some(
        (releaseLabel) => releaseLabel.labelId === label.id,
      ),
  )
}
