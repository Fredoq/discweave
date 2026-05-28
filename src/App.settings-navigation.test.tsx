import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App settings and navigation', () => {
  it('renders the settings workspace with dictionary rows and selected detail', () => {
    window.history.pushState({}, '', '/settings')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Settings workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search settings' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', {
        name: /unknownrelease types unknown 0 active/i,
      }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', {
        name: /albumrelease types album 10 active/i,
      }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('complementary', { name: 'Unknown' }),
    ).toBeInTheDocument()
  })

  it('filters dictionary settings by kind, name, code, status and media profile', async () => {
    window.history.pushState({}, '', '/settings')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.selectOptions(h.screen.getByLabelText('Dictionary'), 'genre')
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search settings' }),
      'ambient active',
    )

    expect(
      h.screen.getByRole('row', { name: /ambientgenres ambient 10 active/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /electronicgenres/i }),
    ).not.toBeInTheDocument()

    await user.clear(
      h.screen.getByRole('searchbox', { name: 'Search settings' }),
    )
    await user.selectOptions(h.screen.getByLabelText('Dictionary'), 'mediaType')
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search settings' }),
      'digital builtin',
    )

    expect(
      h.screen.getByRole('row', {
        name: /digitalmedia types digital 10 active/i,
      }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /vinylmedia types/i }),
    ).not.toBeInTheDocument()
  })

  it('updates dictionary detail when an entry row is selected and saved', async () => {
    window.history.pushState({}, '', '/settings')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h
        .within(
          h.screen.getByRole('row', {
            name: /albumrelease types album 10 active/i,
          }),
        )
        .getByRole('button'),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Album',
    })
    await user.clear(h.within(detailPanel).getByLabelText('Name'))
    await user.type(h.within(detailPanel).getByLabelText('Name'), 'Long player')
    await user.clear(h.within(detailPanel).getByLabelText('Order'))
    await user.type(h.within(detailPanel).getByLabelText('Order'), '11')
    await user.click(
      h.within(detailPanel).getByRole('button', { name: 'Save' }),
    )

    expect(
      await h.screen.findByRole('row', {
        name: /long playerrelease types album 11 active/i,
      }),
    ).toBeVisible()
  })

  it('shows all required dictionary editor controls', () => {
    window.history.pushState({}, '', '/settings')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Unknown',
    })

    expect(
      h.screen.getByLabelText('Dictionary entry editor'),
    ).toBeInTheDocument()
    expect(
      h.screen.getByLabelText('Dictionary entry removal'),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getByLabelText('Name')).toBeInTheDocument()
    expect(h.within(detailPanel).getByLabelText('Order')).toBeInTheDocument()
    expect(h.within(detailPanel).getByLabelText('Active')).toBeDisabled()
    expect(
      h.within(detailPanel).getByRole('button', { name: 'Save' }),
    ).toBeEnabled()
    expect(
      h.within(detailPanel).getByRole('button', { name: 'Delete' }),
    ).toBeDisabled()
    expect(h.within(detailPanel).getByLabelText('Replacement')).toBeDisabled()
    expect(
      h.within(detailPanel).getByRole('button', { name: 'Replace usages' }),
    ).toBeDisabled()
  })

  it('creates dictionary entries from the settings workspace', async () => {
    window.history.pushState({}, '', '/settings')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.selectOptions(h.screen.getByLabelText('Dictionary'), 'genre')
    const addPanel = h.screen.getByRole('region', {
      name: 'Add dictionary entry',
    })
    await user.type(h.within(addPanel).getByLabelText('Code'), 'dub')
    await user.type(h.within(addPanel).getByLabelText('Name'), 'Dub')
    await user.clear(h.within(addPanel).getByLabelText('Order'))
    await user.type(h.within(addPanel).getByLabelText('Order'), '90')
    const addButton = h.within(addPanel).getByRole('button', { name: 'Add' })
    expect(addButton).toBeEnabled()
    await user.click(addButton)

    expect(
      await h.screen.findByRole('row', { name: /dubgenres dub 90 active/i }),
    ).toBeVisible()
  })

  it('keeps collection-level dangerous settings actions unavailable', () => {
    window.history.pushState({}, '', '/settings')
    h.render(<h.App />)

    expect(
      h.screen.queryByRole('button', { name: 'Delete collection' }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('button', { name: 'Reset settings' }),
    ).not.toBeInTheDocument()
    expect(
      h
        .within(h.screen.getByLabelText('Dictionary entry removal'))
        .getByRole('button', { name: 'Delete' }),
    ).toBeDisabled()
    expect(h.screen.queryByLabelText(/confirmation/i)).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('row', { name: /unknownrelease types/i }),
    ).toBeInTheDocument()
  })

  it('exposes the workspace header as a banner landmark', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('link', { name: 'Settings' }))

    expect(
      h.within(h.screen.getByRole('banner')).getByText('Default collection'),
    ).toBeInTheDocument()
    expect(
      h.within(h.screen.getByRole('banner')).getByRole('heading', {
        name: 'Settings',
      }),
    ).toBeInTheDocument()
  })

  it('keeps sidebar and header behavior when navigating to settings', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('link', { name: 'Settings' }))

    expect(
      h.screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      h.within(h.screen.getByRole('banner')).getByText('Default collection'),
    ).toBeInTheDocument()
    expect(h.screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      h.within(h.screen.getByRole('banner')).queryByRole('button'),
    ).not.toBeInTheDocument()
  })
})
