import { beforeEach } from 'vitest'
import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import { ReleasesWorkspace } from './features/releases/ReleasesWorkspace'

h.setupAppTestHooks()
beforeEach(() => window.localStorage.clear())

describe('Date added sorting', () => {
  it.each([
    'catalog',
    'releases',
    'tracks',
    'artists',
    'labels',
    'playlists',
    'owned-items',
    'relations',
  ])('offers date added sorting in %s', async (route) => {
    window.history.pushState({}, '', `/${route}`)
    h.render(<h.App />)
    const sort = h.screen.getByRole('combobox', { name: 'Sort by' })
    expect(
      h.within(sort).getByRole('option', { name: 'Date added — newest first' }),
    ).toBeInTheDocument()
    await h.userEvent.setup().selectOptions(sort, 'addedOldest')
    expect(sort).toHaveValue('addedOldest')
  })

  it('orders releases by creation time, keeps unknown dates last and preserves selection and filtering', async () => {
    const releases = [
      {
        ...h.releaseRecords[0],
        id: '01990000-0000-7000-8000-000000000001',
        title: 'Middle record',
      },
      { ...h.releaseRecords[0], id: 'legacy', title: 'Unknown record' },
      {
        ...h.releaseRecords[0],
        id: '01980000-0000-7000-8000-000000000001',
        title: 'Old record',
      },
      {
        ...h.releaseRecords[0],
        id: '019a0000-0000-7000-8000-000000000001',
        title: 'New record',
      },
    ]
    h.render(<ReleasesWorkspace releases={releases} />)
    const user = h.userEvent.setup()
    const rows = () =>
      h
        .within(h.screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((row) => h.within(row).getByRole('rowheader').textContent)
    const originalOrder = rows()
    const sort = h.screen.getByRole('combobox', { name: 'Sort by' })
    await user.selectOptions(sort, 'addedNewest')
    expect(rows()).toEqual([
      expect.stringContaining('New record'),
      expect.stringContaining('Middle record'),
      expect.stringContaining('Old record'),
      expect.stringContaining('Unknown record'),
    ])
    expect(
      h.screen.getByRole('complementary', { name: 'Middle record' }),
    ).toBeVisible()
    await user.selectOptions(sort, 'addedOldest')
    expect(rows()[0]).toContain('Old record')
    expect(rows()[3]).toContain('Unknown record')
    await user.selectOptions(sort, 'default')
    expect(rows()).toEqual(originalOrder)
    await user.selectOptions(sort, 'addedNewest')
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search releases' }),
      'Old record',
    )
    expect(rows()).toEqual([expect.stringContaining('Old record')])
  })
})
