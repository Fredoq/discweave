// @vitest-environment node

const { splitSetCookie } = require('./set-cookie-header.cjs')

describe('desktop Set-Cookie header parsing', () => {
  it('splits combined cookies without splitting Expires dates', () => {
    expect(
      splitSetCookie(
        'DiscWeave.Auth=abc; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/; HttpOnly, DiscWeave.Refresh=def; Path=/api',
      ),
    ).toEqual([
      'DiscWeave.Auth=abc; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/; HttpOnly',
      'DiscWeave.Refresh=def; Path=/api',
    ])
  })

  it('ignores empty fallback header values', () => {
    expect(splitSetCookie('')).toEqual([])
    expect(splitSetCookie(null)).toEqual([])
  })
})
