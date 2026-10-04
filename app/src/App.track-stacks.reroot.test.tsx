import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import {
  listResponse,
  trackRelationResponse,
  trackResponse,
} from './test/trackStacksTestFixtures'

h.setupAppTestHooks()

describe('App track stack re-root', () => {
  it('sets a stack member as the new original from the expanded stack', async () => {
    window.history.pushState({}, '', '/tracks')
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url === '/api/track-relations/stack/original') {
        return h.jsonResponse(
          trackRelationResponse(
            'relation-new',
            'track-extended',
            'track-album',
            'versionOf',
          ),
        )
      }

      if (url.startsWith('/api/tracks/stacks')) {
        return listResponse([
          {
            originalTrackId: 'track-extended',
            originalTitle: 'Bounce (Extended Mix)',
            originalVersionYear: 2011,
            memberCount: 2,
            hasCycleIssue: false,
            members: [
              {
                trackId: 'track-album',
                title: 'Bounce',
                versionYear: 2012,
                relationType: 'versionOf',
                depth: 1,
                isDirect: true,
              },
              {
                trackId: 'track-radio',
                title: 'Bounce (Radio Edit)',
                versionYear: 2011,
                relationType: 'versionOf',
                depth: 1,
                isDirect: true,
              },
            ],
            issues: [],
          },
        ])
      }

      if (url.startsWith('/api/tracks?')) {
        return listResponse([
          trackResponse('track-extended', 'Bounce (Extended Mix)', true),
          trackResponse('track-album', 'Bounce'),
          trackResponse('track-radio', 'Bounce (Radio Edit)'),
        ])
      }

      if (url.startsWith('/api/track-relations?')) {
        return listResponse([
          trackRelationResponse(
            'relation-album',
            'track-album',
            'track-extended',
            'versionOf',
          ),
          trackRelationResponse(
            'relation-radio',
            'track-radio',
            'track-extended',
            'versionOf',
          ),
        ])
      }

      if (url.startsWith('/api/settings/dictionaries?')) {
        return h.defaultDictionaryListResponse()
      }

      if (url.startsWith('/api/rating-criteria?')) {
        return h.defaultRatingCriteriaListResponse()
      }

      return h.emptyCatalogListResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await h.screen.findByRole('heading', { name: 'Track records' })
    await user.click(
      h.screen.getAllByRole('button', { name: 'Expand stack' })[0],
    )
    const albumRow = h.screen
      .getByRole('button', { name: /^Bounce\b(?! \()/ })
      .closest('.track-stack-member-row') as HTMLElement
    await user.click(
      h.within(albumRow).getByRole('button', { name: 'Set as original' }),
    )
    const confirm = h.screen.getByRole('group', {
      name: 'Make Bounce the original',
    })
    expect(
      h.within(confirm).getByText(/Bounce \(Extended Mix\) becomes/),
    ).toBeInTheDocument()
    await user.click(
      h.within(confirm).getByRole('button', { name: 'Set as original' }),
    )

    await h.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/track-relations/stack/original',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            newOriginalTrackId: 'track-album',
            currentOriginalTrackId: 'track-extended',
            type: 'versionOf',
          }),
        }),
      ),
    )
  })
})
