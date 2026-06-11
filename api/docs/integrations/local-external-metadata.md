# Local External Metadata and Offline Behavior

DiscWeave local desktop mode treats external metadata as optional assistance. Core catalog entities never require Discogs or MusicBrainz identifiers.

## Defaults

- Discogs integration is disabled by default.
- No hosted secret, shared token, or SaaS relay is assumed.
- Users who opt in provide their own local Discogs access token through local configuration or environment variables.
- Attribution shown by the app must name Discogs when Discogs data is displayed or imported.

## Offline behavior

When Discogs is disabled, missing credentials, offline, timed out, or rate limited, the API returns deterministic external metadata errors and keeps manual entry workflows available.

The local archive remains searchable, editable, importable, exportable, and restorable without network access.

## Configuration

```json
{
  "Discogs": {
    "Enabled": false,
    "AccessToken": null
  }
}
```

A user may opt in locally by setting `Discogs:Enabled=true` and `Discogs:AccessToken=<user token>` in local configuration. Repository files must not contain real tokens.
