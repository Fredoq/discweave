// @vitest-environment node

const { resolveBackendBaseUrl } = require('./backend-config.cjs')

describe('desktop backend configuration', () => {
  const originalApiBaseUrl = process.env.DISCWEAVE_API_BASE_URL

  afterEach(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.DISCWEAVE_API_BASE_URL
    } else {
      process.env.DISCWEAVE_API_BASE_URL = originalApiBaseUrl
    }
  })

  it('uses the local API by default for packaged desktop builds', () => {
    delete process.env.DISCWEAVE_API_BASE_URL

    expect(resolveBackendBaseUrl({ isPackaged: true })).toBe(
      'http://localhost:5094',
    )
  })

  it('allows the backend URL to be overridden for hosted deployments', () => {
    process.env.DISCWEAVE_API_BASE_URL = 'https://discweave.example.test'

    expect(resolveBackendBaseUrl({ isPackaged: true })).toBe(
      'https://discweave.example.test',
    )
  })
})
