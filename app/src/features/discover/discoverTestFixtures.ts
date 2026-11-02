import { vi } from 'vitest'
import type {
  DiscoverBridge,
  DiscoverRelease,
  DiscoverStatus,
} from './discoverTypes'

export function testDiscoverStatus(
  patch: Partial<DiscoverStatus> = {},
): DiscoverStatus {
  return {
    configured: true,
    storage: 'secure',
    model: 'gpt-6-luna',
    consented: true,
    limits: { requestsPerHour: 6, maxOutputTokens: 2000, timeoutSeconds: 180 },
    ...patch,
  }
}

export function testDiscoverRelease(externalId = '123'): DiscoverRelease {
  return {
    externalId,
    title: `Verified release ${externalId}`,
    artists: ['Test Artist'],
    year: 2001,
    labels: ['Test Label'],
    genres: ['Electronic'],
    formats: ['Vinyl'],
    sourceUrl: `https://www.discogs.com/release/${externalId}`,
    attribution: 'Data provided by Discogs.',
    reason: 'Shares an artist with a positively rated release.',
    appleMusicSearchUrl: 'https://music.apple.com/search?term=test',
  }
}

export function installDiscoverBridge(patch: Partial<DiscoverBridge> = {}) {
  const bridge: DiscoverBridge = {
    status: vi.fn().mockResolvedValue(testDiscoverStatus()),
    save: vi.fn().mockResolvedValue(testDiscoverStatus()),
    remove: vi
      .fn()
      .mockResolvedValue(
        testDiscoverStatus({ configured: false, consented: false }),
      ),
    test: vi
      .fn()
      .mockResolvedValue({ ok: true, message: 'Connection verified.' }),
    generate: vi.fn().mockResolvedValue({
      items: [testDiscoverRelease()],
      message: '1 eligible release found.',
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    ...patch,
  }
  Object.defineProperty(window, 'discweaveDesktop', {
    configurable: true,
    value: { isDesktop: true, discover: bridge },
  })
  return bridge
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
