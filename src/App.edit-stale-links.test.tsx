import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App edit stale link handling', () => {
  it('warns about likely duplicates during edit without blocking save', async () => {
    window.history.pushState({}, '', '/artists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.addManualArtist(user, 'Duplicate Anchor Artist')
    await h.addManualArtist(user, 'Duplicate Candidate Artist')

    await user.click(
      h.screen.getByRole('button', { name: /duplicate candidate artist/i }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    const form = h.screen.getByRole('form', { name: 'Edit artist' })
    await user.clear(h.within(form).getByLabelText('Name'))
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Duplicate Anchor Artist',
    )

    expect(
      h
        .within(form)
        .getByText(/Likely duplicate artist: Duplicate Anchor Artist/i),
    ).toBeVisible()
    expect(
      h.within(form).getByRole('button', { name: 'Save record' }),
    ).toBeEnabled()

    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    expect(
      h.screen.getAllByRole('row', { name: /duplicate anchor artist/i }),
    ).toHaveLength(2)
  })

  it('clearing an existing-record select prevents stale linked ids and keeps free text plain', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add owned item' }))
    let form = h.screen.getByRole('form', { name: 'Add owned item' })
    await user.type(
      h.within(form).getByLabelText('Item name'),
      'Loose Sleeve Copy',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing release'),
      'selected-ambient-works-85-92',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))
    await user.click(
      await h.screen.findByRole('button', { name: /loose sleeve copy/i }),
    )

    expect(
      h
        .within(
          h.detailSection(
            h.screen.getByRole('complementary', { name: 'Loose Sleeve Copy' }),
            'Linked catalog item',
          ),
        )
        .getByRole('link', { name: 'Selected Ambient Works 85-92' }),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    form = h.screen.getByRole('form', { name: 'Edit owned item' })
    await user.selectOptions(
      h.within(form).getByLabelText('Existing release'),
      '',
    )
    await user.type(
      h.within(form).getByLabelText('Linked release'),
      'Unfiled Sleeve Box',
    )
    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    const linkedSection = h.detailSection(
      h.screen.getByRole('complementary', { name: 'Loose Sleeve Copy' }),
      'Linked catalog item',
    )

    expect(
      h.within(linkedSection).getByText('Unfiled Sleeve Box'),
    ).toBeVisible()
    expect(
      h
        .within(linkedSection)
        .queryByRole('link', { name: 'Unfiled Sleeve Box' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(linkedSection).queryByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).not.toBeInTheDocument()
  })

  it('preserves existing draft track fields when editing a manual track', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const releaseForm = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(releaseForm).getByLabelText('Title'),
      'Numbered Draft Source',
    )
    await h.addReleaseArtist(user, releaseForm, 'Numbered Draft Artist')
    await h.addReleaseLabel(user, releaseForm)
    await h.selectReleaseGenre(user, releaseForm)
    await user.click(
      h.within(releaseForm).getByRole('button', { name: '+ Track' }),
    )
    await user.type(
      h.within(releaseForm).getByLabelText('Track title'),
      'Numbered Draft Track',
    )
    await user.click(
      h.within(releaseForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.click(
      h.screen.getByRole('button', { name: /numbered draft track/i }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))

    const trackForm = h.screen.getByRole('form', { name: 'Edit track' })
    await user.clear(h.within(trackForm).getByLabelText('Title'))
    await user.type(
      h.within(trackForm).getByLabelText('Title'),
      'Numbered Draft Track Edited',
    )
    await user.click(
      h.within(trackForm).getByRole('button', { name: 'Save record' }),
    )

    expect(
      h.screen.getByRole('row', {
        name: /numbered draft track edited/i,
      }),
    ).toBeVisible()
    expect(
      h
        .within(
          h.detailSection(
            h.screen.getByRole('complementary', {
              name: 'Numbered Draft Track Edited',
            }),
            'Release appearances',
          ),
        )
        .getByRole('link', { name: 'Numbered Draft Source' }),
    ).toBeInTheDocument()
  })

  it('does not rewrite unrelated relation free text when a manual release with the same title is edited', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add relation' }))
    const relationForm = h.screen.getByRole('form', { name: 'Add relation' })

    await user.type(
      h.within(relationForm).getByLabelText('Source'),
      'Free Source',
    )
    await user.type(
      h.within(relationForm).getByLabelText('Target'),
      'Free Target',
    )
    await user.type(
      h.within(relationForm).getByLabelText('Linked entity'),
      'Shared Title',
    )
    await user.click(
      h.within(relationForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(h.screen.getByRole('link', { name: 'Releases' }))
    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    let releaseForm = h.screen.getByRole('form', { name: 'Add release' })
    await user.type(
      h.within(releaseForm).getByLabelText('Title'),
      'Shared Title',
    )
    await h.addReleaseArtist(user, releaseForm, 'First Artist')
    await h.addReleaseLabel(user, releaseForm)
    await h.selectReleaseGenre(user, releaseForm)
    await h.addReleaseTrackRow(user, releaseForm)
    await user.click(
      h.within(releaseForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    releaseForm = h.screen.getByRole('form', { name: 'Add release' })
    await user.type(
      h.within(releaseForm).getByLabelText('Title'),
      'Shared Title',
    )
    await h.addReleaseArtist(user, releaseForm, 'Second Artist')
    await h.addReleaseLabel(user, releaseForm)
    await h.selectReleaseGenre(user, releaseForm)
    await h.addReleaseTrackRow(user, releaseForm)
    await user.click(
      h.within(releaseForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    releaseForm = h.screen.getByRole('form', { name: 'Edit release' })
    await user.clear(h.within(releaseForm).getByLabelText('Title'))
    await user.type(
      h.within(releaseForm).getByLabelText('Title'),
      'Renamed Shared Title',
    )
    await user.click(
      h.within(releaseForm).getByRole('button', { name: 'Save record' }),
    )

    await user.click(h.screen.getByRole('link', { name: 'Relations' }))
    await user.click(
      h.screen.getByRole('button', { name: /free source free target/i }),
    )

    const linkedEvidence = h.detailSection(
      h.screen.getByRole('complementary', {
        name: 'Free Source to Free Target',
      }),
      'Linked evidence',
    )

    expect(
      h.within(linkedEvidence).getByText('Shared Title'),
    ).toBeInTheDocument()
    expect(
      h.within(linkedEvidence).queryByText('Renamed Shared Title'),
    ).not.toBeInTheDocument()
  })

  it('allows duplicate-titled manual tracks in one session', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    let form = h.screen.getByRole('form', { name: 'Add track' })
    await user.type(h.within(form).getByLabelText('Title'), 'Same Title')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    form = h.screen.getByRole('form', { name: 'Add track' })
    await user.type(h.within(form).getByLabelText('Title'), 'Same Title')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(h.screen.getAllByRole('row', { name: /same title/i })).toHaveLength(
      2,
    )
  })
})
