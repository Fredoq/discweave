import { describe, expect, it, vi } from 'vitest'
import * as api from './catalogApi'
import { toReleaseTracklistRequest } from './api/catalogRequestMappers'
import * as h from './catalogApiTestHarness'
import type { TrackRecord } from '../tracks/tracksData'

h.setupCatalogApiAdapterTests()

describe('catalog API adapter tracklist requests', () => {
  it('rejects non-numeric track appearance positions before saving', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      api.createTrack({
        id: 'blue-monday',
        title: 'Blue Monday',
        artist: 'New Order',
        release: {
          id: '00000000-0000-7000-8000-000000000001',
          title: 'Blue Monday',
          artist: 'New Order',
          year: '1983',
          label: 'Factory',
        },
        trackNumber: 'A',
        duration: '7:29',
        relationHint: 'Appears on release.',
        tags: [],
        credits: [],
        releaseAppearances: [
          {
            releaseId: '00000000-0000-7000-8000-000000000001',
            releaseTitle: 'Blue Monday',
            releaseArtist: 'New Order',
            year: '1983',
            label: 'Factory',
            position: 'A',
            duration: '7:29',
          },
        ],
        relations: [],
        digitalFiles: [],
      }),
    ).rejects.toThrow(/positive number/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends existing track ids in release create tracklists', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      h.jsonResponse({
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Blue Monday Archive',
        type: 'single',
        year: 1983,
        genres: ['Synth-pop'],
        tags: [],
        labels: [],
        tracklist: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.createRelease(
      {
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Blue Monday Archive',
        artist: 'New Order',
        artistCredits: [
          {
            artistId: '00000000-0000-7000-8000-000000000001',
            artist: 'New Order',
            role: 'Main artist',
          },
        ],
        type: 'Single',
        year: '1983',
        label: 'Factory',
        labels: [],
        genres: ['Synth-pop'],
        tags: [],
        releaseNotes: '',
        ownedCopies: [],
      },
      [
        {
          id: '00000000-0000-7000-8000-000000000020',
          title: 'Blue Monday',
          artist: 'New Order',
          artistId: '00000000-0000-7000-8000-000000000001',
          release: {
            id: '00000000-0000-7000-8000-000000000010',
            title: 'Blue Monday Archive',
            artist: 'New Order',
            year: '1983',
            label: 'Factory',
          },
          trackNumber: '2',
          duration: '7:29',
          relationHint: '',
          tags: [],
          credits: [
            {
              artistId: '00000000-0000-7000-8000-000000000001',
              artist: 'New Order',
              role: 'Main artist',
              scope: '',
            },
          ],
          releaseAppearances: [
            {
              releaseId: '00000000-0000-7000-8000-000000000002',
              releaseTitle: 'Blue Monday',
              releaseArtist: 'New Order',
              year: '1983',
              label: 'Factory',
              position: 'A',
              duration: '7:29',
            },
            {
              releaseId: '00000000-0000-7000-8000-000000000010',
              releaseTitle: 'Blue Monday Archive',
              releaseArtist: 'New Order',
              year: '1983',
              label: 'Factory',
              position: '2',
              disc: 'CD 1',
              side: 'A',
              duration: '7:29',
            },
          ],
          relations: [],
          digitalFiles: [],
        },
      ],
    )

    const payload = h.releaseRequestPayload(fetchMock.mock.calls[0][1])

    expect(payload.tracklist).toHaveLength(1)
    const [tracklistRow] = payload.tracklist ?? []

    expect(tracklistRow).toMatchObject({
      trackId: '00000000-0000-7000-8000-000000000020',
      position: 2,
      disc: 'CD 1',
      side: 'A',
    })
    expect(tracklistRow).not.toHaveProperty('title')
    expect(tracklistRow).not.toHaveProperty('artistCredits')
  })

  it('does not copy disc or side markers from a linked track previous release', () => {
    const track: TrackRecord = {
      id: '00000000-0000-7000-8000-000000000020',
      title: 'Blue Monday',
      artist: 'New Order',
      artistId: '00000000-0000-7000-8000-000000000001',
      release: {
        id: '00000000-0000-7000-8000-000000000002',
        title: 'Blue Monday',
        artist: 'New Order',
        year: '1983',
        label: 'Factory',
      },
      trackNumber: '1',
      duration: '7:29',
      relationHint: '',
      tags: [],
      credits: [],
      releaseAppearances: [
        {
          releaseId: '00000000-0000-7000-8000-000000000002',
          releaseTitle: 'Blue Monday',
          releaseArtist: 'New Order',
          year: '1983',
          label: 'Factory',
          position: '1',
          disc: 'CD 1',
          side: 'A',
          duration: '7:29',
        },
        {
          releaseId: '00000000-0000-7000-8000-000000000010',
          releaseTitle: 'Blue Monday Archive',
          releaseArtist: 'New Order',
          year: '1983',
          label: 'Factory',
          position: '1',
          duration: '7:29',
        },
      ],
      relations: [],
      digitalFiles: [],
    }

    expect(
      toReleaseTracklistRequest(
        track,
        0,
        '00000000-0000-7000-8000-000000000010',
      ),
    ).toMatchObject({
      trackId: '00000000-0000-7000-8000-000000000020',
      position: 1,
      disc: null,
      side: null,
    })
  })

  it('uses row order fallback for unnumbered release tracklist rows', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      h.jsonResponse({
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Unnumbered Archive',
        type: 'single',
        year: 1983,
        genres: ['Synth-pop'],
        tags: [],
        labels: [],
        tracklist: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.createRelease(
      {
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Unnumbered Archive',
        artist: 'New Order',
        artistCredits: [
          {
            artistId: '00000000-0000-7000-8000-000000000001',
            artist: 'New Order',
            role: 'Main artist',
          },
        ],
        type: 'Single',
        year: '1983',
        label: 'Factory',
        labels: [],
        genres: ['Synth-pop'],
        tags: [],
        releaseNotes: '',
        ownedCopies: [],
      },
      [
        {
          id: '00000000-0000-7000-8000-000000000020',
          title: 'Blue Monday',
          artist: 'New Order',
          artistId: '00000000-0000-7000-8000-000000000001',
          release: {
            id: '00000000-0000-7000-8000-000000000010',
            title: 'Unnumbered Archive',
            artist: 'New Order',
            year: '1983',
            label: 'Factory',
          },
          trackNumber: 'Unnumbered',
          duration: '7:29',
          relationHint: '',
          tags: [],
          credits: [],
          releaseAppearances: [],
          relations: [],
          digitalFiles: [],
        },
      ],
    )

    const payload = h.releaseRequestPayload(fetchMock.mock.calls[0][1])

    expect(payload.tracklist?.[0]).toMatchObject({
      trackId: '00000000-0000-7000-8000-000000000020',
      position: 1,
    })
  })

  it('sends desired release tracklists when updating releases', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      h.jsonResponse({
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Blue Monday',
        type: 'single',
        year: 1983,
        genres: ['Synth-pop'],
        tags: [],
        labels: [],
        tracklist: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.updateRelease(
      {
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Blue Monday',
        artist: 'New Order',
        artistCredits: [
          {
            artistId: '00000000-0000-7000-8000-000000000001',
            artist: 'New Order',
            role: 'Main artist',
          },
        ],
        type: 'Single',
        year: '1983',
        label: 'Factory',
        labels: [],
        genres: ['Synth-pop'],
        tags: [],
        releaseNotes: '',
        ownedCopies: [],
      },
      [],
    )

    const payload = h.releaseRequestPayload(fetchMock.mock.calls[0][1])

    expect(payload.tracklist).toEqual([])
  })
})
