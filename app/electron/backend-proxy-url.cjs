const desktopRequestProtocol = 'discweave-desktop:'
const desktopRequestHost = 'local'
const desktopRequestBaseUrl = `${desktopRequestProtocol}//${desktopRequestHost}`
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
  const proxyRequest = resolveBackendProxyRequest(requestUrl, backendBaseUrl)

  return new URL(proxyRequest.path, proxyRequest.origin)
}

function resolveBackendProxyRequest(requestUrl, backendBaseUrl) {
  const backendUrl = parseAllowedBackendBaseUrl(backendBaseUrl)
  const apiUrl = parseApiProxyRequestUrl(requestUrl)

  return {
    hostname: backendUrl.hostname,
    origin: backendUrl.origin,
    path: `${apiUrl.pathname}${apiUrl.search}`,
    port: backendUrl.port,
    protocol: backendUrl.protocol,
  }
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

  const apiUrl = new URL(requestUrl, desktopRequestBaseUrl)
  if (
    apiUrl.protocol !== desktopRequestProtocol ||
    apiUrl.host !== desktopRequestHost ||
    !isApiProxyPath(apiUrl.pathname)
  ) {
    throw new Error(rejectedProxyTargetMessage)
  }

  return apiUrl
}

function isApiProxyPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function parseAllowedBackendBaseUrl(backendBaseUrl) {
  const backendUrl = new URL(backendBaseUrl)
  if (!isAllowedBackendOrigin(backendUrl)) {
    throw new Error(rejectedProxyTargetMessage)
  }

  return backendUrl
}

function isAllowedBackendOrigin(backendUrl) {
  if (backendUrl.protocol === 'https:') {
    return true
  }

  return (
    backendUrl.protocol === 'http:' && isLoopbackHostname(backendUrl.hostname)
  )
}

function isLoopbackHostname(hostname) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  )
}

module.exports = {
  isApiProxyRequestUrl,
  resolveBackendProxyRequest,
  resolveBackendProxyUrl,
}
