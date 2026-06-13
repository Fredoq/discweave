const desktopRequestOrigin = 'http://discweave-desktop.local'
const rejectedProxyTargetMessage = 'Desktop API proxy target is not allowed.'

function isApiProxyRequestUrl(requestUrl) {
  try {
    parseApiProxyRequestUrl(requestUrl)
    return true
  } catch {
    return false
  }
}

function resolveBackendProxyUrl(requestUrl, backendBaseUrl) {
  const backendUrl = new URL(backendBaseUrl)
  const apiUrl = parseApiProxyRequestUrl(requestUrl)

  return new URL(`${apiUrl.pathname}${apiUrl.search}`, backendUrl)
}

function parseApiProxyRequestUrl(requestUrl) {
  if (
    typeof requestUrl !== 'string' ||
    requestUrl.length === 0 ||
    !requestUrl.startsWith('/') ||
    requestUrl.startsWith('//')
  ) {
    throw new Error(rejectedProxyTargetMessage)
  }

  const apiUrl = new URL(requestUrl, desktopRequestOrigin)
  if (
    apiUrl.origin !== desktopRequestOrigin ||
    !isApiProxyPath(apiUrl.pathname)
  ) {
    throw new Error(rejectedProxyTargetMessage)
  }

  return apiUrl
}

function isApiProxyPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/')
}

module.exports = {
  isApiProxyRequestUrl,
  resolveBackendProxyUrl,
}
