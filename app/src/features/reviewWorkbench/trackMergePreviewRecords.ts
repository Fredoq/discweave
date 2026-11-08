import type { TrackDto } from '../catalog/api/catalogTypes'
import type { TrackMergeSelection } from './trackMergeApi'

// The confirmation must display the exact records signed into the preview,
// never fall back to older comparison cards for an incomplete response.
export function validPreviewRecords(
  value: unknown,
  selection: TrackMergeSelection,
): value is TrackDto[] {
  if (!Array.isArray(value)) return false
  const expected = [
    selection.keeperTrackId,
    ...selection.duplicateTrackIds,
  ].sort()
  if (value.length !== expected.length || !value.every(validRecord))
    return false
  return value
    .map((record) => record.id)
    .sort()
    .every((id, index) => id === expected[index])
}

function validRecord(value: unknown): value is TrackDto {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    strings(record.genres) &&
    strings(record.tags) &&
    optionalNumber(record.durationSeconds) &&
    optionalNumber(record.versionYear) &&
    (record.isOriginal == null || typeof record.isOriginal === 'boolean') &&
    optionalRows(
      record.credits,
      (row) =>
        texts(row, ['artistId', 'artistName', 'role']) &&
        (row.roles == null || strings(row.roles)),
    ) &&
    optionalRows(
      record.releaseAppearances,
      (row) =>
        texts(row, ['releaseId', 'releaseTitle', 'releaseArtist']) &&
        typeof row.position === 'number' &&
        optionalNumber(row.year) &&
        ['disc', 'side', 'label'].every(
          (key) => row[key] == null || typeof row[key] === 'string',
        ),
    ) &&
    optionalRows(
      record.digitalFiles,
      (row) =>
        texts(row, ['digitalTrackFileLinkId', 'path']) &&
        optionalNumber(row.durationSeconds) &&
        ['format', 'codec', 'quality'].every(
          (key) => row[key] == null || typeof row[key] === 'string',
        ),
    ) &&
    optionalRows(record.externalSources, () => true)
  )
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
function optionalNumber(value: unknown) {
  return value == null || (typeof value === 'number' && Number.isFinite(value))
}

function texts(row: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => typeof row[key] === 'string')
}
function optionalRows(
  value: unknown,
  valid: (row: Record<string, unknown>) => boolean,
) {
  return (
    value == null ||
    (Array.isArray(value) &&
      value.every(
        (row: unknown) =>
          row !== null &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          valid(row as Record<string, unknown>),
      ))
  )
}
