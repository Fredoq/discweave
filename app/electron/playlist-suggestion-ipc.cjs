function registerPlaylistSuggestionIpc({
  ipcMain,
  broker,
  trustedOrigin,
  isOwnedSender,
}) {
  for (const name of ['status', 'generate', 'cancel']) {
    ipcMain.handle(
      `discweave:playlist-suggestions:${name}`,
      async (event, request) => {
        let origin
        try {
          origin = new URL(event.senderFrame?.url).origin
        } catch {
          /* Reject missing frames below. */
        }
        if (
          !isOwnedSender(event.sender) ||
          !event.senderFrame ||
          event.senderFrame !== event.sender.mainFrame ||
          !trustedOrigin() ||
          origin !== trustedOrigin()
        ) {
          throw new Error(
            'Playlist suggestions are available only in the trusted application window',
          )
        }
        if (name === 'generate') return broker.generate(event.sender, request)
        if (name === 'cancel') return broker.cancel(event.sender)
        return broker.status()
      },
    )
  }
}
module.exports = { registerPlaylistSuggestionIpc }
