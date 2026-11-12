function registerUnsavedChangesGuard(window, dialog) {
  window.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      buttons: ['Stay', 'Discard changes'],
      defaultId: 0,
      cancelId: 0,
      title: 'Unsaved changes',
      message: 'Discard your unsaved changes?',
      detail: 'Stay to continue editing or save your changes first.',
      noLink: true,
    })
    // For this Electron event, preventing the default allows the unload.
    if (choice === 1) event.preventDefault()
  })
}

function registerConfirmedQuit(app, cleanup) {
  // before-quit runs even when a dirty window subsequently cancels the quit.
  app.on('will-quit', cleanup)
}

module.exports = { registerUnsavedChangesGuard, registerConfirmedQuit }
