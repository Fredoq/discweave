import { describe, expect, it } from 'vitest'
import catalogStyles from './catalog/catalog.css?raw'
import releaseTracklistStyles from './releases/release-tracklist.css?raw'
import trackStyles from './tracks/tracks.css?raw'

function selectorBlock(styles: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return styles.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'),
  )?.[1]
}

describe('native control style resets', () => {
  it('resets menu defaults for toolbar and tracklist containers', () => {
    expect(selectorBlock(catalogStyles, '.saved-views')).toMatch(
      /margin:\s*0;[\s\S]*padding:\s*0;[\s\S]*list-style:\s*none;/,
    )
    expect(
      selectorBlock(releaseTracklistStyles, '.release-tracklist-master'),
    ).toMatch(/margin:\s*0;[\s\S]*padding:\s*0;[\s\S]*list-style:\s*none;/)
  })

  it('resets fieldset defaults for duration controls', () => {
    for (const styles of [releaseTracklistStyles, trackStyles]) {
      expect(selectorBlock(styles, '.track-duration-control')).toMatch(
        /margin:\s*0;[\s\S]*padding:\s*0;[\s\S]*border:\s*0;[\s\S]*min-inline-size:\s*0;/,
      )
    }
  })
})
