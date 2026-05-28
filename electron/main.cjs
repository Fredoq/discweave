const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fsp = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { resolveBackendBaseUrl } = require('./backend-config.cjs')
const { scanFolder } = require('./scanner.cjs')

const backendBaseUrl = resolveBackendBaseUrl()
const devServerUrl = process.env.CRATEBASE_DESKTOP_DEV_SERVER
const cookieJar = new Map()
const strippedProxyResponseHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'set-cookie',
  'transfer-encoding',
])
const exportDownloads = {
  csv: {
    accept: 'application/zip',
    defaultPath: 'cratebase-export-csv.zip',
    endpoint: '/api/exports/csv',
    filters: [{ name: 'ZIP archives', extensions: ['zip'] }],
    title: 'Save CSV export',
  },
  json: {
    accept: 'application/json',
    defaultPath: 'cratebase-export.json',
    endpoint: '/api/exports/json',
    filters: [{ name: 'JSON files', extensions: ['json'] }],
    title: 'Save JSON export',
  },
}

let desktopServer = null

app.whenReady().then(async () => {
  const appUrl = devServerUrl ?? (await startDesktopServer())
  createWindow(appUrl)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(appUrl)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  desktopServer?.close()
})

ipcMain.handle('cratebase:imports:pick-and-scan', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Choose import folder',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true }
  }

  const scan = await scanFolder(result.filePaths[0])
  return { cancelled: false, scan }
})

ipcMain.handle('cratebase:exports:download', async (event, format) => {
  if (typeof format !== 'string' || !Object.hasOwn(exportDownloads, format)) {
    throw new Error('Unsupported export format.')
  }

  const download = exportDownloads[format]
  const result = await dialog.showSaveDialog({
    defaultPath: download.defaultPath,
    filters: download.filters,
    title: download.title,
  })

  if (result.canceled || !result.filePath) {
    return { cancelled: true }
  }

  const content = await fetchExportContent(download, event.sender)
  await fsp.writeFile(result.filePath, content)
  return { cancelled: false, path: result.filePath }
})

function createWindow(appUrl) {
  const window = new BrowserWindow({
    height: 960,
    minHeight: 720,
    minWidth: 1120,
    title: 'Cratebase',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
    },
    width: 1440,
  })

  const allowedOrigin = new URL(appUrl).origin
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedNavigation(url, allowedOrigin)) {
      return { action: 'allow' }
    }

    openExternalNavigation(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedNavigation(url, allowedOrigin)) {
      return
    }

    event.preventDefault()
    openExternalNavigation(url)
  })

  window.loadURL(appUrl)
}

function isTrustedNavigation(url, allowedOrigin) {
  try {
    return new URL(url).origin === allowedOrigin
  } catch {
    return false
  }
}

function openExternalNavigation(url) {
  try {
    const target = new URL(url)
    if (target.protocol === 'http:' || target.protocol === 'https:') {
      void shell.openExternal(target.toString())
    }
  } catch {
    // Ignore malformed renderer-provided URLs.
  }
}

async function startDesktopServer() {
  const distDir = path.resolve(__dirname, '..', 'dist')
  desktopServer = http.createServer(async (request, response) => {
    try {
      if (request.url?.startsWith('/api')) {
        await proxyApiRequest(request, response)
        return
      }

      await serveStaticFile(distDir, request, response)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(
        error instanceof Error ? error.message : 'Desktop server error',
      )
    }
  })

  await new Promise((resolve) => {
    desktopServer.listen(0, '127.0.0.1', resolve)
  })

  const address = desktopServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Desktop server did not bind to a TCP port')
  }

  return `http://127.0.0.1:${address.port}`
}

