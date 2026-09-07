import { beforeEach, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()
beforeEach(() => window.localStorage.clear())

it('restores independent sort choices when switching workspaces and remounting the app', async () => {
  window.history.pushState({}, '', '/releases')
  const user = h.userEvent.setup()
  const view = h.render(<h.App />)
  const sort = () => h.screen.getByRole('combobox', { name: 'Sort by' })
  await user.selectOptions(sort(), 'addedNewest')
  await user.click(h.screen.getByRole('link', { name: 'Artists' }))
  expect(sort()).toHaveValue('default')
  await user.selectOptions(sort(), 'addedOldest')
  await user.click(h.screen.getByRole('link', { name: 'Releases' }))
  expect(sort()).toHaveValue('addedNewest')
  view.unmount()
  h.render(<h.App />)
  expect(sort()).toHaveValue('addedNewest')
  await user.selectOptions(sort(), 'default')
  await user.click(h.screen.getByRole('link', { name: 'Artists' }))
  expect(sort()).toHaveValue('addedOldest')
  await user.click(h.screen.getByRole('link', { name: 'Releases' }))
  expect(sort()).toHaveValue('default')
})

it('restores review sorting on return while honoring an explicit URL choice', async () => {
  window.localStorage.setItem('discweave.sort.review-workbench', 'addedOldest')
  window.history.pushState({}, '', '/review-workbench?sort=addedNewest')
  const fetchMock = h.mockFetch()
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      h.jsonResponse({
        items: [],
        total: 0,
        limit: 100,
        offset: 0,
        summary: { active: 0, open: 0, reopened: 0, dismissed: 0, resolved: 0 },
      }),
    ),
  )
  const user = h.userEvent.setup()
  h.render(<h.App />)
  const sort = () => h.screen.getByRole('combobox', { name: 'Sort by' })
  expect(sort()).toHaveValue('addedNewest')
  await user.click(h.screen.getByRole('link', { name: 'Releases' }))
  await user.click(h.screen.getByRole('link', { name: 'Review Workbench' }))
  expect(sort()).toHaveValue('addedNewest')
  await user.selectOptions(sort(), 'default')
  expect(sort()).toHaveValue('default')
  await user.click(h.screen.getByRole('link', { name: 'Releases' }))
  await user.click(h.screen.getByRole('link', { name: 'Review Workbench' }))
  expect(sort()).toHaveValue('default')
})
