// Run with Electron, not Node: electron scripts/check-unsaved-changes.cjs
// Uses only synthetic pages and an isolated profile, never the collection.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')
const {
  registerUnsavedChangesGuard,
  registerConfirmedQuit,
} = require('../electron/unsaved-changes.cjs')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'discweave-unload-'))
app.setPath('userData', profile)
app.on('window-all-closed', () => {})
let cleanups = 0
registerConfirmedQuit(app, () => cleanups++)
const deadline = setTimeout(() => {
  console.error('Electron unload smoke test timed out')
  app.exit(1)
}, 30000)
app.on('will-quit', () => clearTimeout(deadline))
const wait = () => new Promise((resolve) => setTimeout(resolve, 500))

async function createCase(dirty, discard) {
  const window = new BrowserWindow({
    show: true,
    title: 'DiscWeave synthetic unload check',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  await window.loadURL(
    'data:text/html,<h1>Synthetic unsaved changes check</h1>',
  )
  if (dirty) {
    await window.webContents.executeJavaScript(
      "addEventListener('beforeunload', event => event.preventDefault())",
    )
  }
  // Chromium requires sticky user activation to cancel a reload.
  for (const type of ['mouseDown', 'mouseUp']) {
    window.webContents.sendInputEvent({
      type,
      x: 20,
      y: 20,
      button: 'left',
      clickCount: 1,
    })
  }
  await wait()
  let prompts = 0
  let loads = 0
  // Exercise the production native handler with deterministic dialog choices.
  registerUnsavedChangesGuard(window, {
    showMessageBoxSync: () => {
      prompts++
      return discard ? 1 : 0
    },
  })
  window.webContents.on('did-finish-load', () => loads++)
  return { window, prompts: () => prompts, loads: () => loads }
}

async function checkUnload({ action, dirty, discard }) {
  const test = await createCase(dirty, discard)
  if (action === 'close') test.window.close()
  else test.window.webContents.reload()
  await wait()
  assert.equal(test.prompts(), dirty ? 1 : 0)
  const allowed = !dirty || discard
  assert.equal(
    action === 'close' ? test.window.isDestroyed() : test.loads() === 1,
    allowed,
  )
  console.log('PASS', { action, dirty, discard })
  if (!test.window.isDestroyed()) test.window.destroy()
}

async function checkQuit() {
  // app.quit is the native lifecycle used by the macOS Cmd+Q menu role.
  const test = await createCase(true, false)
  app.quit()
  await wait()
  assert.equal(test.prompts(), 1)
  assert.equal(test.window.isDestroyed(), false)
  assert.equal(cleanups, 0)
  test.window.webContents.removeAllListeners('will-prevent-unload')
  registerUnsavedChangesGuard(test.window, { showMessageBoxSync: () => 1 })
  app.on('will-quit', () => {
    assert.equal(cleanups, 1)
    console.log('PASS dirty quit: Stay keeps services alive, then Discard')
  })
  app.quit()
}

const scenarios = ['close', 'reload'].flatMap((action) =>
  [false, true].flatMap((dirty) =>
    [false, true].map((discard) => ({ action, dirty, discard })),
  ),
)
// Serialize native windows: parallel cases would interfere with input focus.
scenarios
  .reduce(
    (previous, scenario) => previous.then(() => checkUnload(scenario)),
    app.whenReady(),
  )
  .then(checkQuit)
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
