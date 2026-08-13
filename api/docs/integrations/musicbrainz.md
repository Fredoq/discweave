# MusicBrainz integration

DiscWeave uses MusicBrainz as the Recording-lineage authority for external
original-track discovery. The integration is optional and read-only until an
import review is explicitly confirmed.

## Configuration

Configure the `MusicBrainz` section in `appsettings.json`, environment
variables, or the desktop sidecar settings:

```text
MusicBrainz__Enabled=true
MusicBrainz__BaseUrl=https://musicbrainz.org
MusicBrainz__ApplicationName=DiscWeave
MusicBrainz__ApplicationVersion=1.0.0
MusicBrainz__Contact=https://github.com/Fredoq/discweave
MusicBrainz__MaxWorkRecordingCandidates=10
MusicBrainz__MaxSourceReleaseLookups=5
MusicBrainz__MaxReleaseGroupSearchCandidates=5
```

When enabled, `ApplicationName`, `ApplicationVersion`, and `Contact` must form
a valid, meaningful HTTP User-Agent. The default base URL must remain HTTPS;
use a different HTTPS endpoint only for a controlled compatible proxy.

`MinimumRequestIntervalMilliseconds` must stay at or above 1000 ms. Timeout,
retry, request-budget, and candidate limits are bounded by the options
validator. No MusicBrainz API token is required for these public read
operations, and no LLM or embedding credentials are used.

The adaptive limits are bounded to `1..25` Work performance candidates,
`0..10` source-release rows, and `1..10` release-group search candidates.
They are applied inside the existing per-operation request budget rather than
creating an independent request pool.

## Runtime behavior

- Search and candidate loading are read-only and collection-scoped.
- Versioned titles are classified deterministically, then searched through
  explicit Recording relations, Work performances, source-release siblings,
  and release-group fallback lanes. The UI exposes candidate role, executed
  paths, request URLs, mapped counts, and completion warnings.
- An inferred historical root needs multiple compatible structural signals;
  Shared Work or earlier chronology alone remains a diagnostic lead. Missing
  or truncated structural data caps inferred confidence at Medium.
- Draft creation and confirmation re-fetch authoritative release and row data;
  cached snapshots never authorize writes.
- Both `musicbrainz/recording` and `musicbrainz/track` identities are retained
  as provenance on the confirmed Track.
- Discogs is optional release-edition enrichment. A MusicBrainz-only route stays
  importable when no reliable Discogs edition exists.

For local development, leave `Enabled=true` with a descriptive User-Agent and
run the focused API/infrastructure tests. Set `Enabled=false` to exercise the
typed disabled-provider path without making outbound requests.
