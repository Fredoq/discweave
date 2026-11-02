const { randomUUID } = require('node:crypto')
const { MAX_OUTPUT_TOKENS } = require('./discover-openai.cjs')

const LIMITS = {
  requestsPerHour: 6,
  maxOutputTokens: MAX_OUTPUT_TOKENS,
  timeoutSeconds: 180,
}

function createDiscoverBroker({ vault, provider, backend, now = Date.now }) {
  let active = null
  let requests = []

  function requireAvailableRequest() {
    requests = requests.filter((time) => time > now() - 3600000)
    if (requests.length >= LIMITS.requestsPerHour)
      throw new Error('Discover reached its six-request hourly session limit')
  }

  function consumeRequest(signal) {
    signal.throwIfAborted()
    requireAvailableRequest()
    requests.push(now())
  }

  function cancel() {
    active?.abort()
  }
  async function status() {
    return { ...(await vault.status()), limits: LIMITS }
  }

  async function run(webContents, action) {
    if (active) throw new Error('A Discover request is already running')
    const controller = new AbortController()
    active = controller
    const timer = setTimeout(
      () => controller.abort(),
      LIMITS.timeoutSeconds * 1000,
    )
    const onDestroyed = () => controller.abort()
    webContents?.once?.('destroyed', onDestroyed)
    const onNavigation = (_event, _url, _isInPlace, isMainFrame) => {
      if (isMainFrame) controller.abort()
    }
    webContents?.on?.('did-start-navigation', onNavigation)
    try {
      const credentials = await vault.credentials()
      if (webContents?.isDestroyed?.()) controller.abort()
      controller.signal.throwIfAborted()
      if (!credentials?.consented)
        throw new Error(
          'Discover requires a saved OpenAI key and consent to metadata sharing',
        )
      requireAvailableRequest()
      const result = await action(credentials, controller.signal, () =>
        consumeRequest(controller.signal),
      )
      controller.signal.throwIfAborted()
      return result
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error('Discover was cancelled or timed out')
      // Only module-authored errors are surfaced, never provider/transport bodies.
      const safe =
        /^(OpenAI |The taste profile |Rate some releases |Catalog verification |Discover )/.test(
          error?.message ?? '',
        )
      throw new Error(
        safe
          ? error.message
          : 'Discover could not complete the request. Your previous results are unchanged.',
      )
    } finally {
      clearTimeout(timer)
      webContents?.removeListener?.('destroyed', onDestroyed)
      webContents?.removeListener?.('did-start-navigation', onNavigation)
      if (active === controller) active = null
    }
  }

  return {
    status,
    save: async (request) => {
      cancel()
      await vault.save(request)
      return await status()
    },
    remove: async () => {
      cancel()
      await vault.remove()
      return await status()
    },
    cancel,
    test: (sender) =>
      run(sender, (credentials, signal, beforeRequest) =>
        provider.test(credentials, signal, beforeRequest),
      ),
    generate: (sender, request) => {
      const query = profileQuery(request)
      return run(sender, async (credentials, signal, beforeRequest) => {
        const catalogStatus = await backend(
          sender,
          '/api/settings/integrations/discogs',
          { signal },
        )
        signal.throwIfAborted()
        if (
          catalogStatus?.configured !== true ||
          catalogStatus?.enabled !== true
        ) {
          throw new Error(
            'Discover requires a configured Discogs connection before generation',
          )
        }
        const profile = await backend(
          sender,
          `/api/discover/profile?${query}`,
          { signal },
        )
        signal.throwIfAborted()
        const leads = await provider.generate(
          credentials,
          profile,
          request.mode,
          signal,
          beforeRequest,
        )
        signal.throwIfAborted()
        return await backend(sender, '/api/discover/resolve', {
          signal,
          body: { profileToken: profile.profileToken, leads },
        })
      })
    },
  }
}

function profileQuery(request) {
  if (!['familiar', 'adventurous'].includes(request?.mode))
    throw new Error('Discover mode is invalid')
  const query = new URLSearchParams({ seed: randomUUID(), mode: request.mode })
  for (const key of ['releaseId', 'trackId']) {
    if (request[key] === undefined) continue
    if (
      typeof request[key] !== 'string' ||
      !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(request[key])
    )
      throw new Error('Discover source is invalid')
    query.set(key, request[key])
  }
  if (request.releaseId && request.trackId)
    throw new Error('Discover accepts only one contextual source')
  return query
}

module.exports = { createDiscoverBroker, LIMITS }
