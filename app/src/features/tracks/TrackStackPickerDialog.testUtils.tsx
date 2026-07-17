import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, vi } from 'vitest'
import type {
  ListResponse,
  TrackStackTargetDto,
} from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import {
  TrackStackPickerDialog,
  type TrackStackPickerDialogProps,
  type TrackStackTargetSearch,
} from './TrackStackPickerDialog'
import type { TrackRecord } from './tracksData'

type PickerOverrides = Partial<
  Omit<TrackStackPickerDialogProps, 'returnFocusRef'>
>
type GlobalWithJest = typeof globalThis & { jest?: typeof vi }

let restoreJestGlobal: (() => void) | null = null

afterEach(() => restoreJestGlobal?.())

export function renderPicker(overrides: PickerOverrides = {}) {
  exposeVitestTimerCompatibility()
  const returnFocusRef = createRef<HTMLButtonElement>()
  const searchTargets =
    overrides.searchTargets ??
    vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValue(page([target()], { total: 1 }))
  const onSubmit =
    overrides.onSubmit ??
    vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockResolvedValue(undefined)
  const onAssigned = overrides.onAssigned ?? vi.fn()
  const onSourceInvalid = overrides.onSourceInvalid ?? vi.fn()
  const onClose = overrides.onClose ?? vi.fn()

  let props: TrackStackPickerDialogProps = {
    sourceTrack: sourceTrack(),
    relationTypeOptions: [
      { code: 'remixOf', label: 'Remix' },
      { code: 'versionOf', label: 'Version' },
    ],
    returnFocusRef,
    searchTargets,
    onSubmit,
    onAssigned,
    onSourceInvalid,
    onClose,
    ...overrides,
  }

  const picker = () => (
    <>
      <button ref={returnFocusRef} type="button">
        Add to stack...
      </button>
      <TrackStackPickerDialog {...props} />
    </>
  )
  const rendered = render(picker())

  return {
    ...rendered,
    entryButton: rendered.getByRole('button', { name: 'Add to stack...' }),
    onAssigned,
    onClose,
    onSourceInvalid,
    onSubmit,
    searchTargets,
    rerenderPicker(next: PickerOverrides) {
      props = { ...props, ...next }
      rendered.rerender(picker())
    },
  }
}

function exposeVitestTimerCompatibility() {
  if (restoreJestGlobal) return
  // React Testing Library 16 only recognizes Jest's fake-timer global when
  // draining the async wrapper used by user-event.
  const globalWithJest = globalThis as GlobalWithJest
  const hadJestGlobal = Object.hasOwn(globalWithJest, 'jest')
  const previousJestGlobal = globalWithJest.jest
  globalWithJest.jest = vi
  restoreJestGlobal = () => {
    if (hadJestGlobal) globalWithJest.jest = previousJestGlobal
    else delete globalWithJest.jest
    restoreJestGlobal = null
  }
}

export async function openRelationStep(query = 'bass', view = renderPicker()) {
  const user = userEvent.setup()
  await user.type(
    screen.getByRole('searchbox', { name: 'Search stacks' }),
    query,
  )
  await user.click(
    await screen.findByRole('radio', { name: /Destination Root/ }),
  )
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  return { user, view }
}

export function sourceTrack(): TrackRecord {
  return {
    id: 'source-track',
    title: 'Source Track',
    artist: 'Source Artist',
    release: {
      id: 'source-release',
      title: 'Source Release',
      artist: 'Source Artist',
      year: '1998',
      label: 'Source Label',
    },
    trackNumber: '1',
    duration: '3:46',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
  }
}

export function target(
  overrides: Partial<TrackStackTargetDto> = {},
): TrackStackTargetDto {
  return {
    rootTrackId: 'destination-root',
    title: 'Destination Root',
    artistDisplay: 'Destination Artist',
    versionYear: 1994,
    memberCount: 2,
    matchedMember: null,
    ...overrides,
  }
}

export function page(
  items: TrackStackTargetDto[],
  overrides: Partial<Omit<ListResponse<TrackStackTargetDto>, 'items'>> = {},
): ListResponse<TrackStackTargetDto> {
  return {
    items,
    limit: 20,
    offset: 0,
    total: items.length,
    ...overrides,
  }
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

export function apiError(code: string, status = 409) {
  return CatalogApiError.fromResponse(
    new Response(JSON.stringify({ code, message: 'Server message' }), {
      headers: { 'Content-Type': 'application/json' },
      status,
    }),
  )
}
