export type PlaylistSuggestion = {
  trackId: string
  title: string
  artist: string
  releaseTitle: string
  reason: string
}

export type PlaylistSuggestionResult = {
  items: PlaylistSuggestion[]
  interpreted: string[]
  warnings: string[]
  examined: number
  matched: number
  shortlisted: number
}

export type PlaylistSuggestionStatus = { configured: boolean; model: string }

export type PlaylistSuggestionsBridge = {
  status: () => Promise<PlaylistSuggestionStatus>
  generate: (request: {
    prompt: string
    excludedTrackIds: string[]
    consented: true
  }) => Promise<PlaylistSuggestionResult>
  cancel: () => Promise<void>
}
