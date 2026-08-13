import { afterEach, describe, expect, it, vi } from 'vitest'
import * as h from '../../../test/appTestHarness'
import { CatalogApiError } from './httpClient'
import * as discoveryClient from './originalTrackDiscoveryClient'

const { listLocalOriginalCandidates } = discoveryClient

type ExternalFinder = (
  trackId: string,
  options: Readonly<{
    providerCodes?: readonly string[]
    searchMode?: 'releaseFirst' | 'deep'
    signal: AbortSignal
  }>,
) => Promise<unknown>

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('original track discovery client', () => {
  it('creates an external release draft with the narrow authoritative payload', async () => {
    const payload = {
      id: 'session-id',
      sourceKind: 'externalMetadata',
      sourceRoot: null,
      scanMode: null,
    }
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const createDraft = (
      discoveryClient as typeof discoveryClient & {
        createExternalReleaseDraft?: (
          request: unknown,
          options: Readonly<{ signal: AbortSignal }>,
        ) => Promise<unknown>
      }
    ).createExternalReleaseDraft

    expect(createDraft).toBeTypeOf('function')
    if (!createDraft) return

    await expect(
      createDraft(
        {
          sourceTrackId: 'source-track',
          recordingMbid: 'recording-mbid',
          musicBrainzRow: {
            releaseMbid: 'release-mbid',
            mediumPosition: '1',
            trackMbid: 'track-mbid',
          },
          reviewedRelationTypeCode: 'remixOf',
          idempotencyKey: 'idempotency-key',
        },
        { signal: controller.signal },
      ),
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/imports/external-release-drafts',
      {
        body: JSON.stringify({
          sourceTrackId: 'source-track',
          recordingMbid: 'recording-mbid',
          musicBrainzRow: {
            releaseMbid: 'release-mbid',
            mediumPosition: '1',
            trackMbid: 'track-mbid',
          },
          reviewedRelationTypeCode: 'remixOf',
          idempotencyKey: 'idempotency-key',
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      },
    )
  })

  it('posts the encoded external route with an empty default body and signal', async () => {
    const payload = {
      local: {
        sourceTrackId: 'track/id',
        hasReliableLocalCandidate: false,
        items: [],
      },
      items: [],
      providerStatuses: [],
      warnings: [],
    }
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const findExternal = (
      discoveryClient as typeof discoveryClient & {
        findExternalOriginalCandidates?: ExternalFinder
      }
    ).findExternalOriginalCandidates

    expect(findExternal).toBeTypeOf('function')
    if (!findExternal) return
    await expect(
      findExternal('track/id', { signal: controller.signal }),
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tracks/track%2Fid/original-candidates/external',
      {
        body: '{}',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      },
    )
  })

  it('posts only explicitly requested provider codes for retry', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      h.jsonResponse({
        local: {
          sourceTrackId: 'source-track',
          hasReliableLocalCandidate: false,
          items: [],
        },
        items: [],
        providerStatuses: [],
        warnings: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const findExternal = (
      discoveryClient as typeof discoveryClient & {
        findExternalOriginalCandidates?: ExternalFinder
      }
    ).findExternalOriginalCandidates

    expect(findExternal).toBeTypeOf('function')
    if (!findExternal) return
    await findExternal('source-track', {
      providerCodes: ['musicbrainz'],
      signal: new AbortController().signal,
    })
    const body = fetchMock.mock.calls[0][1]?.body
    expect(body).toBeTypeOf('string')
    if (typeof body !== 'string') return
    expect(JSON.parse(body)).toEqual({
      providerCodes: ['musicbrainz'],
    })
  })

  it('posts the requested release-first search mode', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      h.jsonResponse({
        local: {
          sourceTrackId: 'source-track',
          hasReliableLocalCandidate: false,
          items: [],
        },
        items: [],
        providerStatuses: [],
        warnings: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await discoveryClient.findExternalOriginalCandidates('source-track', {
      searchMode: 'releaseFirst',
      signal: new AbortController().signal,
    })

    const body = fetchMock.mock.calls[0][1]?.body
    expect(typeof body === 'string' ? JSON.parse(body) : body).toEqual({
      searchMode: 'releaseFirst',
    })
  })

  it('preserves the authoritative external conflict for hook classification', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'original_discovery.local_candidate_available',
            message: 'A reliable local original candidate is available',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 409,
          },
        ),
      ),
    )
    const findExternal = (
      discoveryClient as typeof discoveryClient & {
        findExternalOriginalCandidates: ExternalFinder
      }
    ).findExternalOriginalCandidates

    const error = await findExternal('source-track', {
      signal: new AbortController().signal,
    }).catch((value: unknown) => value)

    expect(error).toBeInstanceOf(CatalogApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'original_discovery.local_candidate_available',
      message: 'A reliable local original candidate is available',
    })
  })

  it('uses the exact encoded local discovery path and forwards cancellation', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      h.jsonResponse({
        sourceTrackId: 'track/id',
        hasReliableLocalCandidate: false,
        items: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await listLocalOriginalCandidates('track/id', {
      signal: controller.signal,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tracks/track%2Fid/original-candidates/local',
      {
        credentials: 'include',
        method: 'GET',
        signal: controller.signal,
      },
    )
  })

  it('preserves evidence channels and precision-aware nullable fields', async () => {
    const payload = {
      sourceTrackId: 'source-track',
      hasReliableLocalCandidate: true,
      items: [
        {
          candidateKey: 'candidate-key',
          localTrackId: 'local-track',
          title: 'Pulse',
          artistDisplay: 'Candidate Artist',
          durationSeconds: null,
          versionYear: null,
          origins: ['local'],
          confidence: 'high',
          selectable: true,
          isExistingRoot: true,
          memberCount: 2,
          requiresPromotion: false,
          suggestedRelationTypeCode: 'remixOf',
          earliestKnownDate: {
            value: '1982-03',
            precision: 'month',
            complete: false,
          },
          supportingEvidence: [
            { code: 'directedLineage', channel: 'musicBrainz' },
          ],
          contradictions: [{ code: 'laterChronology', channel: 'discogs' }],
          missingEvidence: [
            { code: 'missingDuration', channel: 'localCatalog' },
          ],
        },
      ],
    } as const
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockResolvedValue(h.jsonResponse(payload)),
    )

    const result = await listLocalOriginalCandidates('source-track', {
      signal: new AbortController().signal,
    })

    expect(result).toEqual(payload)
  })

  it.each([
    [404, 'track.not_found'],
    [409, 'original_discovery.source_not_eligible'],
    [503, 'catalog.temporarily_unavailable'],
  ])(
    'preserves structured HTTP %i failures as CatalogApiError',
    async (status, code) => {
      vi.stubGlobal(
        'fetch',
        vi.fn<Window['fetch']>().mockResolvedValue(
          new Response(JSON.stringify({ code, message: `Failure ${status}` }), {
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '17',
            },
            status,
          }),
        ),
      )

      const error = await listLocalOriginalCandidates('source-track', {
        signal: new AbortController().signal,
      }).catch((value: unknown) => value)

      expect(error).toBeInstanceOf(CatalogApiError)
      expect(error).toMatchObject({
        status,
        code,
        message: `Failure ${status}`,
        retryAfter: '17',
      })
    },
  )

  it('preserves network and abort failures for state-machine classification', async () => {
    const networkError = new TypeError('Network request failed')
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockRejectedValue(networkError),
    )

    await expect(
      listLocalOriginalCandidates('source-track', {
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(networkError)
  })
})
