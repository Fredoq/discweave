// @vitest-environment node
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createDiscoverVault, DEFAULT_MODEL } = require('./discover-vault.cjs')

describe('Discover credential storage', () => {
  let directory
  let storePath
  let safeStorage
  const settings = {
    apiKey: 'test-private-key',
    model: DEFAULT_MODEL,
    consented: true,
  }
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'discover-vault-'))
    storePath = path.join(directory, 'credentials.enc')
    safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value).map((byte) => byte ^ 42),
      decryptString: (value) =>
        Buffer.from(value)
          .map((byte) => byte ^ 42)
          .toString(),
    }
  })
  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true })
  })
  const vault = () => createDiscoverVault({ safeStorage, storePath })
  it('stores only encrypted credentials and returns no secret in status', async () => {
    const instance = vault()
    const status = await instance.save(settings)
    expect(status).toEqual({
      configured: true,
      storage: 'secure',
      model: DEFAULT_MODEL,
      consented: true,
    })
    expect((await fs.readFile(storePath)).toString()).not.toContain(
      settings.apiKey,
    )
    expect((await fs.stat(storePath)).mode & 0o777).toBe(0o600)
    expect(await vault().credentials()).toEqual(settings)
  })
  it('uses session-only storage when encryption is unavailable', async () => {
    safeStorage.isEncryptionAvailable = () => false
    const instance = vault()
    expect((await instance.status()).storage).toBe('unavailable')
    expect((await instance.save(settings)).storage).toBe('session')
    expect(await instance.credentials()).toEqual(settings)
    await expect(fs.stat(storePath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await vault().status()).configured).toBe(false)
  })
  it('does not treat Linux basic text as secure storage', async () => {
    safeStorage.getSelectedStorageBackend = () => 'basic_text'
    expect((await vault().save(settings)).storage).toBe('session')
  })
  it('does not relabel a session credential as persisted when encryption becomes available', async () => {
    safeStorage.isEncryptionAvailable = () => false
    const instance = vault()
    await instance.save(settings)
    safeStorage.isEncryptionAvailable = () => true
    expect((await instance.status()).storage).toBe('session')
  })
  it('removes credentials and does not revive them after restart', async () => {
    const instance = vault()
    await instance.save(settings)
    expect((await instance.remove()).configured).toBe(false)
    expect(await instance.credentials()).toBeNull()
    expect(await vault().credentials()).toBeNull()
  })
  it('preserves a stored key when saving an empty key field', async () => {
    const instance = vault()
    await instance.save(settings)
    await instance.save({ ...settings, apiKey: '', consented: false })
    expect(await instance.credentials()).toEqual({
      ...settings,
      consented: false,
    })
  })
  it.each([
    { apiKey: 'short' },
    { apiKey: 'private\nkey' },
    { model: 'unbounded-expensive-model' },
    { consented: 'true' },
  ])('rejects malformed or unsupported settings %j', async (patch) => {
    await expect(vault().save({ ...settings, ...patch })).rejects.toThrow(
      'valid OpenAI key',
    )
  })
  it('treats corrupt storage as unconfigured without exposing its contents', async () => {
    await fs.writeFile(storePath, 'private-invalid-json')
    expect((await vault().status()).configured).toBe(false)
  })
  it('serializes save and removal so a removed key cannot reappear', async () => {
    const instance = vault()
    await Promise.all([instance.save(settings), instance.remove()])
    expect(await instance.credentials()).toBeNull()
  })
})
