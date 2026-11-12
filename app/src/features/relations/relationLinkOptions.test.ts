import { describe, expect, it } from 'vitest'
import { trackRelationLinkOptions } from './relationLinkOptions'

describe('track relationship options', () => {
  it('distinguishes titles using artist, release and version context', () => {
    const options = trackRelationLinkOptions([
      {
        id: 'a',
        title: 'Fire',
        artist: 'Alpha',
        release: { title: 'First' },
        versionYear: '2001',
      },
      {
        id: 'b',
        title: 'Fire',
        artist: 'Beta',
        release: { title: 'Second' },
        versionYear: '2002',
      },
    ])
    expect(options.map((option) => option.label)).toEqual([
      'Fire · Alpha · First · 2001',
      'Fire · Beta · Second · 2002',
    ])
    expect(options[0]).toMatchObject({ value: 'track:a', name: 'Fire' })
  })
  it('uses identifiers for incomplete or otherwise identical metadata', () => {
    const options = trackRelationLinkOptions([
      { id: 'a', title: 'Fire' },
      { id: 'b', title: 'Fire' },
      { id: 'c', title: 'Fire', artist: 'Alpha' },
      { id: 'd', title: 'Fire', artist: 'Alpha' },
    ])
    expect(options.map((option) => option.label)).toEqual([
      'Fire · a',
      'Fire · b',
      'Fire · Alpha · c',
      'Fire · Alpha · d',
    ])
  })
})
