import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App deletion and link cleanup', () => {
  it('deletes a manual artist only after confirmation and clears the selected detail and catalog row', async () => {
    window.history.pushState({}, '', '/artists')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.addManualArtist(user, 'Delete Session Artist')

    expect(
      h.screen.getByRole('complementary', { name: 'Delete Session Artist' }),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Delete record' }))

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete this artist and remove their credits and relations?',
    )
    expect(
      h.screen.getByRole('button', { name: /delete session artist/i }),
    ).toBeVisible()

    confirmSpy.mockReturnValue(true)

    await user.click(h.screen.getByRole('button', { name: 'Delete record' }))

    expect(
      h.screen.queryByRole('button', { name: /delete session artist/i }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('complementary', { name: 'Delete Session Artist' }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Catalog' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search collection' }),
      'Delete Session Artist',
    )

    expect(h.screen.getByText('0 shown')).toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('recovers the workspace query parameter after deleting the selected manual record', async () => {
    window.history.pushState({}, '', '/artists')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.addManualArtist(user, 'Query Recovery Artist')

    expect(new URLSearchParams(window.location.search).get('artist')).toMatch(
      /^manual-artist-query-recovery-artist-/,
    )

    await user.click(h.screen.getByRole('button', { name: 'Delete record' }))

    expect(
      new URLSearchParams(window.location.search).get('artist'),
    ).not.toMatch(/^manual-artist-query-recovery-artist-/)
    expect(
      h.screen.queryByRole('button', { name: /query recovery artist/i }),
    ).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('deleting a linked manual release downgrades dependent references and updates backlinks', async () => {
    window.history.pushState({}, '', '/releases')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    let form = h.screen.getByRole('form', { name: 'Add release' })
    await user.type(h.within(form).getByLabelText('Title'), 'Delete Linked EP')
    await h.addReleaseArtist(user, form, 'Delete Link Artist')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await h.addReleaseTrackRow(user, form, 'Delete Linked Track')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    await user.click(h.screen.getByRole('link', { name: 'Relations' }))
    await user.click(h.screen.getByRole('button', { name: 'Add relation' }))
    form = h.screen.getByRole('form', { name: 'Add relation' })
    await user.type(h.within(form).getByLabelText('Source'), 'Free Source')
    await h.selectVisibleOption(
      user,
      h.within(form).getByLabelText('Existing target'),
      'Release: Delete Linked EP',
    )
    await h.selectVisibleOption(
      user,
      h.within(form).getByLabelText('Existing linked entity'),
      'Track: Delete Linked Track',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    await user.click(h.screen.getByRole('link', { name: 'Releases' }))
    await user.click(
      h.screen.getByRole('button', { name: /delete linked ep/i }),
    )

    expect(
      h
        .within(
          h.detailSection(
            h.screen.getByRole('complementary', { name: 'Delete Linked EP' }),
            'Tracks',
          ),
        )
        .getByRole('link', { name: 'Delete Linked Track' }),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Delete record' }))

    expect(
      h.screen.queryByRole('row', { name: /delete linked ep/i }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.click(
      h.screen.getByRole('button', { name: /delete linked track/i }),
    )

    const trackPanel = h.screen.getByRole('complementary', {
      name: 'Delete Linked Track',
    })
    const linkedRelease = h.detailSection(trackPanel, 'Release appearances')

    expect(h.within(linkedRelease).getByText('Delete Linked EP')).toBeVisible()
    expect(
      h.within(linkedRelease).queryByRole('link', { name: 'Delete Linked EP' }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Relations' }))
    await user.click(
      h.screen.getByRole('button', { name: /free source delete linked ep/i }),
    )

    const relationPanel = h.screen.getByRole('complementary', {
      name: 'Free Source to Delete Linked EP',
    })

    expect(
      h
        .within(h.detailSection(relationPanel, 'Endpoints'))
        .queryByRole('link', {
          name: 'Delete Linked EP',
        }),
    ).not.toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(relationPanel, 'Linked evidence'))
        .getByRole('link', { name: 'Delete Linked Track' }),
    ).toHaveAttribute('href', expect.stringContaining('/tracks?track=manual-'))

    confirmSpy.mockRestore()
  })

  it('deleting a linked manual track downgrades relation evidence immediately', async () => {
    window.history.pushState({}, '', '/tracks')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    let form = h.screen.getByRole('form', { name: 'Add track' })
    await user.type(h.within(form).getByLabelText('Title'), 'Evidence Track')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    await user.click(h.screen.getByRole('link', { name: 'Relations' }))
    await user.click(h.screen.getByRole('button', { name: 'Add relation' }))
    form = h.screen.getByRole('form', { name: 'Add relation' })
    await user.type(h.within(form).getByLabelText('Source'), 'Evidence Source')
    await user.type(h.within(form).getByLabelText('Target'), 'Evidence Target')
    await h.selectVisibleOption(
      user,
      h.within(form).getByLabelText('Existing linked entity'),
      'Track: Evidence Track',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(
      h
        .within(
          h.detailSection(
            h.screen.getByRole('complementary', {
              name: 'Evidence Source to Evidence Target',
            }),
            'Linked evidence',
          ),
        )
        .getByRole('link', { name: 'Evidence Track' }),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.click(h.screen.getByRole('button', { name: /evidence track/i }))
    await user.click(h.screen.getByRole('button', { name: 'Delete record' }))

    await user.click(h.screen.getByRole('link', { name: 'Relations' }))
    await user.click(
      h.screen.getByRole('button', {
        name: /evidence source evidence target/i,
      }),
    )

    const linkedEvidence = h.detailSection(
      h.screen.getByRole('complementary', {
        name: 'Evidence Source to Evidence Target',
      }),
      'Linked evidence',
    )

    expect(h.within(linkedEvidence).getByText('Evidence Track')).toBeVisible()
    expect(
      h.within(linkedEvidence).queryByRole('link', { name: 'Evidence Track' }),
    ).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('clearing relation existing-record selects prevents stale linked ids', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add relation' }))
    const form = h.screen.getByRole('form', { name: 'Add relation' })

    await user.selectOptions(
      h.within(form).getByLabelText('Existing source'),
      'artist:aphex-twin',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing target'),
      'release:selected-ambient-works-85-92',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing linked entity'),
      'track:polynomial-c',
    )

    expect(h.within(form).getByLabelText('Source')).toBeDisabled()
    expect(h.within(form).getByLabelText('Target')).toBeDisabled()
    expect(h.within(form).getByLabelText('Linked entity')).toBeDisabled()

    await user.selectOptions(
      h.within(form).getByLabelText('Existing source'),
      '',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing target'),
      '',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing linked entity'),
      '',
    )
    await user.type(h.within(form).getByLabelText('Source'), 'Plain Source')
    await user.type(h.within(form).getByLabelText('Target'), 'Plain Target')
    await user.type(
      h.within(form).getByLabelText('Linked entity'),
      'Plain Evidence',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Plain Source to Plain Target',
    })

    expect(
      h.within(h.detailSection(detailPanel, 'Endpoints')).queryByRole('link', {
        name: 'Aphex Twin',
      }),
    ).not.toBeInTheDocument()
    expect(
      h.within(h.detailSection(detailPanel, 'Endpoints')).queryByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).not.toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Linked evidence'))
        .queryByRole('link', {
          name: 'Polynomial-C',
        }),
    ).not.toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Linked evidence'))
        .getByText('Plain Evidence'),
    ).toBeVisible()
  })

  it('deleting a manual relation downgrades relation-backed links immediately', async () => {
    window.history.pushState({}, '', '/relations')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add relation' }))
    let form = h.screen.getByRole('form', { name: 'Add relation' })
    await user.type(
      h.within(form).getByLabelText('Source'),
      'Referenced Source',
    )
    await user.type(
      h.within(form).getByLabelText('Target'),
      'Referenced Target',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    await user.click(h.screen.getByRole('button', { name: 'Add relation' }))
    form = h.screen.getByRole('form', { name: 'Add relation' })
    await h.selectVisibleOption(
      user,
      h.within(form).getByLabelText('Existing source'),
      'Relation: Referenced Source to Referenced Target',
    )
    await h.selectVisibleOption(
      user,
      h.within(form).getByLabelText('Existing target'),
      'Relation: Referenced Source to Referenced Target',
    )
    await h.selectVisibleOption(
      user,
      h.within(form).getByLabelText('Existing linked entity'),
      'Relation: Referenced Source to Referenced Target',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    const dependentRelationName =
      'Referenced Source to Referenced Target to Referenced Source to Referenced Target'
    const dependentPanel = h.screen.getByRole('complementary', {
      name: dependentRelationName,
    })

    expect(
      h
        .within(h.detailSection(dependentPanel, 'Endpoints'))
        .getAllByRole('link', {
          name: 'Referenced Source to Referenced Target',
        }),
    ).toHaveLength(2)
    expect(
      h
        .within(h.detailSection(dependentPanel, 'Linked evidence'))
        .getByRole('link', { name: 'Referenced Source to Referenced Target' }),
    ).toBeInTheDocument()

    await user.click(
      h.screen.getByRole('button', {
        name: /^Referenced Source Referenced Target$/,
      }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Delete record' }))
    await user.click(
      h.screen.getByRole('button', {
        name: /^Referenced Source to Referenced Target Referenced Source to Referenced Target$/,
      }),
    )

    const updatedPanel = h.screen.getByRole('complementary', {
      name: dependentRelationName,
    })
    const endpoints = h.detailSection(updatedPanel, 'Endpoints')
    const linkedEvidence = h.detailSection(updatedPanel, 'Linked evidence')

    expect(
      h.within(endpoints).queryByRole('link', {
        name: 'Referenced Source to Referenced Target',
      }),
    ).not.toBeInTheDocument()
    expect(
      h.within(linkedEvidence).queryByRole('link', {
        name: 'Referenced Source to Referenced Target',
      }),
    ).not.toBeInTheDocument()
    expect(
      h
        .within(endpoints)
        .getAllByText('Referenced Source to Referenced Target'),
    ).toHaveLength(2)
    expect(
      h
        .within(linkedEvidence)
        .getByText('Referenced Source to Referenced Target'),
    ).toBeVisible()

    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))

    const editForm = h.screen.getByRole('form', { name: 'Edit relation' })

    expect(h.within(editForm).getByLabelText('Existing source')).toHaveValue('')
    expect(h.within(editForm).getByLabelText('Existing target')).toHaveValue('')
    expect(
      h.within(editForm).getByLabelText('Existing linked entity'),
    ).toHaveValue('')
    expect(h.within(editForm).getByLabelText('Source')).toBeEnabled()
    expect(h.within(editForm).getByLabelText('Source')).toHaveValue(
      'Referenced Source to Referenced Target',
    )
    expect(h.within(editForm).getByLabelText('Target')).toBeEnabled()
    expect(h.within(editForm).getByLabelText('Target')).toHaveValue(
      'Referenced Source to Referenced Target',
    )
    expect(h.within(editForm).getByLabelText('Linked entity')).toBeEnabled()
    expect(h.within(editForm).getByLabelText('Linked entity')).toHaveValue(
      'Referenced Source to Referenced Target',
    )

    confirmSpy.mockRestore()
  })
})
