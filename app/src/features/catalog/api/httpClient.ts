import {
  pageSize,
  type ErrorResponseDto,
  type ListResponse,
} from './catalogTypes'

export async function getAllPages<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<ListResponse<T>> {
  let offset = 0
  let total: number | undefined
  const items: T[] = []

  while (true) {
    const pageParams = new URLSearchParams(params)
    pageParams.set('limit', String(pageSize))
    pageParams.set('offset', String(offset))

    const page = await getList<T>(`${path}?${pageParams.toString()}`)

    items.push(...page.items)
    total = page.total

    if (page.items.length === 0 || items.length >= page.total) {
      break
    }

    offset += page.items.length
  }

  return {
    items,
    limit: pageSize,
    offset: 0,
    total: total ?? items.length,
  }
}

export async function getList<T>(path: string): Promise<ListResponse<T>> {
  const response = await fetch(path, {
    credentials: 'include',
    method: 'GET',
  })

  if (!response.ok) {
    if (response.status === 404) {
      return { items: [], limit: 0, offset: 0, total: 0 }
    }

    throw await CatalogApiError.fromResponse(response)
  }

  const body = (await response.json()) as ListResponse<T>
  assertNoCollectionIds(body)

  return body
}

export async function getJson<T>(path: string): Promise<T | null> {
  const response = await fetch(path, {
    credentials: 'include',
    method: 'GET',
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }

    throw await CatalogApiError.fromResponse(response)
  }

  const body = (await response.json()) as T
  assertNoCollectionIds(body)

  return body
}

export async function sendJson<T = unknown>(
  path: string,
  method: 'PATCH' | 'POST' | 'PUT',
  body: unknown,
): Promise<T> {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method,
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  const responseBody = await readJsonBody<T>(response)
  if (responseBody !== null) {
    assertNoCollectionIds(responseBody)
  }

  return responseBody ?? ({} as T)
}

export async function postEmpty<T = unknown>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  const responseBody = await readJsonBody<T>(response)
  if (responseBody !== null) {
    assertNoCollectionIds(responseBody)
  }

  return responseBody ?? ({} as T)
}

export async function sendDelete(path: string, confirmation: string) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'X-DiscWeave-Confirm-Delete': confirmation },
    method: 'DELETE',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }
}

export function assertNoCollectionIds(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoCollectionIds)
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'collectionId' || key === 'defaultCollectionId') {
      throw new Error('Catalog responses must not expose collection ids.')
    }

    assertNoCollectionIds(child)
  }
}

export async function readJsonBody<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  if (text.trim().length === 0) {
    return null
  }

  return JSON.parse(text) as T
}

export class CatalogApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly retryAfter: string | null

  private constructor(
    status: number,
    code: string | null,
    message: string,
    retryAfter: string | null,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }

  static async fromResponse(response: Response) {
    const body = await readOptionalJson<ErrorResponseDto>(response)

    return new CatalogApiError(
      response.status,
      body?.code ?? null,
      body?.message ??
        `Catalog API request failed with HTTP ${response.status}.`,
      response.headers.get('Retry-After'),
    )
  }
}

async function readOptionalJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}
