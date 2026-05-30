// @vitest-environment node

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { scanFolder } = require('./scanner.cjs')

const tempRoots = []

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discweave-scan-'))
  tempRoots.push(root)
  return root
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
    const mtime = new Date('2026-05-16T12:00:00Z')
    const createReadStream = vi.spyOn(fsSync, 'createReadStream')
    const readFile = vi.spyOn(fs, 'readFile')

    await fs.mkdir(releaseDir, { recursive: true })
    await fs.writeFile(audioPath, Buffer.from('cloud audio bytes'))
    await fs.writeFile(coverPath, Buffer.from('cloud cover bytes'))
    await fs.utimes(audioPath, mtime, mtime)
    await fs.utimes(coverPath, mtime, mtime)

    const scan = await scanFolder(root, { mode: 'namesOnly' })

    const audio = scan.files.find((file) => file.relativePath.endsWith('.flac'))
    const cover = scan.files.find((file) => file.relativePath.endsWith('.jpg'))
    expect(createReadStream).not.toHaveBeenCalled()
    expect(readFile).not.toHaveBeenCalled()
    expect(audio).toMatchObject({
      filePath: audioPath,
      relativePath: path.join('1991 - Other Release', '01 Track.flac'),
      format: 'flac',
      sizeBytes: 'cloud audio bytes'.length,
      lastModifiedAt: '2026-05-16T12:00:00.000Z',
      contentHash: null,
      audioMetadata: null,
      coverArtifact: null,
    })
    expect(cover).toMatchObject({
      filePath: coverPath,
      relativePath: path.join('1991 - Other Release', 'cover.jpg'),
      format: null,
      sizeBytes: 'cloud cover bytes'.length,
      lastModifiedAt: '2026-05-16T12:00:00.000Z',
      audioMetadata: null,
      coverArtifact: null,
    })
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

    const scan = await scanFolder(root)

    const audio = scan.files.find((file) => file.relativePath.endsWith('.flac'))
    const cover = scan.files.find((file) => file.relativePath.endsWith('.jpg'))
    expect(scan.sourceRoot).toBe(root)
    expect(scan.ignoredFileCount).toBe(2)
    expect(audio).toMatchObject({
      filePath: audioPath,
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
      filePath: coverPath,
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
})
