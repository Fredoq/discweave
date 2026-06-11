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
