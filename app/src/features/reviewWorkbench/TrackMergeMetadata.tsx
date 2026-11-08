import type { TrackDto } from '../catalog/api/catalogTypes'
import { trackReviewDuration } from './duplicateTrackReview'

function scalarValues(track: TrackDto) {
  return {
    Title: track.title,
    Duration: trackReviewDuration(track.durationSeconds),
    Year: track.versionYear?.toString() ?? 'Unknown year',
    'Original recording': track.isOriginal ? 'Yes' : 'Not marked',
  }
}

export function TrackMergeMetadata({
  records,
  keeperId,
}: Readonly<{ records: TrackDto[]; keeperId: string }>) {
  const keeper = records.find((record) => record.id === keeperId)!
  const kept = scalarValues(keeper)
  return (
    <section aria-label="Metadata kept after merge">
      <h4>Current keeper values</h4>
      <p>
        These values come from this server preview. Duplicate scalar values are
        discarded, including values where the keeper is unknown.
      </p>
      <ul>
        {Object.entries(kept).map(([label, value]) => (
          <li key={label}>
            {label}: {value}
          </li>
        ))}
      </ul>
      {records
        .filter((record) => record.id !== keeperId)
        .map((record) => {
          const differences = Object.entries(scalarValues(record)).filter(
            ([key, value]) => value !== kept[key as keyof typeof kept],
          )
          return (
            <div key={record.id}>
              <strong>Duplicate: {record.title}</strong>
              {differences.length ? (
                <ul>
                  {differences.map(([label, value]) => (
                    <li key={label}>
                      {label}: {value} → {kept[label as keyof typeof kept]}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Same scalar values as the keeper.</p>
              )}
            </div>
          )
        })}
    </section>
  )
}
