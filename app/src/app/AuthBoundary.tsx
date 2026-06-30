import {
  useLayoutEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  bootstrapAdmin,
  bootstrapLocalDesktopOwner,
  getInitialSessionState,
  getSession,
  isLocalDesktopShell,
  signIn,
  signOut,
  type AuthErrorCode,
  type AuthSession,
} from '../features/auth/authApi'
import '../features/auth/auth.css'

type AuthenticatedRenderProps = {
  sessionEmail: string
  sessionRole: string
  sessionError: string | null
  onLogout: () => void
  logoutPending: boolean
}

type AuthBoundaryProps = {
  children: (props: AuthenticatedRenderProps) => ReactNode
}

type AuthBoundaryState =
  | 'loading'
  | 'signed_out'
  | 'bootstrap'
  | 'desktop_unavailable'
  | 'authenticated'

export function AuthBoundary({ children }: AuthBoundaryProps) {
  const [initialAuthRenderState] = useState(getInitialAuthRenderState)
  const [sessionState, setSessionState] = useState<AuthBoundaryState>(
    initialAuthRenderState.sessionState,
  )
  const [session, setSession] = useState<AuthSession | null>(
    initialAuthRenderState.session,
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)

  useLayoutEffect(() => {
    if (initialAuthRenderState.sessionState !== 'loading') {
      return
    }

    let cancelled = false

    async function openLocalDesktopSession() {
      const result = await bootstrapLocalDesktopOwner()
      if (cancelled) {
        return
      }

      if (!result.ok) {
        setError(mapLocalDesktopError(result.code))
        setSessionState('desktop_unavailable')
        return
      }

      setSession(result.session)
      setSessionState('authenticated')
    }

    void getSession()
      .then((state) => {
        if (cancelled) {
          return
        }

        if (state.status === 'authenticated') {
          setSession(state.session)
          setSessionState('authenticated')
          return
        }
        if (isLocalDesktopShell()) {
          void openLocalDesktopSession()
          return
        }
        if (state.status === 'bootstrap_required') {
          setSessionState('bootstrap')
          return
        }
        if (state.reason === 'session_expired') {
          setError(mapAuthError('SESSION_EXPIRED'))
        }
        setSessionState('signed_out')
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        if (isLocalDesktopShell()) {
          void openLocalDesktopSession()
          return
        }

        setSessionState('signed_out')
      })

    return () => {
      cancelled = true
    }
  }, [initialAuthRenderState.sessionState])

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = readFormField(form, 'email').trim()
    const password = readFormField(form, 'password')
    if (!email.includes('@') || password.length < 1) {
      setError('Enter a valid email and password.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await signIn(email, password)
      if (!result.ok) {
        setError(mapAuthError(result.code))
        return
      }
      setSession(result.session)
      setSessionState('authenticated')
    } catch {
      setError('Server unavailable. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function handleBootstrapSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = readFormField(form, 'email').trim()
    const password = readFormField(form, 'password')
    const confirmPassword = readFormField(form, 'confirmPassword')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await bootstrapAdmin(email, password)
      if (!result.ok) {
        setError(mapAuthError(result.code))
        return
      }
      setSession(result.session)
      setSessionState('authenticated')
    } catch {
      setError('Server unavailable. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function handleLogout() {
    setLogoutPending(true)
    setError(null)
    try {
      const result = await signOut()
      if (!result.ok) {
        setError('Log out failed. Try again.')
        return
      }
      setSession(null)
      setSessionState('signed_out')
    } catch {
      setError('Log out failed. Try again.')
    } finally {
      setLogoutPending(false)
    }
  }

  if (sessionState === 'loading') {
    return (
      <main className="auth-screen">
        <p role="status">Checking session…</p>
      </main>
    )
  }

  if (sessionState === 'bootstrap') {
    return (
      <AuthForm
        mode="bootstrap"
        pending={pending}
        error={error}
        onSubmit={(event) => {
          void handleBootstrapSubmit(event)
        }}
      />
    )
  }

  if (sessionState === 'desktop_unavailable') {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>DiscWeave</h1>
          <p className="auth-tagline">Personal music archive.</p>
          <p role="alert" className="auth-error">
            {error ??
              'Local desktop session is unavailable. Restart DiscWeave.'}
          </p>
        </section>
      </main>
    )
  }

  if (sessionState === 'signed_out' || !session) {
    return (
      <AuthForm
        mode="signin"
        pending={pending}
        error={error}
        onSubmit={(event) => {
          void handleLoginSubmit(event)
        }}
      />
    )
  }

  return children({
    sessionEmail: session.email,
    sessionRole: session.role,
    onLogout: () => {
      void handleLogout()
    },
    logoutPending,
    sessionError: error,
  })
}

function getInitialAuthRenderState(): {
  sessionState: AuthBoundaryState
  session: AuthSession | null
} {
  const state = getInitialSessionState()
  if (!state) {
    return { sessionState: 'loading', session: null }
  }

  if (state.status === 'authenticated') {
    return { sessionState: 'authenticated', session: state.session }
  }
  if (state.status === 'bootstrap_required') {
    return { sessionState: 'bootstrap', session: null }
  }

  return { sessionState: 'signed_out', session: null }
}

function readFormField(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

function mapAuthError(code: AuthErrorCode) {
  const map: Record<AuthErrorCode, string> = {
    INVALID_CREDENTIALS: 'Email or password is incorrect.',
    DISABLED_ACCOUNT: 'This account is disabled.',
    NETWORK_UNAVAILABLE: 'Server unavailable. Check connection and retry.',
    TOO_MANY_ATTEMPTS: 'Too many attempts. Try again shortly.',
    SESSION_EXPIRED: 'Session expired. Sign in again.',
    SERVER_ERROR: 'Server unavailable. Try again.',
    PASSWORD_WEAK: 'Password must be at least 10 characters.',
    BOOTSTRAP_UNAVAILABLE: 'Bootstrap setup is not available.',
  }
  return map[code]
}

function mapLocalDesktopError(code: AuthErrorCode) {
  if (code === 'NETWORK_UNAVAILABLE') {
    return 'Local desktop server is unavailable. Restart DiscWeave.'
  }

  return 'Local desktop session is unavailable. Restart DiscWeave.'
}

function AuthForm({
  mode,
  pending,
  error,
  onSubmit,
}: {
  mode: 'signin' | 'bootstrap'
  pending: boolean
  error: string | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <h1>DiscWeave</h1>
        <p className="auth-tagline">Personal music archive.</p>
        {mode === 'bootstrap' ? (
          <p className="auth-onboarding-note">
            Bootstrap creates the first admin account and its default private
            collection.
          </p>
        ) : (
          <p className="auth-onboarding-note">
            Sign in with the local account that owns this DiscWeave collection.
          </p>
        )}
        <form
          onSubmit={onSubmit}
          aria-label={mode === 'bootstrap' ? 'Bootstrap setup' : 'Sign in'}
        >
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === 'bootstrap' ? 'new-password' : 'current-password'
              }
              required
            />
          </label>
          {mode === 'bootstrap' ? (
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="auth-error">
              {error}
            </p>
          ) : null}
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
          >
            {pending
              ? 'Working…'
              : mode === 'bootstrap'
                ? 'Create admin'
                : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
