function registerDiscoverIpc({
  ipcMain,
  broker,
  trustedOrigin,
  isOwnedSender,
}) {
  function validate(event) {
    let origin
    try {
      origin = new URL(event.senderFrame?.url).origin
    } catch {
      /* Invalid frames are rejected below. */
    }
    if (
      !isOwnedSender(event.sender) ||
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame ||
      !trustedOrigin() ||
      origin !== trustedOrigin()
    ) {
      throw new Error(
        'Discover is available only in the trusted application window',
      )
    }
  }
  for (const name of [
    'status',
    'save',
    'remove',
    'test',
    'generate',
    'cancel',
  ]) {
    ipcMain.handle(`discweave:discover:${name}`, async (event, request) => {
      validate(event)
      if (name === 'test' || name === 'generate')
        return await broker[name](event.sender, request)
      return await broker[name](request)
    })
  }
}

module.exports = { registerDiscoverIpc }
