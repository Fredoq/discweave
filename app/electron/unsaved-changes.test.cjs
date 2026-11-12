// @vitest-environment node
const { EventEmitter } = require('node:events')
const {
  registerUnsavedChangesGuard,
  registerConfirmedQuit,
} = require('./unsaved-changes.cjs')

describe('native unsaved changes guard', () => {
  it.each([0, 1, -1])(
    'only discards after explicit confirmation (%s)',
    (choice) => {
      const window = { webContents: new EventEmitter() }
      const dialog = { showMessageBoxSync: vi.fn(() => choice) }
      registerUnsavedChangesGuard(window, dialog)
      expect(dialog.showMessageBoxSync).not.toHaveBeenCalled()
      const event = { preventDefault: vi.fn() }
      window.webContents.emit('will-prevent-unload', event)
      expect(dialog.showMessageBoxSync).toHaveBeenCalledWith(
        window,
        expect.objectContaining({
          buttons: ['Stay', 'Discard changes'],
          defaultId: 0,
          cancelId: 0,
        }),
      )
      expect(event.preventDefault).toHaveBeenCalledTimes(choice === 1 ? 1 : 0)
    },
  )
})

it('keeps services alive when a window cancels quitting', () => {
  const app = new EventEmitter()
  const cleanup = vi.fn()
  registerConfirmedQuit(app, cleanup)
  app.emit('before-quit')
  expect(cleanup).not.toHaveBeenCalled()
  app.emit('will-quit')
  expect(cleanup).toHaveBeenCalledOnce()
})
