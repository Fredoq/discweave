// @vitest-environment node

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createLocalFileTrust } = require('./local-file-trust.cjs')

describe('local file trust', () => {
  const tempRoots = []

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) =>
        fs.rm(root, {
          force: true,
          recursive: true,
        }),
      ),
    )
  })

  async function createFixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discweave-trust-'))
    tempRoots.push(root)
    const audioPath = path.join(root, '01 Track.flac')
    const storePath = path.join(root, 'local-file-trust.json')
    await fs.writeFile(audioPath, Buffer.from('audio-one'))
    return { audioPath, root, storePath }
  }

  function trustAt(
    storePath,
    isScanTrustedPath = async () => false,
    legacyOperationLogRoot,
  ) {
    return createLocalFileTrust({
      isScanTrustedPath,
      legacyOperationLogRoot,
      storePath,
    })
  }

  async function descriptor(localAudioFileId, filePath) {
    const content = await fs.readFile(filePath)
    const stats = await fs.stat(filePath)
    return {
      localAudioFileId,
      path: filePath,
      sizeBytes: stats.size,
      lastModifiedAt: stats.mtime.toISOString(),
      contentHash: crypto.createHash('sha256').update(content).digest('hex'),
    }
  }

  it('trusts a successfully edited file after a desktop restart', async () => {
    const { audioPath, storePath } = await createFixture()
    const firstSession = trustAt(storePath)
    await firstSession.trustEditedFiles([
      await descriptor('local-a', audioPath),
    ])

    const restartedSession = trustAt(storePath)

    await expect(
      restartedSession.isTrustedFile({
        localAudioFileId: 'local-a',
        path: audioPath,
      }),
    ).resolves.toBe(true)
  })

  it('rejects edited trust for a different local audio file identifier', async () => {
    const { audioPath, storePath } = await createFixture()
    await trustAt(storePath).trustEditedFiles([
      await descriptor('local-a', audioPath),
    ])

    await expect(
      trustAt(storePath).isTrustedFile({
        localAudioFileId: 'local-b',
        path: audioPath,
      }),
    ).resolves.toBe(false)
  })

  it('rejects edited trust for a different path', async () => {
    const { audioPath, root, storePath } = await createFixture()
    const otherPath = path.join(root, '02 Track.flac')
    await fs.copyFile(audioPath, otherPath)
    await trustAt(storePath).trustEditedFiles([
      await descriptor('local-a', audioPath),
    ])

    await expect(
      trustAt(storePath).isTrustedFile({
        localAudioFileId: 'local-a',
        path: otherPath,
      }),
    ).resolves.toBe(false)
  })

  it('rejects changed content even when size and timestamp still match', async () => {
    const { audioPath, storePath } = await createFixture()
    const trustedDescriptor = await descriptor('local-a', audioPath)
    await trustAt(storePath).trustEditedFiles([trustedDescriptor])
    await fs.writeFile(audioPath, Buffer.from('audio-two'))
    const trustedTimestamp = new Date(trustedDescriptor.lastModifiedAt)
    await fs.utimes(audioPath, trustedTimestamp, trustedTimestamp)

    await expect(
      trustAt(storePath).isTrustedFile({
        localAudioFileId: 'local-a',
        path: audioPath,
      }),
    ).resolves.toBe(false)
  })

  it('fails closed when persisted trust is malformed', async () => {
    const { audioPath, storePath } = await createFixture()
    await fs.writeFile(storePath, '{not-json')

    await expect(
      trustAt(storePath).isTrustedFile({
        localAudioFileId: 'local-a',
        path: audioPath,
      }),
    ).resolves.toBe(false)
  })

  it('replaces the previous descriptor for the same identifier', async () => {
    const { audioPath, root, storePath } = await createFixture()
    const nextPath = path.join(root, 'Renamed Track.flac')
    await fs.copyFile(audioPath, nextPath)
    const trust = trustAt(storePath)
    await trust.trustEditedFiles([await descriptor('local-a', audioPath)])
    await trust.trustEditedFiles([await descriptor('local-a', nextPath)])
    const restartedSession = trustAt(storePath)

    await expect(
      restartedSession.isTrustedFile({
        localAudioFileId: 'local-a',
        path: audioPath,
      }),
    ).resolves.toBe(false)
    await expect(
      restartedSession.isTrustedFile({
        localAudioFileId: 'local-a',
        path: nextPath,
      }),
    ).resolves.toBe(true)
  })

  it('accepts a path trusted by the native scan flow', async () => {
    const { audioPath, storePath } = await createFixture()
    const isScanTrustedPath = vi.fn().mockResolvedValue(true)

    await expect(
      trustAt(storePath, isScanTrustedPath).isTrustedFile({
        localAudioFileId: 'local-a',
        path: audioPath,
      }),
    ).resolves.toBe(true)
    expect(isScanTrustedPath).toHaveBeenCalledWith(audioPath)
  })

  it('migrates successful historical local edit operations', async () => {
    const { audioPath, root, storePath } = await createFixture()
    const legacyOperationLogRoot = path.join(root, 'local-edit-operation-logs')
    const trustedDescriptor = await descriptor('local-a', audioPath)
    await fs.mkdir(legacyOperationLogRoot)
    await fs.writeFile(
      path.join(legacyOperationLogRoot, '2026-07-15-edit.json'),
      JSON.stringify({
        operations: [
          {
            result: 'applied',
            state: 'fileApplied',
            updatedFile: trustedDescriptor,
          },
        ],
      }),
    )

    await expect(
      trustAt(
        storePath,
        async () => false,
        legacyOperationLogRoot,
      ).isTrustedFile({
        localAudioFileId: 'local-a',
        path: audioPath,
      }),
    ).resolves.toBe(true)
    await expect(
      trustAt(storePath).isTrustedFile({
        localAudioFileId: 'local-a',
        path: audioPath,
      }),
    ).resolves.toBe(true)
  })

  it('ignores failed and malformed historical local edit operations', async () => {
    const { audioPath, root, storePath } = await createFixture()
    const legacyOperationLogRoot = path.join(root, 'local-edit-operation-logs')
    await fs.mkdir(legacyOperationLogRoot)
    await fs.writeFile(
      path.join(legacyOperationLogRoot, '2026-07-15-failed.json'),
      JSON.stringify({
        operations: [
          {
            result: 'failed',
            state: 'failed',
            updatedFile: await descriptor('local-a', audioPath),
          },
        ],
      }),
    )
    await fs.writeFile(
      path.join(legacyOperationLogRoot, '2026-07-15-malformed.json'),
      '{not-json',
    )

    await expect(
      trustAt(
        storePath,
        async () => false,
        legacyOperationLogRoot,
      ).isTrustedFile({
        localAudioFileId: 'local-a',
        path: audioPath,
      }),
    ).resolves.toBe(false)
  })

  it('rejects invalid edited file descriptors', async () => {
    const { audioPath, storePath } = await createFixture()

    await expect(
      trustAt(storePath).trustEditedFiles([
        {
          localAudioFileId: 'local-a',
          path: audioPath,
          sizeBytes: 1,
          lastModifiedAt: 'not-a-timestamp',
          contentHash: 'not-a-hash',
        },
      ]),
    ).rejects.toThrow('Invalid local edit trust descriptor.')
  })
})
