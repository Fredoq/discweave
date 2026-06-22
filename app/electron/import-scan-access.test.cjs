// @vitest-environment node

const { createImportScanAccess } = require('./import-scan-access.cjs')

describe('desktop import scan access', () => {
  it('does not scan an untrusted rescan source when folder confirmation is cancelled', async () => {
    const scanFolder = vi.fn()
    const showOpenDialog = vi
      .fn()
      .mockResolvedValue({ canceled: true, filePaths: [] })
    const access = createImportScanAccess({
      dialog: { showOpenDialog },
      manifestRoot: () => '/app/scan-manifests',
      scanFolder,
    })

    await expect(
      access.rescanSource('/Users/example/Music', { mode: 'full' }),
    ).rejects.toThrow('Source folder confirmation cancelled.')

    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: '/Users/example/Music',
        properties: ['openDirectory'],
      }),
    )
    expect(scanFolder).not.toHaveBeenCalled()
  })

  it('rescans a source selected through the native picker without prompting again', async () => {
    const scanFolder = vi
      .fn()
      .mockResolvedValueOnce({ sourceRoot: '/Users/example/Music', files: [] })
      .mockResolvedValueOnce({ sourceRoot: '/Users/example/Music', files: [] })
    const showOpenDialog = vi
      .fn()
      .mockResolvedValue({ canceled: false, filePaths: ['/Users/example/Music'] })
    const access = createImportScanAccess({
      dialog: { showOpenDialog },
      manifestRoot: () => '/app/scan-manifests',
      scanFolder,
    })

    await expect(access.pickAndScan({ mode: 'full' })).resolves.toEqual({
      cancelled: false,
      scan: { sourceRoot: '/Users/example/Music', files: [] },
    })
    await expect(
      access.rescanSource('/Users/example/Music', { mode: 'namesOnly' }),
    ).resolves.toEqual({ sourceRoot: '/Users/example/Music', files: [] })

    expect(showOpenDialog).toHaveBeenCalledTimes(1)
    expect(scanFolder).toHaveBeenNthCalledWith(2, '/Users/example/Music', {
      manifestRoot: '/app/scan-manifests',
      mode: 'namesOnly',
    })
  })

  it('rejects confirmation when the selected folder does not match the requested source', async () => {
    const scanFolder = vi.fn()
    const showOpenDialog = vi
      .fn()
      .mockResolvedValue({ canceled: false, filePaths: ['/Users/example/Other'] })
    const access = createImportScanAccess({
      dialog: { showOpenDialog },
      manifestRoot: () => '/app/scan-manifests',
      scanFolder,
    })

    await expect(
      access.rescanSource('/Users/example/Music', { mode: 'full' }),
    ).rejects.toThrow('Selected folder must match the original import source.')

    expect(scanFolder).not.toHaveBeenCalled()
  })
})
