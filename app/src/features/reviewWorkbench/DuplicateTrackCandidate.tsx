import type { TrackDto } from '../catalog/api/catalogTypes'
import { trackReviewArtist, trackReviewDuration } from './duplicateTrackReview'

type Props = Readonly<{
  track: TrackDto
  number: number
  keeperId: string | null
  selected: boolean
  onKeep: () => void
  onSelect: (selected: boolean) => void
  onOpen: (kind: 'track' | 'release', id: string, title: string) => void
}>

export function DuplicateTrackCandidate({
  track,
  number,
  keeperId,
  selected,
  onKeep,
  onSelect,
  onOpen,
}: Props) {
  return (
    <article
      className="duplicate-track-candidate"
      aria-label={`Record ${number}: ${track.title}`}
    >
      <header>
        <h3>
          Record {number}: {track.title}
        </h3>
        <p>
          {trackReviewArtist(track)} ·{' '}
          {trackReviewDuration(track.durationSeconds)} ·{' '}
          {track.versionYear ?? 'Unknown year'}
        </p>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={() => onOpen('track', track.id, track.title)}
        >
          Open record {number}
        </button>
      </header>
      <dl>
        <dt>Original recording</dt>
        <dd>{track.isOriginal ? 'Yes' : 'Not marked'}</dd>
        <dt>Credits</dt>
        <dd>
          {track.credits?.length ? (
            <ul>
              {track.credits.map((credit, index) => (
                <li key={`${credit.artistId}-${index}`}>
                  {credit.artistName}:{' '}
                  {(credit.roles ?? [credit.role]).join(', ')}
                </li>
              ))}
            </ul>
          ) : (
            'No credits'
          )}
        </dd>
        <dt>Genres and tags</dt>
        <dd>{[...track.genres, ...track.tags].join(', ') || 'None'}</dd>
        <dt>Release appearances ({track.releaseAppearances?.length ?? 0})</dt>
        <dd>
          {track.releaseAppearances?.length ? (
            <ul>
              {track.releaseAppearances.map((appearance, index) => (
                <li key={`${appearance.releaseId}-${index}`}>
                  <button
                    className="duplicate-track-link"
                    type="button"
                    onClick={() =>
                      onOpen(
                        'release',
                        appearance.releaseId,
                        appearance.releaseTitle,
                      )
                    }
                  >
                    {appearance.releaseTitle}
                  </button>
                  {' · '}
                  {appearance.releaseArtist}
                  {' · '}
                  {appearance.year ?? 'Unknown year'}
                  {appearance.label ? ` · ${appearance.label}` : ''}
                  {' · '}
                  {[
                    appearance.disc,
                    appearance.side,
                    `Track ${appearance.position}`,
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                </li>
              ))}
            </ul>
          ) : (
            'No release appearances'
          )}
        </dd>
        <dt>Linked files ({track.digitalFiles?.length ?? 0})</dt>
        <dd>
          {track.digitalFiles?.length ? (
            <ul>
              {track.digitalFiles.map((file) => (
                <li key={file.digitalTrackFileLinkId}>
                  {file.path}
                  {' · '}
                  {[file.format, file.codec, file.quality]
                    .filter(Boolean)
                    .join(' / ') || 'Unknown format'}
                  {' · '}
                  {trackReviewDuration(file.durationSeconds)}
                </li>
              ))}
            </ul>
          ) : (
            'No linked files'
          )}
        </dd>
      </dl>
      <div className="duplicate-track-selection">
        <label>
          <input
            type="radio"
            name="duplicate-track-keeper"
            checked={keeperId === track.id}
            onChange={onKeep}
          />{' '}
          Keep record {number}
        </label>
        <label>
          <input
            type="checkbox"
            checked={selected}
            disabled={!keeperId || keeperId === track.id}
            onChange={(event) => onSelect(event.currentTarget.checked)}
          />{' '}
          Record {number} is a duplicate
        </label>
      </div>
    </article>
  )
}
