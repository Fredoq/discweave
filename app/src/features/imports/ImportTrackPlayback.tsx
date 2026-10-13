import { AlertCircle, ExternalLink, LoaderCircle } from 'lucide-react'
import type { ReleaseImportDraftTrack } from '../catalog/catalogApi'
import './imports-playback.css'
import type { ImportTrackPlayback } from './useImportTrackPlayback'

type ImportTrackPlayButtonProps = Readonly<{
  playback: ImportTrackPlayback
  track: ReleaseImportDraftTrack
  trackLabel: string
  variant: 'icon' | 'labelled'
}>

export function ImportTrackPlayButton({
  playback,
  track,
  trackLabel,
  variant,
}: ImportTrackPlayButtonProps) {
  if (!playback.canPlay(track)) {
    return null
  }

  const isPending = playback.isPending(track)
  const failure = playback.failureFor(track)
  const icon = playbackIcon(isPending, failure)

  if (variant === 'labelled') {
    return (
      <button
        aria-busy={isPending || undefined}
        className="button button-secondary button-compact imports-track-play-button"
        disabled={isPending}
        type="button"
        onClick={() => {
          void playback.play(track)
        }}
      >
        {icon}
        {isPending ? 'Opening...' : 'Play in default player'}
      </button>
    )
  }

  return (
    <button
      aria-busy={isPending || undefined}
      aria-label={`Play ${trackLabel} in default player`}
      className={`imports-track-play-icon${failure ? ' has-error' : ''}`}
      disabled={isPending}
      title={failure ?? 'Play in default player'}
      type="button"
      onClick={() => {
        void playback.play(track)
      }}
    >
      {icon}
    </button>
  )
}

export function ImportTrackPlaybackError({
  playback,
  track,
}: Readonly<{
  playback: ImportTrackPlayback
  track: ReleaseImportDraftTrack
}>) {
  const failure = playback.failureFor(track)
  return failure ? (
    <p className="imports-track-play-error" role="alert">
      <AlertCircle aria-hidden="true" size={14} />
      {failure}
    </p>
  ) : null
}

function playbackIcon(isPending: boolean, failure: string | null) {
  if (isPending) {
    return (
      <LoaderCircle
        aria-hidden="true"
        className="imports-track-play-spinner"
        size={14}
      />
    )
  }

  return failure ? (
    <AlertCircle aria-hidden="true" size={14} />
  ) : (
    <ExternalLink aria-hidden="true" size={14} />
  )
}