async function proxyApiRequest(request, response) {
  const targetUrl = new URL(request.url, backendBaseUrl)
  const headers = copyProxyHeaders(request.headers)
  const cookieHeader = currentProxyCookieHeader()
  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  const backendResponse = await fetch(targetUrl, {
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await readRequestBody(request),
    headers,
    method: request.method,
    redirect: 'manual',
  })

  storeCookies(backendResponse.headers)
  response.writeHead(
    backendResponse.status,
    backendResponse.statusText,
    responseHeaders(backendResponse.headers),
  )
  response.end(Buffer.from(await backendResponse.arrayBuffer()))
}

async function fetchExportContent(download, webContents) {
  const targetUrl = new URL(download.endpoint, backendBaseUrl)
  const headers = new Headers({ accept: download.accept })
  const cookieHeader = await currentExportCookieHeader(webContents)
  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  const backendResponse = await fetch(targetUrl, {
    headers,
    redirect: 'manual',
  })

  storeCookies(backendResponse.headers)
  if (!backendResponse.ok) {
    throw new Error(await exportFailureMessage(backendResponse))
  }

  return Buffer.from(await backendResponse.arrayBuffer())
}

async function exportFailureMessage(response) {
  const fallback = `Export failed with status ${response.status}.`
  const text = await response.text()
  if (!text) {
    return fallback
  }

  try {
    const body = JSON.parse(text)
    if (typeof body.detail === 'string') {
      return body.detail
    }
    if (typeof body.error === 'string') {
      return body.error
    }
    if (typeof body.title === 'string') {
      return body.title
    }
  } catch {
    // Non-JSON backend errors should not leak raw response bodies into UI.
  }

  return fallback
}

async function currentExportCookieHeader(webContents) {
  const cookies = new Map(cookieJar)
  const rendererUrl = rendererCookieUrl(webContents)
  if (rendererUrl) {
    for (const cookie of await webContents.session.cookies.get({
      url: rendererUrl,
    })) {
      cookies.set(cookie.name, `${cookie.name}=${cookie.value}`)
    }
  }

  return [...cookies.values()].join('; ')
}

function rendererCookieUrl(webContents) {
  try {
    const currentUrl = webContents.getURL()
    if (currentUrl) {
      return new URL('/', currentUrl).toString()
    }
  } catch {
    return null
  }

  return null
}

function copyProxyHeaders(headers) {
  const copied = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (!value || ['host', 'connection', 'content-length'].includes(name)) {
      continue
    }

    copied.set(name, Array.isArray(value) ? value.join(', ') : value)
  }

  return copied
}

function responseHeaders(headers) {
  const copied = {}
  headers.forEach((value, key) => {
    if (!strippedProxyResponseHeaders.has(key.toLowerCase())) {
      copied[key] = value
    }
  })
  return copied
}

function currentProxyCookieHeader() {
  return [...cookieJar.values()].join('; ')
}

function storeCookies(headers) {
  const setCookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : splitSetCookie(headers.get('set-cookie'))

  for (const cookie of setCookies) {
    const pair = cookie.split(';', 1)[0]
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    cookieJar.set(pair.slice(0, separatorIndex), pair)
  }
}

function splitSetCookie(value) {
  if (!value) {
    return []
  }

  return value.split(/,(?=\s*[^;,]+=)/)
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

async function serveStaticFile(distDir, request, response) {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
  const requestedPath =
    requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname
  const candidate = safeStaticCandidate(distDir, requestedPath)
  const filePath = candidate ? await existingFile(candidate) : null
  const finalPath = filePath ?? path.join(distDir, 'index.html')

  response.writeHead(200, { 'content-type': contentType(finalPath) })
  response.end(await fsp.readFile(finalPath))
}

function safeStaticCandidate(distDir, requestedPath) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(requestedPath)
  } catch {
    return null
  }

  const candidate = path.normalize(path.join(distDir, decodedPath))
  const relative = path.relative(distDir, candidate)
  return relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
    ? candidate
    : null
}

async function existingFile(filePath) {
  try {
    const stat = await fsp.stat(filePath)
    return stat.isFile() ? filePath : null
  } catch {
    return null
  }
}

function contentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}
