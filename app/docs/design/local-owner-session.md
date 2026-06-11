# Local Owner Session

Packaged local desktop mode does not show login, logout, registration, invite, or password-management workflows.

The renderer starts by calling `/api/auth/session`. In `DISCWEAVE_RUNTIME_MODE=LocalDesktop`, the API provisions one local owner and one default collection if no user exists, signs that owner in with the existing same-origin cookie, and returns an authenticated admin session.

The local owner is intentionally not a public account. It exists only to reuse collection scoping, export ownership, import deduplication, and admin-only settings inside the local archive.
