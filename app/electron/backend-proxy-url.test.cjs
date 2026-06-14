// @vitest-environment node

const {
  isApiProxyRequestUrl,
  resolveBackendProxyUrl,
} = require('./backend-proxy-url.cjs')

describe('desktop backend proxy URL', () => {
  const backendBaseUrl = `${'http'}://127.0.0.1:5310`

  it('resolves API request paths against the configured backend origin', () => {
    expect(
      resolveBackendProxyUrl(
        '/api/releases?limit=10',
        backendBaseUrl,
      ).toString(),
    ).toBe(`${backendBaseUrl}/api/releases?limit=10`)
  })

  it('accepts the API root path', () => {
    expect(resolveBackendProxyUrl('/api', backendBaseUrl).toString()).toBe(
      `${backendBaseUrl}/api`,
    )
  })

  it('accepts HTTPS development backend targets', () => {
    expect(
      resolveBackendProxyUrl(
        '/api/releases?limit=10',
        'https://discweave.example.test',
      ).toString(),
    ).toBe('https://discweave.example.test/api/releases?limit=10')
  })

  it('rejects clear-text non-loopback backend targets', () => {
    expect(() =>
      resolveBackendProxyUrl('/api/releases', `${'http'}://192.168.0.1:5094`),
    ).toThrow('Desktop API proxy target is not allowed.')
  })

  it.each([
    ['absolute URL', 'https://example.test/api/releases'],
    ['protocol-relative URL', '//example.test/api/releases'],
    ['non-API path', '/settings'],
    ['API prefix sibling', '/apiary'],
    ['empty target', ''],
    ['missing target', undefined],
  ])('rejects %s request targets', (_name, requestUrl) => {
    expect(() => resolveBackendProxyUrl(requestUrl, backendBaseUrl)).toThrow(
      'Desktop API proxy target is not allowed.',
    )
    expect(isApiProxyRequestUrl(requestUrl)).toBe(false)
  })
})
