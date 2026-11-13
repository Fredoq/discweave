import { useEffect, useRef, useState } from 'react'
import {
  getDiscogsRelease,
  type ExternalMetadataPartialDate,
} from '../catalog/api/externalMetadataClient'
import { CatalogApiError } from '../catalog/api/httpClient'
import type { RankedDateCandidate } from './releaseDateSearch'

type DateCheck =
  | { status: 'checked'; date: ExternalMetadataPartialDate | null }
  | { status: 'failed' }
const batchSize = 10

export function useCandidateReleaseDates(
  candidates: RankedDateCandidate[] | null,
  enabled: boolean,
) {
  const [checks, setChecks] = useState<Record<string, DateCheck>>({})
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const checksRef = useRef<Record<string, DateCheck>>({})
  const controller = useRef<AbortController | null>(null)
  const revision = useRef(0)
  const enabledRef = useRef(enabled)
  const candidatesRef = useRef(candidates)

  async function checkBatch(retry = false, initial = false) {
    if (!enabledRef.current || controller.current) return
    const version = revision.current
    const pending = (candidatesRef.current ?? [])
      .filter(({ candidate }) => {
        const check = checksRef.current[candidate.source.externalId]
        if (initial && candidate.dateEvidenceChecked !== undefined) return false
        return retry ? check?.status === 'failed' : !check
      })
      .slice(0, batchSize)
    if (!pending.length) return
    const abort = new AbortController()
    controller.current = abort
    setNotice('')
    try {
      for (const { candidate } of pending) {
        if (abort.signal.aborted || version !== revision.current) break
        const id = candidate.source.externalId
        setCheckingId(id)
        const result = await checkEditionDate(id, abort.signal)
        if (abort.signal.aborted || version !== revision.current) break
        save(id, result.check)
        if (result.stopMessage) {
          setNotice(result.stopMessage)
          break
        }
      }
    } finally {
      if (version === revision.current) {
        controller.current = null
        setCheckingId(null)
      }
    }
  }
  function save(id: string, check: DateCheck) {
    checksRef.current = { ...checksRef.current, [id]: check }
    setChecks(checksRef.current)
  }
  useEffect(() => {
    candidatesRef.current = candidates
    revision.current += 1
    controller.current?.abort()
    controller.current = null
    const initial: Record<string, DateCheck> = {}
    for (const { candidate } of candidates ?? []) {
      if (candidate.dateEvidenceChecked !== true) continue
      try {
        if (
          candidate.source.providerName.toLowerCase() !== 'discogs' ||
          candidate.source.resourceType !== 'release'
        )
          throw new Error('Unexpected source')
        initial[candidate.source.externalId] = {
          status: 'checked',
          date: validatedDate(candidate.releaseDateEvidence),
        }
      } catch {
        initial[candidate.source.externalId] = { status: 'failed' }
      }
    }
    checksRef.current = initial
    let current = true
    void Promise.resolve().then(() => {
      if (!current) return
      setChecks(initial)
      setNotice('')
      setCheckingId(null)
      if (enabledRef.current) void checkBatch(false, true)
    })
    return () => {
      current = false
      revision.current += 1
      controller.current?.abort()
      controller.current = null
    }
    // A new result set starts a new bounded batch; toggling the preview must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates])
  useEffect(() => {
    enabledRef.current = enabled
    if (!enabled) controller.current?.abort()
  }, [enabled])

  const ordered = [...(candidates ?? [])].sort((left, right) => {
    const full = (id: string) =>
      checks[id]?.status === 'checked' && checks[id].date?.kind === 'fullDate'
        ? 1
        : 0
    return (
      full(right.candidate.source.externalId) -
      full(left.candidate.source.externalId)
    )
  })
  return {
    ordered,
    checks,
    checkingId,
    notice,
    checkedCount: Object.keys(checks).length,
    verifiedCount: Object.values(checks).filter(
      (check) => check.status === 'checked',
    ).length,
    fullDateCount: Object.values(checks).filter(
      (check) => check.status === 'checked' && check.date?.kind === 'fullDate',
    ).length,
    hasMore: ordered.some(
      ({ candidate }) => !checks[candidate.source.externalId],
    ),
    hasFailed: Object.values(checks).some((check) => check.status === 'failed'),
    checkMore: () => checkBatch(),
    retryFailed: () => checkBatch(true),
  }
}

async function checkEditionDate(
  id: string,
  signal: AbortSignal,
): Promise<{ check: DateCheck; stopMessage?: string }> {
  try {
    const detail = await getDiscogsRelease(id, signal)
    if (
      detail.source.externalId !== id ||
      detail.source.providerName.toLowerCase() !== 'discogs' ||
      detail.source.resourceType !== 'release'
    )
      throw new Error('The source did not match this edition.')
    return {
      check: {
        status: 'checked',
        date: validatedDate(detail.releaseDateEvidence),
      },
    }
  } catch (reason) {
    if (reason instanceof CatalogApiError && reason.status === 404)
      return { check: { status: 'failed' } }
    return {
      check: { status: 'failed' },
      stopMessage:
        reason instanceof Error
          ? `Date checks stopped: ${reason.message}`
          : 'Date checks stopped. Try again later.',
    }
  }
}

function validatedDate(
  date: ExternalMetadataPartialDate | null | undefined,
): ExternalMetadataPartialDate | null {
  if (!date) return null
  if (!Number.isInteger(date.year) || date.year < 1 || date.year > 9999)
    throw new Error('The source returned an invalid date.')
  if (date.kind === 'year') return date
  if (!Number.isInteger(date.month) || date.month < 1 || date.month > 12)
    throw new Error('The source returned an invalid date.')
  if (date.kind === 'yearMonth') return date
  if (
    date.kind !== 'fullDate' ||
    !Number.isInteger(date.day) ||
    date.day < 1 ||
    date.day > new Date(Date.UTC(date.year, date.month, 0)).getUTCDate()
  )
    throw new Error('The source returned an invalid date.')
  return date
}

export function candidateDateLabel(
  check: DateCheck | undefined,
  checking: boolean,
): string {
  if (checking) return 'Checking date…'
  if (!check) return 'Date not checked'
  if (check.status === 'failed') return 'Date check failed'
  if (!check.date) return 'No reliable date in source'
  const date = check.date
  if (date.kind === 'year') return `Year only: ${date.year}`
  const month = `${date.year}-${String(date.month).padStart(2, '0')}`
  if (date.kind === 'yearMonth') return `Month only: ${month}`
  return `Full date: ${month}-${String(date.day).padStart(2, '0')}`
}
