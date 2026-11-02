import { describe, expect, it } from 'vitest'
import { appleMusicSearchUrl, safeDiscogsUrl } from './discoverApi'

describe('Recommendation external links', () => {
  it('allows only HTTPS Discogs links for the verified release identifier', () => {
    expect(
      safeDiscogsUrl('https://www.discogs.com/release/123-Artist-Title', '123'),
    ).toBe('https://www.discogs.com/release/123-Artist-Title')
    expect(safeDiscogsUrl('https://discogs.com/release/123', '123')).toBe(
      'https://discogs.com/release/123',
    )
    for (const url of [
      'javascript:alert(1)',
      'https://discogs.com.evil.test/release/123',
      'http://discogs.com/release/123',
      'https://discogs.com/release/1234',
      'https://discogs.com/master/123',
      'https://user:pass@discogs.com/release/123',
      'not a url',
    ]) {
      expect(safeDiscogsUrl(url, '123')).toBeNull()
    }
  })

  it('creates a safely encoded Apple Music search without inventing an album identifier', () => {
    const url = new URL(
      appleMusicSearchUrl(['Artist & guest'], 'Title / remix?'),
    )
    expect(url.origin).toBe('https://music.apple.com')
    expect(url.pathname).toBe('/search')
    expect(url.searchParams.get('term')).toBe('Artist & guest Title / remix?')
  })
})
