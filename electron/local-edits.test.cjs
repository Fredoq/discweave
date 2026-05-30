// @vitest-environment node

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const {
  applyLocalEdits,
  inspectLocalFile,
  previewLocalEdits,
  toTagLibTags,
} = require('./local-edits.cjs')

const tempRoots = []

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cratebase-edit-'))
  tempRoots.push(root)
  return root
}

describe('desktop local edits service', () => {
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

  it('inspects normalized tags and technical metadata through an injected reader', async () => {
    const root = await createTempRoot()
    const filePath = path.join(root, '01 Track.flac')
    await fs.writeFile(filePath, 'audio')

    const result = await inspectLocalFile(
      { path: filePath },
      {
        metadataReader: async () => ({
          common: {
            title: 'Track',
            artists: ['Artist A', 'Artist B'],
            album: 'Release',
            albumartists: ['Album Artist'],
            track: { no: 1 },
            date: '2026-05-29',
            genre: ['Ambient'],
            label: ['Label'],
            catalogNumber: ['CAT 01'],
          },
          format: {
            bitsPerSample: 24,
            container: 'FLAC',
            duration: 180.4,
            sampleRate: 48000,
          },
          native: {},
        }),
      },
    )

    expect(result).toMatchObject({
      path: filePath,
      format: 'flac',
      tags: {
        title: 'Track',
        artists: ['Artist A', 'Artist B'],
        album: 'Release',
        albumArtists: ['Album Artist'],
        trackNumber: 1,
        date: '2026-05-29',
        genre: ['Ambient'],
        label: 'Label',
        catalogNumber: 'CAT 01',
      },
      technical: {
        bitDepth: 24,
        durationSeconds: 180,
        sampleRate: 48000,
      },
    })
  })

  it('previews overwrite conflicts unsafe paths and supported tag formats', async () => {
    const root = await createTempRoot()
    const currentPath = path.join(root, 'old.flac')
    const existingTarget = path.join(root, 'existing.flac')
    const wavPath = path.join(root, 'old.wav')
    const wavTarget = path.join(root, 'new.wav')
    await fs.writeFile(currentPath, 'flac')
    await fs.writeFile(existingTarget, 'taken')
    await fs.writeFile(wavPath, 'wav')

    const preview = await previewLocalEdits({
      files: [
        {
          ownedItemId: 'owned-flac',
          currentPath,
          targetPath: existingTarget,
          tags: { title: 'Taken' },
        },
        {
          ownedItemId: 'owned-unsafe',
          currentPath,
          targetPath: 'relative.mp3',
          tags: { title: 'Unsafe' },
        },
        {
          ownedItemId: 'owned-wav',
          currentPath: wavPath,
          targetPath: wavTarget,
          tags: { title: 'Rename only' },
        },
      ],
    })

    expect(preview.ok).toBe(false)
    expect(preview.changes[0].issues).toContainEqual(
      expect.objectContaining({ code: 'target_exists' }),
    )
    expect(preview.changes[1].issues).toContainEqual(
      expect.objectContaining({ code: 'target_path_absolute_required' }),
    )
    expect(preview.changes[2]).toMatchObject({
      format: 'wav',
      tagWritable: false,
    })
    expect(preview.changes[2].issues).toContainEqual(
      expect.objectContaining({ code: 'tags_unsupported' }),
    )
  })

  it('applies safe changes writes operation logs and returns updated file identity', async () => {
    const root = await createTempRoot()
    const logRoot = path.join(root, 'logs')
    const currentPath = path.join(root, 'old.flac')
    const targetPath = path.join(root, 'new release', 'new.flac')
    const audioBytes = Buffer.from('edited audio')
    const tagAdapter = {
      readTags: vi.fn().mockResolvedValue({ title: 'Old title' }),
      writeTags: vi.fn().mockResolvedValue(undefined),
    }
    await fs.writeFile(currentPath, audioBytes)

    const result = await applyLocalEdits(
      {
        files: [
          {
            ownedItemId: 'owned-1',
            currentPath,
            targetPath,
            tags: {
              title: 'New title',
              artists: ['Artist'],
              trackNumber: 1,
              DJMIXER: ['Custom Mixer'],
            },
          },
        ],
      },
      { logRoot, tagAdapter },
    )

    const log = JSON.parse(await fs.readFile(result.operationLogPath, 'utf8'))
    await expect(fs.stat(currentPath)).rejects.toThrow()
    await expect(fs.stat(targetPath)).resolves.toBeTruthy()
    expect(tagAdapter.writeTags).toHaveBeenCalledWith(currentPath, {
      title: 'New title',
      artists: ['Artist'],
      trackNumber: 1,
      DJMIXER: ['Custom Mixer'],
    })
    expect(result).toMatchObject({
      applied: true,
      files: [
        {
          ownedItemId: 'owned-1',
          path: targetPath,
          format: 'flac',
          sizeBytes: audioBytes.length,
          contentHash: crypto
            .createHash('sha256')
            .update(audioBytes)
            .digest('hex'),
        },
      ],
    })
    expect(log.operations[0]).toMatchObject({
      ownedItemId: 'owned-1',
      previousPath: currentPath,
      nextPath: targetPath,
      previousTags: { title: 'Old title' },
      result: 'applied',
    })
  })

  it('maps multi-value artist tags to comma-separated TagLib fields', () => {
    expect(
      toTagLibTags({
        artists: ['Run-DMC', 'Jason Nevins'],
        albumArtists: ['Run-DMC', 'Jason Nevins'],
        genre: ['Electronic', 'Dance'],
      }),
    ).toMatchObject({
      artist: 'Run-DMC, Jason Nevins',
      albumArtist: 'Run-DMC, Jason Nevins',
      genre: 'Electronic, Dance',
    })
  })

  it('renames a shared release folder before file names so auxiliary files move with the tracks', async () => {
    const root = await createTempRoot()
    const logRoot = path.join(root, 'logs')
    const currentReleaseRoot = path.join(root, 'Old Release')
    const targetReleaseRoot = path.join(root, '[CAT 01, 2026] Artist - Release')
    const firstCurrentPath = path.join(currentReleaseRoot, '01 Old.flac')
    const secondCurrentPath = path.join(currentReleaseRoot, '02 Old.flac')
    const firstTargetPath = path.join(targetReleaseRoot, '01 New.flac')
    const secondTargetPath = path.join(targetReleaseRoot, '02 New.flac')
    const coverPath = path.join(targetReleaseRoot, 'cover.jpg')
    await fs.mkdir(currentReleaseRoot, { recursive: true })
    await fs.writeFile(firstCurrentPath, 'first audio')
    await fs.writeFile(secondCurrentPath, 'second audio')
    await fs.writeFile(path.join(currentReleaseRoot, 'cover.jpg'), 'cover')

    const result = await applyLocalEdits(
      {
        files: [
          {
            ownedItemId: 'owned-1',
            currentPath: firstCurrentPath,
            targetPath: firstTargetPath,
          },
          {
            ownedItemId: 'owned-2',
            currentPath: secondCurrentPath,
            targetPath: secondTargetPath,
          },
        ],
      },
      { logRoot },
    )

    await expect(fs.stat(currentReleaseRoot)).rejects.toThrow()
    await expect(fs.stat(firstTargetPath)).resolves.toBeTruthy()
    await expect(fs.stat(secondTargetPath)).resolves.toBeTruthy()
    await expect(fs.stat(coverPath)).resolves.toBeTruthy()
    expect(result.applied).toBe(true)
  })

  it('recovers a partial folder rename when target files already exist and old folder has remaining files', async () => {
    const root = await createTempRoot()
    const logRoot = path.join(root, 'logs')
    const currentReleaseRoot = path.join(root, 'Old Release')
    const targetReleaseRoot = path.join(root, '[CAT 01, 2026] Artist - Release')
    const firstCurrentPath = path.join(currentReleaseRoot, '01 Old.flac')
    const secondCurrentPath = path.join(currentReleaseRoot, '02 Old.flac')
    const firstTargetPath = path.join(targetReleaseRoot, '01 New.flac')
    const secondTargetPath = path.join(targetReleaseRoot, '02 New.flac')
    await fs.mkdir(currentReleaseRoot, { recursive: true })
    await fs.mkdir(targetReleaseRoot, { recursive: true })
    await fs.writeFile(path.join(currentReleaseRoot, 'release.cue'), 'cue')
    await fs.writeFile(firstTargetPath, 'first audio')
    await fs.writeFile(secondTargetPath, 'second audio')

    const result = await applyLocalEdits(
      {
        files: [
          {
            ownedItemId: 'owned-1',
            currentPath: firstCurrentPath,
            targetPath: firstTargetPath,
          },
          {
            ownedItemId: 'owned-2',
            currentPath: secondCurrentPath,
            targetPath: secondTargetPath,
          },
        ],
      },
      { logRoot },
    )

    await expect(fs.stat(currentReleaseRoot)).rejects.toThrow()
    await expect(
      fs.stat(path.join(targetReleaseRoot, 'release.cue')),
    ).resolves.toBeTruthy()
    expect(result).toMatchObject({
      applied: true,
      files: [
        expect.objectContaining({
          ownedItemId: 'owned-1',
          path: firstTargetPath,
        }),
        expect.objectContaining({
          ownedItemId: 'owned-2',
          path: secondTargetPath,
        }),
      ],
    })
  })

  it('returns operation failures as row issues when a rename cannot be written', async () => {
    const root = await createTempRoot()
    const logRoot = path.join(root, 'logs')
    const currentPath = path.join(root, 'old.flac')
    const blockedParentPath = path.join(root, 'blocked-parent')
    const targetPath = path.join(blockedParentPath, 'new.flac')
    await fs.writeFile(currentPath, 'audio')
    await fs.writeFile(blockedParentPath, 'not a directory')

    const result = await applyLocalEdits(
      {
        files: [
          {
            ownedItemId: 'owned-blocked',
            currentPath,
            targetPath,
          },
        ],
      },
      { logRoot },
    )

    const log = JSON.parse(await fs.readFile(result.operationLogPath, 'utf8'))
    await expect(fs.stat(currentPath)).resolves.toBeTruthy()
    expect(result.applied).toBe(false)
    expect(result.changes).toEqual([
      expect.objectContaining({
        ownedItemId: 'owned-blocked',
        issues: [
          expect.objectContaining({
            code: 'local_edit_failed',
            severity: 'error',
          }),
        ],
      }),
    ])
    expect(log.operations[0]).toMatchObject({
      ownedItemId: 'owned-blocked',
      result: 'failed',
    })
  })

  it('applies tag-only changes and preserves explicit clear requests', async () => {
    const root = await createTempRoot()
    const logRoot = path.join(root, 'logs')
    const currentPath = path.join(root, 'track.flac')
    const audioBytes = Buffer.from('tagged audio')
    const tagAdapter = {
      readTags: vi.fn().mockResolvedValue({
        title: 'Old title',
        artist: 'Old Artist',
      }),
      writeTags: vi.fn().mockResolvedValue(undefined),
    }
    await fs.writeFile(currentPath, audioBytes)

    const result = await applyLocalEdits(
      {
        files: [
          {
            ownedItemId: 'owned-tag-only',
            currentPath,
            targetPath: currentPath,
            tags: {
              title: null,
              artists: [],
              album: 'New album',
            },
          },
        ],
      },
      { logRoot, tagAdapter },
    )

    const log = JSON.parse(await fs.readFile(result.operationLogPath, 'utf8'))
    await expect(fs.stat(currentPath)).resolves.toBeTruthy()
    expect(tagAdapter.writeTags).toHaveBeenCalledWith(currentPath, {
      title: null,
      artists: [],
      album: 'New album',
    })
    expect(result).toMatchObject({
      applied: true,
      files: [
        {
          ownedItemId: 'owned-tag-only',
          path: currentPath,
          format: 'flac',
          contentHash: crypto
            .createHash('sha256')
            .update(audioBytes)
            .digest('hex'),
        },
      ],
    })
    expect(log.operations[0]).toMatchObject({
      ownedItemId: 'owned-tag-only',
      previousPath: currentPath,
      nextPath: currentPath,
      previousTags: { title: 'Old title', artist: 'Old Artist' },
      requestedTags: {
        title: null,
        artists: [],
        album: 'New album',
      },
      result: 'applied',
    })
  })

  it('blocks unsupported tag-only writes instead of silently applying them', async () => {
    const root = await createTempRoot()
    const currentPath = path.join(root, 'track.wav')
    await fs.writeFile(currentPath, 'wav')

    const result = await applyLocalEdits({
      files: [
        {
          ownedItemId: 'owned-wav',
          currentPath,
          targetPath: currentPath,
          tags: { title: 'New title' },
        },
      ],
    })

    expect(result).toMatchObject({
      applied: false,
      operationLogPath: null,
      files: [],
      changes: [
        expect.objectContaining({
          ownedItemId: 'owned-wav',
          issues: [
            expect.objectContaining({
              code: 'tags_unsupported',
              severity: 'error',
            }),
          ],
        }),
      ],
    })
  })
})
