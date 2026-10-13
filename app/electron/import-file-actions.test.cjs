// @vitest-environment node

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createImportFileActions } = require('./import-file-actions.cjs')

describe('import file actions', () => {
  let root
  let home

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'discweave-import-files-'))
    home = path.join(root, 'home')
    await fs.mkdir(home)
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  async function writeFile(relativePath) {
    const filePath = path.join(root, relativePath)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, 'audio')
    return filePath
  }

  function actionsWith({
    trusted = () => true,
    protectedFolders = [],
    openPath = vi.fn().mockResolvedValue(''),
    trashItem = vi.fn().mockResolvedValue(undefined),
  } = {}) {
    return {
      openPath,
      trashItem,
      actions: createImportFileActions({
        fs,
        shell: { openPath, trashItem },
        isTrustedFilePath: async (filePath) => trusted(filePath),
        protectedFolders: async () => protectedFolders,
        homeDirectory: home,
      }),
    }
  }

  it('opens a scanned file in the default player', async () => {
    const filePath = await writeFile('Library/Release/01.flac')
    const { actions, openPath } = actionsWith()

    await expect(actions.openFile({ path: filePath })).resolves.toEqual({
      ok: true,
      path: filePath,
    })
    expect(openPath).toHaveBeenCalledWith(filePath)
  })

  it('refuses to open files that no import scan captured', async () => {
    const filePath = await writeFile('Library/Release/01.flac')
    const { actions, openPath } = actionsWith({ trusted: () => false })

    await expect(actions.openFile({ path: filePath })).resolves.toMatchObject({
      ok: false,
      reason: 'invalid-path',
    })
    await expect(
      actions.openFile({ path: 'relative/01.flac' }),
    ).resolves.toMatchObject({ ok: false, reason: 'invalid-path' })
    expect(openPath).not.toHaveBeenCalled()
  })

  it('reports a missing file without opening it', async () => {
    const { actions, openPath } = actionsWith()
    const filePath = path.join(root, 'Library/Release/gone.flac')

    await expect(actions.openFile({ path: filePath })).resolves.toMatchObject({
      ok: false,
      reason: 'missing',
      message: 'The file does not exist.',
    })
    expect(openPath).not.toHaveBeenCalled()
  })

  it('plans and trashes the whole release folder when it holds only this release', async () => {
    const first = await writeFile('Library/Release/CD1/01.flac')
    const second = await writeFile('Library/Release/CD2/01.flac')
    await writeFile('Library/Release/cover.jpg')
    await writeFile('Library/Release/CD1/rip.log')
    const releaseFolder = path.join(root, 'Library/Release')
    const { actions, trashItem } = actionsWith({
      protectedFolders: [path.join(root, 'Library')],
    })
    const request = { sourcePath: releaseFolder, filePaths: [first, second] }

    await expect(actions.planReleaseTrash(request)).resolves.toEqual({
      mode: 'folder',
      folderPath: releaseFolder,
      audioFiles: [first, second],
      missingFiles: [],
      otherFileCount: 2,
      otherFileSamples: [path.join('CD1', 'rip.log'), 'cover.jpg'],
      foreignAudioFileCount: 0,
    })
    await expect(actions.trashRelease(request)).resolves.toEqual({
      ok: true,
      mode: 'folder',
      trashedPaths: [releaseFolder],
      failedPath: null,
    })
    expect(trashItem).toHaveBeenCalledTimes(1)
  })

  it('trashes only the release files when the folder holds other audio', async () => {
    const own = await writeFile('Library/Mixed/01.flac')
    await writeFile('Library/Mixed/other-release.mp3')
    const { actions, trashItem } = actionsWith()
    const request = {
      sourcePath: path.join(root, 'Library/Mixed'),
      filePaths: [own],
    }

    await expect(actions.planReleaseTrash(request)).resolves.toMatchObject({
      mode: 'files',
      audioFiles: [own],
      otherFileCount: 0,
      foreignAudioFileCount: 1,
    })
    await expect(actions.trashRelease(request)).resolves.toMatchObject({
      ok: true,
      mode: 'files',
      trashedPaths: [own],
    })
    expect(trashItem).toHaveBeenCalledWith(own)
  })

  it('never trashes an import source folder or the home folder', async () => {
    const libraryFile = await writeFile('Library/01.flac')
    const homeFile = path.join(home, 'Music/01.flac')
    await fs.mkdir(path.dirname(homeFile), { recursive: true })
    await fs.writeFile(homeFile, 'audio')
    const { actions } = actionsWith({
      protectedFolders: [path.join(root, 'Library'), path.join(home, 'Music')],
    })

    await expect(
      actions.planReleaseTrash({
        sourcePath: path.join(root, 'Library'),
        filePaths: [libraryFile],
      }),
    ).resolves.toMatchObject({ mode: 'files', audioFiles: [libraryFile] })
    await expect(
      actions.planReleaseTrash({ sourcePath: home, filePaths: [homeFile] }),
    ).resolves.toMatchObject({ mode: 'files', audioFiles: [homeFile] })
  })

  it('rejects release files that no import scan captured', async () => {
    const filePath = await writeFile('Library/Release/01.flac')
    const { actions, trashItem } = actionsWith({ trusted: () => false })

    await expect(
      actions.trashRelease({
        sourcePath: path.dirname(filePath),
        filePaths: [filePath],
      }),
    ).rejects.toThrow('Release files must be captured by an import scan.')
    await expect(actions.planReleaseTrash({ filePaths: [] })).rejects.toThrow(
      'At least one release file is required.',
    )
    expect(trashItem).not.toHaveBeenCalled()
  })

  it('reports the files trashed before a failure', async () => {
    const first = await writeFile('Library/Mixed/01.flac')
    const second = await writeFile('Library/Mixed/02.flac')
    await writeFile('Library/Mixed/other.mp3')
    const trashItem = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Permission denied'))
    const { actions } = actionsWith({ trashItem })

    await expect(
      actions.trashRelease({
        sourcePath: path.join(root, 'Library/Mixed'),
        filePaths: [first, second],
      }),
    ).resolves.toEqual({
      ok: false,
      mode: 'files',
      trashedPaths: [first],
      failedPath: second,
      message: 'Permission denied',
    })
  })
})
