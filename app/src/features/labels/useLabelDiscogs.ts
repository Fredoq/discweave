import { useEffect, useRef, useState } from 'react'
import { createRecommendedReleaseDraft } from '../discover/discoverApi'
import {
  labelDiscogsApi,
  type DiscogsLabelCandidate,
  type LabelDiscogsPage,
  type LabelDiscogsPreferences,
  type LabelDiscogsRelease,
} from './labelDiscogsApi'

export function useLabelDiscogs(
  labelId: string,
  onNavigate: (url: string) => boolean,
) {
  const [preferences, setPreferences] =
    useState<LabelDiscogsPreferences | null>(null)
  const [candidates, setCandidates] = useState<DiscogsLabelCandidate[]>([])
  const [searchTotal, setSearchTotal] = useState<number | null>(null)
  const [searched, setSearched] = useState(false)
  const [items, setItems] = useState<LabelDiscogsRelease[]>([])
  const [page, setPage] = useState<LabelDiscogsPage | null>(null)
  const [loadedCount, setLoadedCount] = useState(0)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const draftKeys = useRef(new Map<string, string>())

  async function run(
    action: (signal: AbortSignal) => Promise<void>,
    failure: string,
  ) {
    if (active.current) return false
    const controller = new AbortController()
    active.current = controller
    setPending(true)
    setError('')
    setNotice('')
    try {
      await action(controller.signal)
      return mounted.current && !controller.signal.aborted
    } catch {
      if (mounted.current && !controller.signal.aborted) setError(failure)
      return false
    } finally {
      if (active.current === controller) active.current = null
      if (mounted.current && !controller.signal.aborted) setPending(false)
    }
  }

  function acceptPage(
    next: LabelDiscogsPage,
    signal: AbortSignal,
    expectedLabelId: string,
    expectedPage: number,
    replace = false,
  ) {
    if (signal.aborted || !mounted.current) return
    if (next.discogsLabelId !== expectedLabelId || next.page !== expectedPage) {
      throw new Error('Catalog selection or page changed; reload preferences')
    }
    setPage(next)
    setLoadedCount((previous) =>
      replace ? next.items.length : previous + next.items.length,
    )
    setItems((previous) => [
      ...new Map(
        (replace ? next.items : [...previous, ...next.items]).map((item) => [
          `${item.externalId}\u0000${item.catalogNumber}`,
          item,
        ]),
      ).values(),
    ])
  }

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    active.current = controller
    void (async () => {
      try {
        const next = await labelDiscogsApi.preferences(
          labelId,
          controller.signal,
        )
        if (!mounted.current || controller.signal.aborted) return
        setPreferences(next)
        if (next.discogsLabelId)
          acceptPage(
            await labelDiscogsApi.page(labelId, 1, controller.signal),
            controller.signal,
            next.discogsLabelId,
            1,
            true,
          )
      } catch {
        if (mounted.current && !controller.signal.aborted)
          setError(
            'The Discogs catalog could not be loaded. Check Discogs in Settings and retry.',
          )
      } finally {
        if (active.current === controller) active.current = null
        if (mounted.current && !controller.signal.aborted) setPending(false)
      }
    })()
    return () => {
      mounted.current = false
      active.current?.abort()
      active.current = null
    }
  }, [labelId])

  const loadMore = () =>
    run(async (signal) => {
      acceptPage(
        await labelDiscogsApi.page(labelId, (page?.page ?? 0) + 1, signal),
        signal,
        preferences?.discogsLabelId ?? '',
        (page?.page ?? 0) + 1,
      )
    }, 'More releases could not be loaded. Previous results are unchanged. Use Retry catalog to reload the saved selection and pages.')

  const search = (query: string) =>
    run(async (signal) => {
      setCandidates([])
      setSearchTotal(null)
      setSearched(false)
      const result = await labelDiscogsApi.search(labelId, query.trim(), signal)
      if (signal.aborted) return
      setCandidates(result.items)
      setSearchTotal(result.total)
      setSearched(true)
    }, 'Labels could not be searched. Check Discogs in Settings and retry.')

  const save = (discogsLabelId: string | null, prefixes: string[]) =>
    run(async (signal) => {
      const next = await labelDiscogsApi.save(
        labelId,
        discogsLabelId,
        prefixes,
        signal,
      )
      if (signal.aborted) return
      setPreferences(next)
      setNotice('Catalog preferences saved for this label.')
      if (preferences?.discogsLabelId !== next.discogsLabelId || !page) {
        setItems([])
        setPage(null)
        setLoadedCount(0)
        if (next.discogsLabelId)
          acceptPage(
            await labelDiscogsApi.page(labelId, 1, signal),
            signal,
            next.discogsLabelId,
            1,
            true,
          )
        if (signal.aborted || !mounted.current) return
        setCandidates([])
        setSearchTotal(null)
        setSearched(false)
      }
    }, 'Catalog preferences or releases could not be loaded. Retry to check the saved selection.')

  const retry = () =>
    run(async (signal) => {
      const next = await labelDiscogsApi.preferences(labelId, signal)
      if (signal.aborted) return
      setPreferences(next)
      if (
        preferences?.discogsLabelId !== next.discogsLabelId ||
        !next.discogsLabelId
      ) {
        setItems([])
        setPage(null)
        setLoadedCount(0)
      }
      if (next.discogsLabelId)
        acceptPage(
          await labelDiscogsApi.page(labelId, 1, signal),
          signal,
          next.discogsLabelId,
          1,
          true,
        )
    }, 'The Discogs catalog could not be loaded. Check Discogs in Settings and retry.')

  const wanted = (externalId: string) =>
    run(async (signal) => {
      let key = draftKeys.current.get(externalId)
      if (!key) {
        key = crypto.randomUUID()
        draftKeys.current.set(externalId, key)
      }
      const session = await createRecommendedReleaseDraft(
        externalId,
        key,
        signal,
      )
      if (signal.aborted || !mounted.current) return
      const draft = session.drafts?.[0]
      if (!draft) throw new Error('Missing review draft')
      const params = new URLSearchParams({
        session: session.id,
        draft: draft.id,
      })
      setNotice(
        'Review the release and choose a medium in Imports before adding it to Wanted.',
      )
      onNavigate(`/imports?${params.toString()}`)
    }, 'The review could not be opened. Retry, or check Imports for a draft already created. Nothing has been added to Wanted.')

  function cancel() {
    active.current?.abort()
    active.current = null
    setPending(false)
    setNotice(
      'Request cancelled. Saved preferences or review drafts may already exist; retry to check.',
    )
  }

  return {
    preferences,
    candidates,
    searchTotal,
    searched,
    items,
    page,
    loadedCount,
    pending,
    error,
    notice,
    resetSearch: () => {
      setCandidates([])
      setSearchTotal(null)
      setSearched(false)
      setError('')
    },
    search,
    save,
    retry,
    loadMore,
    wanted,
    cancel,
  }
}
