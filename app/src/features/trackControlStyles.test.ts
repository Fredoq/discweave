import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const catalogStyles = readFileSync(
  resolve(process.cwd(), 'src/features/catalog/catalog.css'),
  'utf8',
)
const releaseTracklistStyles = readFileSync(
  resolve(process.cwd(), 'src/features/releases/release-tracklist.css'),
  'utf8',
)
const trackStyles = readFileSync(
  resolve(process.cwd(), 'src/features/tracks/tracks.css'),
  'utf8',
)

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
