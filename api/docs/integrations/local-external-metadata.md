# Local External Metadata and Offline Behavior

DiscWeave local desktop mode treats external metadata as optional assistance. Core catalog entities never require Discogs or MusicBrainz identifiers.

## Defaults

- Discogs lookup is unavailable until the local user saves a token.
- No hosted secret, shared token, or SaaS relay is assumed.
- Users who opt in provide their own local Discogs access token in
  Settings -> Integrations. The token is stored in the local API-managed
  Application Support settings file, outside collection data.
- Attribution shown by the app must name Discogs when Discogs data is displayed or imported.

## Offline behavior

When Discogs credentials are missing, offline, timed out, or rate limited, the API returns deterministic external metadata errors and keeps manual entry workflows available.

The local archive remains searchable, editable, importable, exportable, and restorable without network access.

The access token is not read from server configuration in desktop mode. Users
add and remove their own token through Settings -> Integrations. Repository
files must not contain real tokens. Saving the token is the integration switch;
there is no separate Discogs enable setting in desktop mode.

## MusicBrainz request pacing

One singleton request gate is shared by metadata, original-track discovery, and
cover-edition search within each backend process. It owns the HTTP send through
response headers or failure and applies a minimum one-second cooldown afterward.
This is deliberately more conservative than one-second admission spacing:
network latency may make requests slower, but delayed concurrent senders cannot
bunch together. The interval uses monotonic time, not the wall clock.

Retries re-enter the gate; accepted `Retry-After` delays may extend the wait.
Queued cancellation does not consume a send slot. A failed or canceled in-flight
send retains its cooldown because the request may already have reached the
provider. The existing operation deadline still bounds queued work.

The metadata HTTP client does not automatically follow redirects: unexpected
3xx responses become recoverable invalid-response errors instead of hidden
ungated requests. The artwork client validates its bounded redirects explicitly
and re-enters the shared gate for every request addressed to MusicBrainz.

This limit is process-wide, not network-wide. Separate app/backend instances,
other applications, and other devices sharing the same public address can add
traffic outside this gate. No machine-wide network settings or IP-specific
configuration are used by the limiter.
