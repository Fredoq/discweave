import { useEffect, useRef, useState } from 'react'
import {
  createRecommendedReleaseDraft,
  discoverBridge,
  saveDiscoverFeedback,
} from './discoverApi'
import type {
  DiscoverFeedback,
  DiscoverMode,
  DiscoverRelease,
  DiscoverResult,
  DiscoverStatus,
  DiscoverRequest,
} from './discoverTypes'

export function useDiscover(
  onNavigateToUrl: (href: string) => boolean,
  refresh: number,
  context: Pick<DiscoverRequest, 'releaseId' | 'trackId'>,
) {
  const bridge = discoverBridge()
  const [status, setStatus] = useState<DiscoverStatus | null>(null)
  const [result, setResult] = useState<DiscoverResult | null>(null)
  const [pending, setPending] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const current = useRef(0)
  const active = useRef(false)
  const busy = useRef(false)
  const mounted = useRef(false)
  const actionController = useRef<AbortController | null>(null)
  const draftKeys = useRef(new Map<string, string>())

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      current.current += 1
      actionController.current?.abort()
      if (active.current) void bridge?.cancel().catch(() => undefined)
    }
  }, [bridge])

  useEffect(() => {
    let valid = true
    void bridge
      ?.status()
      .then((next) => {
        if (valid) setStatus(next)
      })
      .catch(() => {
        if (valid) setError('Recommendation settings could not be loaded.')
      })
    return () => {
      valid = false
    }
  }, [bridge, refresh])

  async function generate(mode: DiscoverMode) {
    if (
      !bridge ||
      active.current ||
      busy.current ||
      !status?.configured ||
      !status.consented
    )
      return
    const request = ++current.current
    active.current = true
    setPending(true)
    setError('')
    setNotice('')
    try {
      const next = await bridge.generate({ mode, ...context })
      if (mounted.current && current.current === request) setResult(next)
    } catch {
      if (mounted.current && current.current === request)
        setError(
          'Recommendations could not be generated. Check your OpenAI and Discogs settings, then try again. Previous results are unchanged.',
        )
    } finally {
      if (mounted.current && current.current === request) {
        active.current = false
        setPending(false)
      }
    }
  }

  async function cancel() {
    if (!bridge || !active.current) return
    current.current += 1
    setNotice('Cancelling generation…')
    try {
      await bridge.cancel()
    } catch {
      // Late replies are ignored even if transport cancellation fails.
    } finally {
      active.current = false
      if (mounted.current) {
        setPending(false)
        setNotice('Generation cancelled. Previous results are unchanged.')
      }
    }
  }

  async function act(
    release: DiscoverRelease,
    kind: DiscoverFeedback | 'wanted',
  ) {
    if (busy.current || active.current) return
    busy.current = true
    setActionPending(true)
    setError('')
    setNotice('')
    const controller = new AbortController()
    actionController.current = controller
    try {
      if (kind === 'wanted') {
        let key = draftKeys.current.get(release.externalId)
        if (!key) {
          key = crypto.randomUUID()
          draftKeys.current.set(release.externalId, key)
        }
        const session = await createRecommendedReleaseDraft(
          release.externalId,
          key,
          controller.signal,
        )
        if (!mounted.current) return
        const draft = session.drafts?.[0]
        if (!draft) throw new Error('Missing review draft')
        const params = new URLSearchParams({
          session: session.id,
          draft: draft.id,
        })
        setNotice(
          'Review the release and choose a medium in Imports before adding it to Wanted.',
        )
        onNavigateToUrl(`/imports?${params.toString()}`)
      } else {
        await saveDiscoverFeedback(release.externalId, kind, controller.signal)
        if (!mounted.current) return
        setResult((previous) =>
          previous
            ? {
                ...previous,
                items: previous.items.filter(
                  (item) => item.externalId !== release.externalId,
                ),
              }
            : previous,
        )
        setNotice(
          kind === 'notInterested'
            ? 'Saved as not interested.'
            : 'Marked already known. This is not a dislike rating.',
        )
      }
    } catch {
      if (mounted.current)
        setError(
          kind === 'wanted'
            ? 'The review could not be opened. Retry, or check Imports for a draft already created. Nothing has been added to Wanted.'
            : 'Feedback could not be saved. The release is unchanged.',
        )
    } finally {
      busy.current = false
      if (mounted.current) setActionPending(false)
    }
  }

  return {
    status,
    result,
    pending,
    actionPending,
    error,
    notice,
    generate,
    cancel,
    act,
  }
}
