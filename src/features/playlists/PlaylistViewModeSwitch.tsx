export function PlaylistViewModeSwitch({
  mode,
  onModeChange,
}: {
  mode: 'playlists' | 'ratings'
  onModeChange: (mode: 'playlists' | 'ratings') => void
}) {
  return (
    <div
      className="settings-mode-switch"
      role="group"
      aria-label="Playlist view"
    >
      <button
        aria-pressed={mode === 'playlists'}
        className={mode === 'playlists' ? 'is-selected' : undefined}
        type="button"
        onClick={() => onModeChange('playlists')}
      >
        Playlists
      </button>
      <button
        aria-pressed={mode === 'ratings'}
        className={mode === 'ratings' ? 'is-selected' : undefined}
        type="button"
        onClick={() => onModeChange('ratings')}
      >
        Rating showcases
      </button>
    </div>
  )
}
