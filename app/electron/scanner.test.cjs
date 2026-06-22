// @vitest-environment node

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Readable } = require('node:stream')
const { scanFolder, scannedAudioFormat } = require('./scanner.cjs')

const tempRoots = []

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discweave-scan-'))
  tempRoots.push(root)
  return root
}

function taggedMetadata(title) {
  return {
    common: {
      title,
      artist: 'Cached Artist',
      album: 'Cached Album',
      albumartist: 'Cached Album Artist',
      track: { no: 1 },
      year: 1992,
    },
    format: {
      bitrate: 840000,
      codec: 'FLAC',
      container: 'FLAC',
      duration: 123.4,
      lossless: true,
      numberOfChannels: 2,
      sampleRate: 44100,
    },
    native: {},
  }
}

async function readSingleManifest(manifestRoot) {
  const manifestFiles = await fs.readdir(manifestRoot)
  expect(manifestFiles).toHaveLength(1)
  const manifestPath = path.join(manifestRoot, manifestFiles[0])
  return JSON.parse(await fs.readFile(manifestPath, 'utf8'))
}

async function rewriteSingleManifest(manifestRoot, update) {
  const manifestFiles = await fs.readdir(manifestRoot)
  expect(manifestFiles).toHaveLength(1)
  const manifestPath = path.join(manifestRoot, manifestFiles[0])
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  await fs.writeFile(manifestPath, JSON.stringify(update(manifest), null, 2))
}

