# Auth entry flow (fake adapter)

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

## Intentionally fake in this phase

- Auth uses a local fake adapter with simulated responses.
- No real HTTP calls are made to `/api/auth/login`, `/api/auth/logout`, or bootstrap endpoints.
- Demo state is stored only as non-sensitive fake session info in local storage.

## Remaining integration work

Replace `src/features/auth/fakeAuthAdapter.ts` internals with real API calls while preserving exported function signatures and return-state handling in UI components.
