export type DiscoverMode = 'familiar' | 'adventurous'
export type DiscoverFeedback = 'notInterested' | 'alreadyKnow'

export type DiscoverRelease = {
  externalId: string
  title: string
  artists: string[]
  year: number | null
  labels: string[]
  genres: string[]
  formats: string[]
  sourceUrl: string
  attribution: string
  reason: string
  appleMusicSearchUrl: string
}

export type DiscoverResult = {
  items: DiscoverRelease[]
  message: string
}

export type DiscoverStatus = {
  configured: boolean
  storage: 'secure' | 'session' | 'unavailable'
  model: string
  consented: boolean
  limits: {
    requestsPerHour: number
    maxOutputTokens: number
    timeoutSeconds: number
  }
}

export type DiscoverRequest = {
  mode: DiscoverMode
  releaseId?: string
  trackId?: string
}

export type DiscoverBridge = {
  status: () => Promise<DiscoverStatus>
  save: (request: {
    apiKey: string
    model: string
    consented: boolean
  }) => Promise<DiscoverStatus>
  remove: () => Promise<DiscoverStatus>
  test: () => Promise<{ ok: boolean; message: string }>
  generate: (request: DiscoverRequest) => Promise<DiscoverResult>
  cancel: () => Promise<void>
}
