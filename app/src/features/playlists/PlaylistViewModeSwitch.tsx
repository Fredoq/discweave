export function PlaylistViewModeSwitch({
  mode,
  onModeChange,
}: Readonly<{
  mode: 'playlists' | 'ratings'
  onModeChange: (mode: 'playlists' | 'ratings') => void
}>) {
  return (
    <fieldset className="settings-mode-switch" aria-label="Playlist view">
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
    </fieldset>
  )
}
