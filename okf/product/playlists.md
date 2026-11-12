---
type: Product Feature
title: Playlists
description: Track-only manual playlists with reviewed metadata-based suggestions and local M3U8 export.
tags: [playlists, privacy, desktop, recommendations]
timestamp: 2026-11-12T00:00:00Z
---

# Playlists

Manual playlists preserve track order and existing repeated occurrences. The
editor adds tracks, not releases. Legacy release references remain read-only;
an explicit track-only copy is allowed only when every original entry can be
resolved without loss. Smart playlists and their rules remain unchanged.

## Unsaved changes

Closing or reloading a dirty desktop editor asks whether to Stay or Discard
changes. Stay is the default and Escape action. Cancelling app quit keeps the
backend and other services running so the draft can still be saved. Clean
editors do not prompt.

The renderer uses the standard `beforeunload` cancellation API, supported by the
pinned Electron 42 runtime, without the deprecated `returnValue` property.
`electron scripts/check-unsaved-changes.cjs` (from `app/`) exercises native
close/reload/quit with synthetic pages and deterministic dialog responses in an
isolated temporary profile. It never opens the collection.

## AI-assisted draft selection

The desktop editor accepts a natural-language request without a manual candidate
selection step. The first OpenAI call produces a constrained metadata search
plan. DiscWeave loads all pages of the current collection's tracks, releases and
Overall track ratings, filters locally, then ranks and diversifies at most 100
candidates for a second OpenAI call. Only returned references belonging to this
shortlist can become suggestions, up to 20 per generation.

The preview shows interpreted criteria and examined, matched and shortlisted
counts. A shortlist is not a claim that the model reviewed every matching track.
Unknown metadata cannot satisfy hard criteria. Label and year constraints must
match the same release appearance. Unclear or unsupported requests, including
requirements for audio analysis, receive an explanation instead of fabricated
matches. The interpretation is model-generated and must remain visible for
review; schema validation alone cannot prove its semantic accuracy.

No generation changes a playlist. The collector selects suggestions, adds them
to the draft, then saves explicitly. Existing entries are not reordered or
collapsed. Unknown or already-present track IDs are not inserted. Cancellation
or provider failure preserves the prior preview and draft.

## Privacy and bounds

Playlist suggestions use the configured OpenAI key but require separate explicit
consent for the request and shortlisted metadata: titles, artists, releases,
labels, years, genres, tags, durations and Overall ratings. Discover's older
consent is not reused. Audio, local paths, notes, account details and catalog IDs
are not provider inputs. Candidate references are temporary. Keys stay in the
existing main-process vault. Requests use `store: false`; provider retention and
billing terms still apply.

The six-attempt hourly session quota and cancellation controller are shared with
Discover and connection tests. A normal generation consumes two attempts.
Each serialized provider input is limited to 128 KiB before an HTTP attempt.
Metadata field/list reductions are disclosed, rather than presented as complete
metadata. Paginated datasets above 50,000 records fail explicitly; no partial
catalog is silently used. Inconsistent pagination also fails. Pagination is not
a transactional snapshot during concurrent edits, so the active session is
checked and additions are revalidated against the editor's current catalog.

Local file availability is not inferred from a stored link. M3U8 export checks
trusted file associations and current regular-file availability separately,
requires explicit consent for omissions, and preserves playback order. Saving an
M3U8 does not copy audio or automatically start an external player.

Automated verification uses synthetic catalogs and mocked provider responses,
never paid requests or the collector's actual collection.
