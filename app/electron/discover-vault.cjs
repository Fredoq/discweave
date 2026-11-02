const fs = require('node:fs/promises')
const path = require('node:path')

const DEFAULT_MODEL = 'gpt-6-luna'

function createDiscoverVault({ safeStorage, storePath, fileSystem = fs }) {
  let settings = null
  let loaded = false
  let storage = null
  let queue = Promise.resolve()

  function secureAvailable() {
    return (
      safeStorage.isEncryptionAvailable() &&
      safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
    )
  }

  async function load() {
    if (loaded) return
    loaded = true
    if (!secureAvailable()) return
    try {
      const stat = await fileSystem.stat(storePath)
      if (stat.size > 32768) return
      const encrypted = await fileSystem.readFile(storePath)
      const value = JSON.parse(safeStorage.decryptString(encrypted))
      settings = validate(value)
      storage = settings ? 'secure' : null
    } catch {
      // Missing, locked, or unreadable OS storage is never a plaintext fallback.
      settings = null
    }
  }

  function serialize(action) {
    const result = queue.then(action)
    queue = result.catch(() => {})
    return result
  }

  function statusValue() {
    const emptyStorage = secureAvailable() ? 'secure' : 'unavailable'
    return {
      configured: Boolean(settings?.apiKey),
      storage: settings ? storage : emptyStorage,
      model: settings?.model ?? DEFAULT_MODEL,
      consented: settings?.consented === true,
    }
  }

  return {
    status: () =>
      serialize(async () => {
        await load()
        return statusValue()
      }),
    credentials: () =>
      serialize(async () => {
        await load()
        return settings ? { ...settings } : null
      }),
    save: (request) =>
      serialize(async () => {
        await load()
        const next = validate({
          ...request,
          apiKey: request?.apiKey || settings?.apiKey,
        })
        if (!next)
          throw new Error(
            'Enter a valid OpenAI key and use the supported gpt-6-luna model',
          )
        if (secureAvailable()) {
          const encrypted = safeStorage.encryptString(JSON.stringify(next))
          await fileSystem.mkdir(path.dirname(storePath), {
            recursive: true,
            mode: 0o700,
          })
          const temporary = `${storePath}.tmp`
          try {
            await fileSystem.writeFile(temporary, encrypted, { mode: 0o600 })
            await fileSystem.rename(temporary, storePath)
          } catch {
            await fileSystem.rm(temporary, { force: true }).catch(() => {})
            throw new Error('Could not save the key in secure storage')
          }
        } else {
          // Remove any older encrypted credential so session changes cannot revive it.
          await fileSystem.rm(storePath, { force: true })
        }
        storage = secureAvailable() ? 'secure' : 'session'
        settings = next
        return statusValue()
      }),
    remove: () =>
      serialize(async () => {
        await fileSystem.rm(storePath, { force: true })
        settings = null
        storage = null
        loaded = true
        return statusValue()
      }),
  }
}

function validate(value) {
  if (
    typeof value?.apiKey !== 'string' ||
    value.apiKey.length < 8 ||
    value.apiKey.length > 512 ||
    /\s/.test(value.apiKey) ||
    value.model !== DEFAULT_MODEL ||
    typeof value.consented !== 'boolean'
  )
    return null
  return {
    apiKey: value.apiKey,
    model: value.model,
    consented: value.consented,
  }
}

module.exports = { createDiscoverVault, DEFAULT_MODEL }
