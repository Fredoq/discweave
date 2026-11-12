import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'
import type { RelationRecord } from './features/relations/relationsData'

h.setupAppTestHooks()

function seedLegacyRelations(relations: RelationRecord[]) {
  const state = h.getInitialCatalogStateForTests()!
  h.seedCatalogForTests({
    ...state,
    relations: [...state.relations, ...relations],
  })
}

function legacyRelation(overrides: Partial<RelationRecord>): RelationRecord {
  return {
    ...h.relationRecords[0],
    id: 'manual-legacy-relation',
    source: 'Free Source',
    sourceLink: undefined,
    targetLink: undefined,
    linkedEntityLink: undefined,
    ...overrides,
  }
}

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

    await user.click(h.screen.getByLabelText('More artist actions'))
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

    await user.click(h.screen.getByRole('link', { name: 'Search' }))
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

    await user.click(h.screen.getByLabelText('More artist actions'))
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
    const view = h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })
    await user.type(h.within(form).getByLabelText('Title'), 'Delete Linked EP')
    await h.addReleaseArtist(user, form, 'Delete Link Artist')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await h.addReleaseTrackRow(user, form, 'Delete Linked Track')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    const state = h.getInitialCatalogStateForTests()!
    const release = state.releases.find(
      (record) => record.title === 'Delete Linked EP',
    )!
    const track = state.tracks.find(
      (record) => record.title === 'Delete Linked Track',
    )!
    view.unmount()
    seedLegacyRelations([
      legacyRelation({
        target: release.title,
        targetLink: { kind: 'release', id: release.id },
        linkedEntity: track.title,
        linkedEntityLink: { kind: 'track', id: track.id },
        linkedEntityType: 'Track',
      }),
    ])
    h.render(<h.App />)

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
    const view = h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    const form = h.screen.getByRole('form', { name: 'Add track' })
    await user.type(h.within(form).getByLabelText('Title'), 'Evidence Track')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    const track = h
      .getInitialCatalogStateForTests()!
      .tracks.find((record) => record.title === 'Evidence Track')!
    view.unmount()
    seedLegacyRelations([
      legacyRelation({
        source: 'Evidence Source',
        target: 'Evidence Target',
        linkedEntity: track.title,
        linkedEntityLink: { kind: 'track', id: track.id },
        linkedEntityType: 'Track',
      }),
    ])
    window.history.pushState(
      {},
      '',
      '/relations?relation=manual-legacy-relation',
    )
    h.render(<h.App />)

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

  it('clearing relation source prevents saving stale endpoint ids', async () => {
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
      'artist:new-order',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing source'),
      '',
    )
    expect(h.within(form).getByLabelText('Existing target')).toHaveValue('')
    expect(h.within(form).getByLabelText('Existing target')).toBeDisabled()
    expect(
      h.within(form).getByRole('button', { name: 'Add record' }),
    ).toBeDisabled()
    expect(
      h.within(form).queryByLabelText('Linked entity'),
    ).not.toBeInTheDocument()
  })

  it('deleting a manual relation downgrades relation-backed links immediately', async () => {
    window.history.pushState({}, '', '/relations')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = h.userEvent.setup()
    const referenced = legacyRelation({
      id: 'manual-referenced',
      source: 'Referenced Source',
      target: 'Referenced Target',
    })
    const label = 'Referenced Source to Referenced Target'
    const dependentRelationName = `${label} to ${label}`
    seedLegacyRelations([
      referenced,
      legacyRelation({
        id: 'manual-dependent',
        source: label,
        target: label,
        linkedEntity: label,
        sourceLink: { kind: 'relation', id: referenced.id },
        targetLink: { kind: 'relation', id: referenced.id },
        linkedEntityLink: { kind: 'relation', id: referenced.id },
        linkedEntityType: 'Relation',
      }),
    ])
    window.history.pushState({}, '', '/relations?relation=manual-dependent')
    h.render(<h.App />)

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

    expect(
      h.within(editForm).getByRole('button', { name: 'Save record' }),
    ).toBeDisabled()
    expect(
      h
        .within(editForm)
        .getByText(/This legacy relation cannot be edited here/),
    ).toBeVisible()
    expect(
      h.within(editForm).queryByLabelText('Linked entity'),
    ).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })
})
