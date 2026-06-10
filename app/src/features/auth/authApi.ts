export type AuthRole = 'admin' | 'user'

export type AuthSession = {
  email: string
  role: AuthRole
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'DISABLED_ACCOUNT'
  | 'NETWORK_UNAVAILABLE'
  | 'TOO_MANY_ATTEMPTS'
  | 'SESSION_EXPIRED'
  | 'SERVER_ERROR'
  | 'PASSWORD_WEAK'
  | 'BOOTSTRAP_UNAVAILABLE'

export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; code: AuthErrorCode }

export type SessionState =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'unauthenticated'; reason?: 'session_expired' }
  | { status: 'bootstrap_required' }

type AuthResponseDto = {
  isAuthenticated: boolean
  email?: string | null
  roles?: string[] | null
}

type AuthSessionResponseDto = AuthResponseDto & {
  bootstrapRequired?: boolean | null
}

type ErrorResponseDto = {
  code?: string | null
}

let testSessionState: SessionState | null = null

export function getInitialSessionState(): SessionState | null {
  return import.meta.env.MODE === 'test' ? testSessionState : null
}

export async function getSession(): Promise<SessionState> {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
    method: 'GET',
  })

  if (response.status === 401) {
    return { status: 'unauthenticated', reason: 'session_expired' }
  }

  if (!response.ok) {
    throw new Error('Session check failed')
  }

  const body = await readJson<AuthSessionResponseDto>(response)
  if (body.isAuthenticated) {
    return { status: 'authenticated', session: toSession(body) }
  }

  return body.bootstrapRequired
    ? { status: 'bootstrap_required' }
    : { status: 'unauthenticated' }
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  return postAuth('/api/auth/login', email, password)
}

export async function bootstrapAdmin(
  email: string,
  password: string,
): Promise<AuthResult> {
  return postAuth('/api/auth/register', email, password)
}

export async function signOut(): Promise<
  { ok: true } | { ok: false; code: AuthErrorCode }
> {
  try {
    const response = await fetch('/api/auth/logout', {
      body: JSON.stringify({}),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    if (response.ok || response.status === 401) {
      return { ok: true }
    }

    return { ok: false, code: await mapErrorResponse(response) }
  } catch {
    return { ok: false, code: 'NETWORK_UNAVAILABLE' }
  }
}

export function seedAuthSessionForTests(state: SessionState) {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('Test auth session seeding is only available in tests')
  }

  testSessionState = state
}

export function clearAuthSessionForTests() {
  if (import.meta.env.MODE === 'test') {
    testSessionState = null
  }
}

async function postAuth(
  path: '/api/auth/login' | '/api/auth/register',
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      body: JSON.stringify({ email, password }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    if (!response.ok) {
      return { ok: false, code: await mapErrorResponse(response) }
    }

    const body = await readJson<AuthResponseDto>(response)

    return { ok: true, session: toSession(body) }
  } catch {
    return { ok: false, code: 'NETWORK_UNAVAILABLE' }
  }
}

async function mapErrorResponse(response: Response): Promise<AuthErrorCode> {
  if (response.status === 429) {
    return 'TOO_MANY_ATTEMPTS'
  }

  if (response.status >= 500) {
    return 'SERVER_ERROR'
  }

  const body = await readOptionalJson<ErrorResponseDto>(response)
  const code = body?.code ?? ''

  if (code === 'auth.invalid_credentials') {
    return 'INVALID_CREDENTIALS'
  }

  if (code === 'auth.user_disabled') {
    return 'DISABLED_ACCOUNT'
  }

  if (code === 'auth.registration_closed') {
    return 'BOOTSTRAP_UNAVAILABLE'
  }

  if (code === 'auth.unauthenticated') {
    return 'SESSION_EXPIRED'
  }

  if (response.status === 409) {
    return 'BOOTSTRAP_UNAVAILABLE'
  }

  if (response.status === 400 && code.startsWith('auth.Password')) {
    return 'PASSWORD_WEAK'
  }

  return response.status === 400 ? 'PASSWORD_WEAK' : 'SERVER_ERROR'
}

function toSession(body: AuthResponseDto): AuthSession {
  const email = typeof body.email === 'string' ? body.email : ''
  const roles = Array.isArray(body.roles) ? body.roles : []

  return {
    email,
    role: roles.includes('Admin') ? 'admin' : 'user',
  }
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function readOptionalJson<T>(response: Response): Promise<T | null> {
  try {
    return await readJson<T>(response)
  } catch {
    return null
  }
}
