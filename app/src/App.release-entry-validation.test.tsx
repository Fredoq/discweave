import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App release entry validation and navigation', () => {
  it('validates tracklist duration as MM:SS or H:MM:SS', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Duration Rules EP')
    await h.addReleaseArtist(user, form, 'Duration Artist')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(h.within(form).getByLabelText('Track title'), 'Long Mix')
    expect(
      h.within(form).getByRole('group', { name: 'Track duration' }),
    ).toBeInTheDocument()
    expect(
      h.within(form).queryByRole('spinbutton', { name: 'Track duration' }),
    ).not.toBeInTheDocument()
    await user.clear(h.within(form).getByLabelText('Track duration minutes'))
    await user.type(
      h.within(form).getByLabelText('Track duration minutes'),
      '999',
    )

    expect(h.within(form).getByLabelText('Track duration minutes')).toHaveValue(
      59,
    )
    expect(h.screen.getByRole('button', { name: 'Add record' })).toBeEnabled()

    await user.clear(h.within(form).getByLabelText('Track duration hours'))
    await user.type(h.within(form).getByLabelText('Track duration hours'), '1')
    await user.clear(h.within(form).getByLabelText('Track duration minutes'))
    await user.type(
      h.within(form).getByLabelText('Track duration minutes'),
      '2',
    )
    await user.clear(h.within(form).getByLabelText('Track duration seconds'))
    await user.type(
      h.within(form).getByLabelText('Track duration seconds'),
      '33',
    )

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Long Mix',
    )

    expect(
      h.screen.getByRole('listitem', { name: /long mix/i }),
    ).toHaveTextContent('1:02:33')
  })

  it('shows manually selected digital collection items as Digital until a file format is recorded', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Digital Copy Shell',
    )
    await h.addReleaseArtist(user, form, 'Digital Copy Artist')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await h.addReleaseTrackRow(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Item' }))
    await user.selectOptions(
      h.within(form).getByLabelText('Collection item 1 medium'),
      'Digital',
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Digital Copy Shell',
    })

    expect(
      h.within(detailPanel).getAllByText('Digital').length,
    ).toBeGreaterThan(0)
    expect(h.within(detailPanel).queryByText('FLAC')).not.toBeInTheDocument()
  })

  it('uses SPA detail links so manual in-memory records survive cross-workspace navigation', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'One Session Link')
    await h.addReleaseArtist(user, form, 'One Session Artist')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(
      h.within(form).getByLabelText('Track title'),
      'One Session Track',
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const releasePanel = h.screen.getByRole('complementary', {
      name: 'One Session Link',
    })

    await user.click(
      h.within(h.detailSection(releasePanel, 'Tracks')).getByRole('link', {
        name: 'One Session Track',
      }),
    )

    const trackPanel = h.screen.getByRole('complementary', {
      name: 'One Session Track',
    })

    await user.click(
      h
        .within(h.detailSection(trackPanel, 'Release appearances'))
        .getByRole('link', {
          name: 'One Session Link',
        }),
    )

    expect(
      h.within(h.screen.getByRole('banner')).getByRole('heading', {
        name: 'Releases',
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('complementary', { name: 'One Session Link' }),
    ).toBeInTheDocument()
  })

  it('blocks release submit when a non-empty draft track row has no title', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Invalid Draft Track Release',
    )
    await h.addReleaseArtist(user, form, 'Invalid Draft Artist')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.clear(h.within(form).getByLabelText('Track duration minutes'))
    await user.type(
      h.within(form).getByLabelText('Track duration minutes'),
      '3',
    )
    await user.clear(h.within(form).getByLabelText('Track duration seconds'))
    await user.type(
      h.within(form).getByLabelText('Track duration seconds'),
      '33',
    )

    expect(h.screen.getByRole('button', { name: 'Add record' })).toBeDisabled()
    expect(
      h
        .within(form)
        .getByText('Tracklist rows with metadata need a track title.'),
    ).toBeInTheDocument()
  })

  it('does not add a release or draft tracks when release entry is canceled', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Canceled Release Shell',
    )
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(
      h.within(form).getByLabelText('Track title'),
      'Canceled Draft Track',
    )
    await user.click(h.screen.getByRole('button', { name: 'Cancel' }))

    expect(
      h.screen.queryByRole('row', { name: /canceled release shell/i }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Canceled Draft Track',
    )

    expect(h.screen.getByText('0 shown')).toBeInTheDocument()
  })
})
