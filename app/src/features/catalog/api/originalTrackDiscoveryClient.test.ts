import { afterEach, describe, expect, it, vi } from 'vitest'
import * as h from '../../../test/appTestHarness'
import { CatalogApiError } from './httpClient'
import { listLocalOriginalCandidates } from './originalTrackDiscoveryClient'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('original track discovery client', () => {
  it('uses the exact encoded local discovery path and forwards cancellation', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(
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
          contradictions: [
            { code: 'laterChronology', channel: 'discogs' },
          ],
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
        vi
          .fn<Window['fetch']>()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ code, message: `Failure ${status}` }),
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Retry-After': '17',
                },
                status,
              },
            ),
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
