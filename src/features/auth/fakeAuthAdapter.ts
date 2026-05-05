export type AuthRole = 'admin'

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

const STORAGE_KEY = 'cratebase.fake-auth'

type StoredState = {
  usersExist: boolean
  session: AuthSession | null
}

const defaultState: StoredState = {
  usersExist: false,
  session: null,
}

function readState(): StoredState {
  if (typeof window === 'undefined') {
    return defaultState
  }

  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return defaultState
  }

  if (!raw) {
    return defaultState
  }

  try {
    return JSON.parse(raw) as StoredState
  } catch {
    return defaultState
  }
}

export function getInitialSessionState(): SessionState {
  const state = readState()
  if (!state.usersExist) {
    return { status: 'bootstrap_required' }
  }
  if (!state.session) {
    return { status: 'unauthenticated' }
  }
  return { status: 'authenticated', session: state.session }
}

function writeState(state: StoredState) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    return
  }
}

function delay() {
  const timeout = import.meta.env.MODE === 'test' ? 0 : 120
  return new Promise((resolve) => window.setTimeout(resolve, timeout))
}

export async function getSession(): Promise<SessionState> {
  await delay()
  return readSessionState()
}

function readSessionState(): SessionState {
  const state = readState()

  if (!state.usersExist) {
    return { status: 'bootstrap_required' }
  }

  if (!state.session) {
    return { status: 'unauthenticated' }
  }

  return { status: 'authenticated', session: state.session }
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  await delay()

  if (email === 'network@cratebase.local') {
    return { ok: false, code: 'NETWORK_UNAVAILABLE' }
  }

  if (email === 'disabled@cratebase.local') {
    return { ok: false, code: 'DISABLED_ACCOUNT' }
  }

  if (email === 'throttle@cratebase.local') {
    return { ok: false, code: 'TOO_MANY_ATTEMPTS' }
  }

  if (password !== 'cratebase-demo') {
    return { ok: false, code: 'INVALID_CREDENTIALS' }
  }

  const state = readState()

  if (!state.usersExist) {
    return { ok: false, code: 'BOOTSTRAP_UNAVAILABLE' }
  }

  const session = { email, role: 'admin' as const }
  writeState({ ...state, session })

  return { ok: true, session }
}

export async function bootstrapAdmin(
  email: string,
  password: string,
): Promise<AuthResult> {
  await delay()
  const state = readState()

  if (state.usersExist) {
    return { ok: false, code: 'BOOTSTRAP_UNAVAILABLE' }
  }

  if (password.length < 10) {
    return { ok: false, code: 'PASSWORD_WEAK' }
  }

  const session = { email, role: 'admin' as const }
  writeState({ ...state, usersExist: true, session })

  return { ok: true, session }
}

export async function signOut(): Promise<
  { ok: true } | { ok: false; code: AuthErrorCode }
> {
  await delay()

  const state = readState()

  if (state.session?.email === 'logout-error@cratebase.local') {
    return { ok: false, code: 'SERVER_ERROR' }
  }

  writeState({ ...state, session: null })

  return { ok: true }
}

export function expireSession() {
  const state = readState()
  writeState({ ...state, session: null })
}

export function seedFakeAuth(state: StoredState) {
  writeState(state)
}
