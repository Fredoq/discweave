import type { CreditDto, ReleaseDto, TrackDto } from './catalogTypes'

export function creditTargetTitle(
  credit: CreditDto,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
) {
  if (credit.targetTitle) {
    return credit.targetTitle
  }
  if (credit.targetType === 'release') {
    return releasesById.get(credit.targetId)?.title ?? 'Unknown release'
  }
  return tracksById.get(credit.targetId)?.title ?? 'Unknown track'
}
