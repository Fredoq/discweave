function createArchiveMaintenance({ timeoutMs = 30000 } = {}) {
  const active = new Set()
  let maintenance = null
  function run(operation) {
    if (maintenance) {
      const error = new Error(
        'Archive upgrade is in progress. Try again when it finishes.',
      )
      error.code = 'archive.upgrading'
      return Promise.reject(error)
    }
    const pending = Promise.resolve().then(operation)
    active.add(pending)
    return pending.finally(() => active.delete(pending))
  }
  function exclusive({ pause, upgrade, resume }) {
    if (maintenance) return maintenance
    // Set the gate synchronously, before pause or any other asynchronous work.
    maintenance = Promise.resolve()
      .then(async () => {
        let timer
        let result
        let failure
        try {
          await pause()
          await Promise.race([
            Promise.allSettled([...active]),
            new Promise((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(
                    new Error(
                      'Existing operations have not finished. The archive was not upgraded.',
                    ),
                  ),
                timeoutMs,
              )
            }),
          ])
          clearTimeout(timer)
          // A previously active watch operation can reopen a watcher while draining.
          // Close it again after the last operation settles, before any backup starts.
          await pause()
          result = await upgrade()
        } catch (error) {
          failure = error
        } finally {
          clearTimeout(timer)
          try {
            await resume()
          } catch (error) {
            // Do not lose a successful upgrade's verified backup or mask its error.
            if (!failure && result && typeof result === 'object') {
              result = {
                ...result,
                code: result.code ?? 'archive.watches_paused',
              }
            } else if (!failure) {
              failure = error
            }
          }
        }
        if (failure) throw failure
        return result
      })
      .finally(() => {
        maintenance = null
      })
    return maintenance
  }
  return { run, exclusive, isBusy: () => maintenance !== null }
}

function registerArchiveIpc({
  ipcMain,
  archive,
  trustedOrigin,
  isOwnedSender,
}) {
  function validate(event, args) {
    let origin
    try {
      origin = new URL(event.senderFrame?.url).origin
    } catch {
      /* Rejected below. */
    }
    if (
      args.length ||
      !isOwnedSender(event.sender) ||
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame ||
      !trustedOrigin() ||
      origin !== trustedOrigin()
    ) {
      throw new Error(
        'Archive maintenance is available only in the trusted application window without arguments.',
      )
    }
  }
  for (const [channel, method] of [
    ['status', 'getStatus'],
    ['upgrade', 'backupAndUpgrade'],
  ]) {
    ipcMain.handle(`discweave:archive:${channel}`, async (event, ...args) => {
      validate(event, args)
      return await archive[method]()
    })
  }
}

module.exports = { createArchiveMaintenance, registerArchiveIpc }
