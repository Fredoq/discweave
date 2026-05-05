# Auth entry flow

Cratebase Web now includes a compact auth boundary designed for private archive operations.

## Visual direction

- Neutral surfaces, thin borders, and compact spacing.
- Brand-forward but restrained sign-in card with `Cratebase` and "Personal music archive."
- No marketing hero treatment, streaming language, or social/login-provider options.

## Supported states

- Initial session check/loading.
- Signed-out sign-in form.
- First-user bootstrap form for initial local admin + default collection.
- Invalid credentials, disabled account, server/network unavailable, and throttled attempts.
- Logout pending and logout failure.
- Authenticated shell with session summary and logout action.

## API-backed behavior

- Auth uses same-origin API calls through `src/features/auth/authApi.ts`.
- All auth requests use `credentials: 'include'` so ASP.NET Core Identity owns the secure HTTP-only application cookie.
- Session check calls `GET /api/auth/session` on app load.
- Sign-in calls `POST /api/auth/login`.
- First-user setup calls `POST /api/auth/register`.
- Logout calls `POST /api/auth/logout`.
- The web session model stores only UI-safe account data: email and role. It does not store or expose `collectionId`.

## Error mapping

Backend structured auth errors are mapped to the existing UI states:

- `auth.invalid_credentials` -> invalid credentials.
- `auth.user_disabled` -> disabled account.
- `auth.registration_closed` or `409` -> bootstrap unavailable.
- Identity password validation codes under `auth.Password*` -> weak password.
- `429` -> too many attempts.
- `401` from session-sensitive responses -> session expired.
- failed fetches and `5xx` responses -> network or server unavailable.