describe('desktop folder scanner', () => {
  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(
      tempRoots.splice(0).map((root) =>
        fs.rm(root, {
          force: true,
          recursive: true,
        }),
      ),
    )
  })

  it('scans filenames only without reading audio or cover bytes', async () => {
    const root = await createTempRoot()
    const releaseDir = path.join(root, '1991 - Other Release')
    const audioPath = path.join(releaseDir, '01 Track.flac')
    const coverPath = path.join(releaseDir, 'cover.jpg')
    const unsupportedPath = path.join(releaseDir, 'notes.txt')
    const hiddenPath = path.join(releaseDir, '.DS_Store')
    const symlinkPath = path.join(releaseDir, 'linked.flac')
    const mtime = new Date('2026-05-16T12:00:00Z')
    const createReadStream = vi.spyOn(fsSync, 'createReadStream')
    const readFile = vi.spyOn(fs, 'readFile')

    await fs.mkdir(releaseDir, { recursive: true })
    await fs.writeFile(audioPath, Buffer.from('cloud audio bytes'))
    await fs.writeFile(coverPath, Buffer.from('cloud cover bytes'))
    await fs.writeFile(unsupportedPath, 'ignored')
    await fs.writeFile(hiddenPath, 'ignored')
    await fs.symlink(audioPath, symlinkPath)
    await fs.utimes(audioPath, mtime, mtime)
    await fs.utimes(coverPath, mtime, mtime)

    const realRoot = await fs.realpath(root)
    const realUnsupportedPath = path.join(
      realRoot,
      '1991 - Other Release',
      'notes.txt',
    )
    const realHiddenPath = path.join(
      realRoot,
      '1991 - Other Release',
      '.DS_Store',
    )
    const realSymlinkPath = path.join(
      realRoot,
      '1991 - Other Release',
      'linked.flac',
    )
    const scan = await scanFolder(root, { mode: 'namesOnly' })

    const audio = scan.files.find((file) => file.relativePath.endsWith('.flac'))
    const cover = scan.files.find((file) => file.relativePath.endsWith('.jpg'))
    expect(createReadStream).not.toHaveBeenCalled()
    expect(readFile).not.toHaveBeenCalled()
    expect(scan.scanMode).toBe('namesOnly')
    expect(scan.ignoredFileCount).toBe(3)
    expect(scan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'hidden_path',
          filePath: realHiddenPath,
          relativePath: path.join('1991 - Other Release', '.DS_Store'),
          severity: 'info',
          source: 'scanner',
        }),
        expect.objectContaining({
          code: 'symlink_ignored',
          filePath: realSymlinkPath,
          relativePath: path.join('1991 - Other Release', 'linked.flac'),
          severity: 'info',
          source: 'scanner',
        }),
        expect.objectContaining({
          code: 'unsupported_extension',
          extension: '.txt',
          filePath: realUnsupportedPath,
          relativePath: path.join('1991 - Other Release', 'notes.txt'),
          severity: 'info',
          source: 'scanner',
        }),
      ]),
    )
    expect(audio).toMatchObject({
      filePath: path.join(realRoot, '1991 - Other Release', '01 Track.flac'),
      relativePath: path.join('1991 - Other Release', '01 Track.flac'),
      format: 'flac',
      sizeBytes: 'cloud audio bytes'.length,
      lastModifiedAt: '2026-05-16T12:00:00.000Z',
      contentHash: null,
      audioMetadata: null,
      coverArtifact: null,
    })
    expect(cover).toMatchObject({
      filePath: path.join(realRoot, '1991 - Other Release', 'cover.jpg'),
      relativePath: path.join('1991 - Other Release', 'cover.jpg'),
      format: null,
      sizeBytes: 'cloud cover bytes'.length,
      lastModifiedAt: '2026-05-16T12:00:00.000Z',
      audioMetadata: null,
      coverArtifact: null,
    })
  })

  it('reuses unchanged full-scan hashes and metadata from the local manifest', async () => {
    const root = await createTempRoot()
    const manifestRoot = path.join(await createTempRoot(), 'manifests')
    const audioPath = path.join(root, '01 Cached.flac')
    const audioBytes = Buffer.from('cached flac bytes')
    const mtime = new Date('2026-05-16T12:00:00Z')
    const metadataReader = vi.fn(async () => taggedMetadata('Cached Track'))

    await fs.writeFile(audioPath, audioBytes)
    await fs.utimes(audioPath, mtime, mtime)

    const firstScan = await scanFolder(root, { manifestRoot, metadataReader })
    const createReadStream = vi.spyOn(fsSync, 'createReadStream')
    metadataReader.mockClear()
    const secondScan = await scanFolder(root, { manifestRoot, metadataReader })

    expect(metadataReader).not.toHaveBeenCalled()
    expect(createReadStream).not.toHaveBeenCalled()
    expect(secondScan.files[0]).toMatchObject({
      contentHash: firstScan.files[0].contentHash,
      audioMetadata: firstScan.files[0].audioMetadata,
    })
    const manifest = await readSingleManifest(manifestRoot)
    expect(Object.keys(manifest.files)).toEqual(['01 Cached.flac'])
    expect(JSON.stringify(manifest)).not.toContain(
      audioBytes.toString('base64'),
    )
  })

  it('rereads changed files and stale scanner-version manifest entries', async () => {
    const root = await createTempRoot()
    const manifestRoot = path.join(await createTempRoot(), 'manifests')
    const audioPath = path.join(root, '01 Changed.flac')
    const firstMtime = new Date('2026-05-16T12:00:00Z')
    const secondMtime = new Date('2026-05-16T12:01:00Z')
    const metadataReader = vi.fn(async () => taggedMetadata('Original Track'))

    await fs.writeFile(audioPath, Buffer.from('first bytes'))
    await fs.utimes(audioPath, firstMtime, firstMtime)
    const firstScan = await scanFolder(root, { manifestRoot, metadataReader })
    await rewriteSingleManifest(manifestRoot, (manifest) => ({
      ...manifest,
      scannerVersion: 0,
    }))
    const staleVersionReadStream = vi.spyOn(fsSync, 'createReadStream')
    metadataReader.mockClear()
    metadataReader.mockResolvedValueOnce(taggedMetadata('Original Track'))

    await scanFolder(root, { manifestRoot, metadataReader })

    expect(staleVersionReadStream).toHaveBeenCalled()
    expect(metadataReader).toHaveBeenCalledTimes(1)
    staleVersionReadStream.mockClear()
    metadataReader.mockClear()
    metadataReader.mockResolvedValueOnce(taggedMetadata('Changed Track'))
    await fs.writeFile(audioPath, Buffer.from('changed bytes with new size'))
    await fs.utimes(audioPath, secondMtime, secondMtime)

    const changedScan = await scanFolder(root, { manifestRoot, metadataReader })

    expect(staleVersionReadStream).toHaveBeenCalled()
    expect(metadataReader).toHaveBeenCalledTimes(1)
    expect(changedScan.files[0].contentHash).not.toBe(
      firstScan.files[0].contentHash,
    )
    expect(changedScan.files[0].audioMetadata.title).toBe('Changed Track')
  })

  it('keeps names-only scans safe when a full-scan manifest exists', async () => {
    const root = await createTempRoot()
    const manifestRoot = path.join(await createTempRoot(), 'manifests')
    const audioPath = path.join(root, '01 Cloud.flac')
    const coverPath = path.join(root, 'cover.jpg')
    const mtime = new Date('2026-05-16T12:00:00Z')
    const metadataReader = vi.fn(async () => taggedMetadata('Cloud Track'))

    await fs.writeFile(audioPath, Buffer.from('cloud audio bytes'))
    await fs.writeFile(coverPath, Buffer.from('cloud cover bytes'))
    await fs.utimes(audioPath, mtime, mtime)
    await fs.utimes(coverPath, mtime, mtime)
    await scanFolder(root, { manifestRoot, metadataReader })
    const createReadStream = vi.spyOn(fsSync, 'createReadStream')
    const readFile = vi.spyOn(fs, 'readFile')
    metadataReader.mockClear()

    const scan = await scanFolder(root, {
      manifestRoot,
      metadataReader,
      mode: 'namesOnly',
    })

    expect(createReadStream).not.toHaveBeenCalled()
    expect(readFile).not.toHaveBeenCalled()
    expect(metadataReader).not.toHaveBeenCalled()
    expect(scan.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: '01 Cloud.flac',
          contentHash: null,
          audioMetadata: null,
          coverArtifact: null,
        }),
        expect.objectContaining({
          relativePath: 'cover.jpg',
          coverArtifact: null,
        }),
      ]),
    )
  })

  it('hashes audio files, includes metadata shape, and never attaches audio bytes', async () => {
    const root = await createTempRoot()
    const releaseDir = path.join(root, 'Release')
    const audioPath = path.join(releaseDir, '01 Track.flac')
    const coverPath = path.join(releaseDir, 'cover.jpg')
    const audioBytes = Buffer.from('fake flac bytes')
    const coverBytes = Buffer.from('cover bytes')
    const mtime = new Date('2026-05-16T12:00:00Z')

    await fs.mkdir(releaseDir, { recursive: true })
    await fs.writeFile(audioPath, audioBytes)
    await fs.writeFile(coverPath, coverBytes)
    await fs.writeFile(path.join(releaseDir, 'notes.txt'), 'ignored')
    await fs.writeFile(path.join(releaseDir, '.DS_Store'), 'ignored')
    await fs.utimes(audioPath, mtime, mtime)
    await fs.utimes(coverPath, mtime, mtime)

    const realRoot = await fs.realpath(root)
    const realAudioPath = path.join(realRoot, 'Release', '01 Track.flac')
    const realNotesPath = path.join(realRoot, 'Release', 'notes.txt')
    const realHiddenPath = path.join(realRoot, 'Release', '.DS_Store')
    const scan = await scanFolder(root)

    const audio = scan.files.find((file) => file.relativePath.endsWith('.flac'))
    const cover = scan.files.find((file) => file.relativePath.endsWith('.jpg'))
    expect(scan.sourceRoot).toBe(realRoot)
    expect(scan.ignoredFileCount).toBe(2)
    expect(scan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'metadata_read_failed',
          filePath: realAudioPath,
          relativePath: path.join('Release', '01 Track.flac'),
          severity: 'warning',
          source: 'metadata',
        }),
        expect.objectContaining({
          code: 'unsupported_extension',
          filePath: realNotesPath,
          relativePath: path.join('Release', 'notes.txt'),
          severity: 'info',
          source: 'scanner',
        }),
        expect.objectContaining({
          code: 'hidden_path',
          filePath: realHiddenPath,
          relativePath: path.join('Release', '.DS_Store'),
          severity: 'info',
          source: 'scanner',
        }),
      ]),
    )
    expect(audio).toMatchObject({
      filePath: path.join(realRoot, 'Release', '01 Track.flac'),
      relativePath: path.join('Release', '01 Track.flac'),
      format: 'flac',
      sizeBytes: audioBytes.length,
      lastModifiedAt: '2026-05-16T12:00:00.000Z',
      contentHash: crypto.createHash('sha256').update(audioBytes).digest('hex'),
      audioMetadata: {
        title: null,
        artists: [],
        albumTitle: null,
        albumArtists: [],
        catalogNumber: null,
        releaseDate: null,
        year: null,
        durationSeconds: null,
        trackNumber: null,
      },
      coverArtifact: null,
    })
    expect(audio).not.toHaveProperty('contentBase64')
    expect(JSON.stringify(audio)).not.toContain(audioBytes.toString('base64'))
    expect(cover).toMatchObject({
      filePath: path.join(realRoot, 'Release', 'cover.jpg'),
      relativePath: path.join('Release', 'cover.jpg'),
      format: null,
      sizeBytes: coverBytes.length,
      lastModifiedAt: '2026-05-16T12:00:00.000Z',
      audioMetadata: null,
      coverArtifact: {
        fileName: 'cover.jpg',
        extension: '.jpg',
        contentType: 'image/jpeg',
        sizeBytes: coverBytes.length,
        contentBase64: coverBytes.toString('base64'),
      },
    })
  })

  it('scans a synthetic messy regression fixture without private data or audio bytes', async () => {
    const root = await createTempRoot()
    const files = [
      ['[DW 01, 2026] Fixture Artist - Normal', '01 First.flac'],
      ['[DW 02, 2026] Various - Compilation', 'CD 1', '01 Alpha.flac'],
      ['[DW 02, 2026] Various - Compilation', 'CD 2', '01 Beta.flac'],
      ['Root Loose.flac'],
      ['Mixed Tags', '01 Album A.flac'],
      ['Mixed Tags', '02 Album B.flac'],
    ]
    const metadataByFileName = {
      '01 First.flac': taggedMetadata('First'),
      '01 Alpha.flac': {
        common: {
          title: 'Alpha',
          artists: ['Alpha Artist'],
          album: 'Compilation',
          albumartists: ['Various Artists'],
          track: { no: 1 },
          year: 2026,
        },
        format: { codec: 'FLAC', duration: 180, lossless: true },
        native: {},
      },
      '01 Beta.flac': {
        common: {
          title: 'Beta',
          artists: ['Beta Artist'],
          album: 'Compilation',
          albumartists: ['Various Artists'],
          track: { no: 1 },
          year: 2026,
        },
        format: { codec: 'FLAC', duration: 181, lossless: true },
        native: {},
      },
      'Root Loose.flac': taggedMetadata('Root Loose'),
      '01 Album A.flac': {
        common: { title: 'Album A', album: 'Album A', track: { no: 1 } },
        format: { codec: 'FLAC', duration: 120, lossless: true },
        native: {},
      },
      '02 Album B.flac': {
        common: { title: 'Album B', album: 'Album B', track: { no: 2 } },
        format: { codec: 'FLAC', duration: 121, lossless: true },
        native: {},
      },
    }
    const mtime = new Date('2026-06-01T12:00:00Z')

    for (const segments of files) {
      const filePath = path.join(root, ...segments)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(
        filePath,
        Buffer.from(`fixture bytes: ${segments.at(-1)}`),
      )
      await fs.utimes(filePath, mtime, mtime)
    }
    await fs.writeFile(path.join(root, 'notes.txt'), 'unsupported')
    await fs.writeFile(path.join(root, '.DS_Store'), 'hidden')
    await fs.symlink(
      path.join(root, '[DW 01, 2026] Fixture Artist - Normal', '01 First.flac'),
      path.join(root, 'linked.flac'),
    )

    const realRoot = await fs.realpath(root)
    const metadataReader = vi.fn(
      async (filePath) => metadataByFileName[path.basename(filePath)],
    )
    const scan = await scanFolder(root, { metadataReader })
    const relativePaths = scan.files.map((file) => file.relativePath).sort()
    const raw = JSON.stringify(scan)

    expect(scan.sourceRoot).toBe(realRoot)
    expect(scan.ignoredFileCount).toBe(3)
    expect(relativePaths).toEqual(
      [
        path.join('[DW 01, 2026] Fixture Artist - Normal', '01 First.flac'),
        path.join(
          '[DW 02, 2026] Various - Compilation',
          'CD 1',
          '01 Alpha.flac',
        ),
        path.join(
          '[DW 02, 2026] Various - Compilation',
          'CD 2',
          '01 Beta.flac',
        ),
        path.join('Mixed Tags', '01 Album A.flac'),
        path.join('Mixed Tags', '02 Album B.flac'),
        'Root Loose.flac',
      ].sort(),
    )
    expect(scan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unsupported_extension' }),
        expect.objectContaining({ code: 'hidden_path' }),
        expect.objectContaining({ code: 'symlink_ignored' }),
      ]),
    )
    expect(metadataReader).toHaveBeenCalledTimes(6)
    expect(
      scan.files.every((file) => typeof file.contentHash === 'string'),
    ).toBe(true)
    expect(raw).not.toContain('audioBytes')
    expect(raw).not.toContain('contentBase64')
    expect(raw).not.toContain(Buffer.from('fixture bytes').toString('base64'))
  })

  it('reports hash read failures while preserving the audio file metadata', async () => {
    const root = await createTempRoot()
    const audioPath = path.join(root, '01 Track.flac')
    await fs.writeFile(audioPath, Buffer.from('fake flac bytes'))
    const realRoot = await fs.realpath(root)
    const realAudioPath = path.join(realRoot, '01 Track.flac')

    const originalCreateReadStream = fsSync.createReadStream.bind(fsSync)
    vi.spyOn(fsSync, 'createReadStream').mockImplementation(
      (target, options) => {
        if (target === realAudioPath) {
          return new Readable({
            read() {
              this.destroy(new Error('hash failed'))
            },
          })
        }

        return originalCreateReadStream(target, options)
      },
    )

    const scan = await scanFolder(root)

    expect(scan.files).toHaveLength(1)
    expect(scan.files[0]).toMatchObject({
      filePath: realAudioPath,
      contentHash: null,
    })
    expect(scan.ignoredFileCount).toBe(0)
    expect(scan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'hash_read_failed',
          filePath: realAudioPath,
          relativePath: '01 Track.flac',
          severity: 'warning',
          source: 'hashing',
        }),
      ]),
    )
  })

  it('reports oversized cover artifacts without attaching cover bytes', async () => {
    const root = await createTempRoot()
    const coverPath = path.join(root, 'cover.jpg')
    await fs.writeFile(coverPath, '')
    await fs.truncate(coverPath, 10 * 1024 * 1024 + 1)
    const realRoot = await fs.realpath(root)
    const realCoverPath = path.join(realRoot, 'cover.jpg')

    const scan = await scanFolder(root)

    expect(scan.files).toHaveLength(1)
    expect(scan.files[0]).toMatchObject({
      filePath: realCoverPath,
      coverArtifact: null,
    })
    expect(JSON.stringify(scan)).not.toContain('contentBase64')
    expect(scan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'cover_too_large',
          filePath: realCoverPath,
          relativePath: 'cover.jpg',
          severity: 'warning',
          sizeBytes: 10 * 1024 * 1024 + 1,
          source: 'cover',
        }),
      ]),
    )
  })

  it('reports cover read failures while preserving the cover path metadata', async () => {
    const root = await createTempRoot()
    const coverPath = path.join(root, 'cover.jpg')
    await fs.writeFile(coverPath, Buffer.from('cover bytes'))
    const realRoot = await fs.realpath(root)
    const realCoverPath = path.join(realRoot, 'cover.jpg')

    const originalReadFile = fs.readFile.bind(fs)
    vi.spyOn(fs, 'readFile').mockImplementation((target, options) => {
      if (target === realCoverPath) {
        return Promise.reject(new Error('cover read failed'))
      }

      return originalReadFile(target, options)
    })

    const scan = await scanFolder(root)

    expect(scan.files).toHaveLength(1)
    expect(scan.files[0]).toMatchObject({
      filePath: realCoverPath,
      coverArtifact: null,
    })
    expect(scan.ignoredFileCount).toBe(0)
    expect(scan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'cover_read_failed',
          filePath: realCoverPath,
          relativePath: 'cover.jpg',
          severity: 'warning',
          source: 'cover',
        }),
      ]),
    )
  })

  it('reports depth limit and unreadable directory diagnostics', async () => {
    const root = await createTempRoot()
    let deepDir = root
    for (let index = 0; index < 26; index += 1) {
      deepDir = path.join(deepDir, `level-${index}`)
      await fs.mkdir(deepDir)
    }

    const unreadableDir = path.join(root, 'Unreadable')
    await fs.mkdir(unreadableDir)
    const realRoot = await fs.realpath(root)
    const realUnreadableDir = path.join(realRoot, 'Unreadable')

    const originalReaddir = fs.readdir.bind(fs)
    vi.spyOn(fs, 'readdir').mockImplementation((target, options) => {
      if (target === realUnreadableDir) {
        return Promise.reject(new Error('permission denied'))
      }

      return originalReaddir(target, options)
    })

    const scan = await scanFolder(root)

    expect(scan.ignoredFileCount).toBe(2)
    expect(scan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'depth_limit',
          severity: 'warning',
          source: 'scanner',
        }),
        expect.objectContaining({
          code: 'directory_unreadable',
          filePath: realUnreadableDir,
          relativePath: 'Unreadable',
          severity: 'warning',
          source: 'scanner',
        }),
      ]),
    )
  })

  it('classifies an m4a container with ALAC codec as lossless ALAC', () => {
    expect(
      scannedAudioFormat('.m4a', {
        codec: 'ALAC',
        container: 'M4A',
      }),
    ).toBe('alac')
    expect(
      scannedAudioFormat('.m4a', {
        codec: 'AAC',
        container: 'M4A',
      }),
    ).toBe('m4a')
  })
})
