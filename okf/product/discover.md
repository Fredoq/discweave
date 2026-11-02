---
type: Product Feature
title: Discover
description: Optional metadata-only recommendations for verified releases outside the collector's catalog.
tags: [product, recommendations, privacy, imports]
timestamp: 2026-11-02T00:00:00Z
---

# Discover

Discover suggests up to ten concrete releases outside the current collection.
The default action uses the collection's rated music without requiring a seed.
A repeat request seeks new candidates rather than merely shuffling the old list.
Remixes and different recordings are not automatically collapsed into originals.

## Evidence and Eligibility

- Only the built-in Overall criterion and its standout flag define automatic
  taste input. Unrated entries are not dislikes; arbitrary criteria are not
  silently blended.
- Positive and negative examples remain distinct. A bounded profile preserves
  multiple tastes rather than claiming every rated item was transmitted.
- OpenAI supplies untrusted release leads. The API resolves them against the
  catalog provider and verifies artist/title identity before display.
- Collection entries, including Owned and Wanted items, are excluded. Reliable
  master identity suppresses alternate editions; incomplete identity cannot
  support a guarantee that every unknown edition is recognized.
- Local history and distinct Not interested / Already know feedback suppress
  repeat suggestions. Already know does not mean a negative taste rating.
- Results can contain fewer than ten releases. Provider failure must not erase
  the previous visible batch. Reasons refer to metadata, never audio analysis.

## Privacy and Runtime

OpenAI is optional and uses the collector's own API key. Explicit consent is
required before sending up to 40 rated artist/title/Overall/standout examples,
up to 20 recent artist/title exclusion hints, and optional selected-item context. Audio,
local file paths, notes, Discogs account payloads and credentials are not prompt
inputs. There are no live paid API calls in the automated test suite.

Electron owns the key and provider request. OS-backed encrypted storage is used
when available; otherwise the UI reports session-only storage. The key is never
returned to the renderer, exported with the catalog, or stored in plaintext
settings. Browser mode does not pretend to provide desktop secret storage.

Requests are bounded and cancellable. Provider output cannot choose URLs,
credentials, tools, local API routes, or catalog mutations. OpenAI Responses use
`store: false`; this does not promise zero provider retention or eliminate abuse
monitoring. Consult the provider's current data controls and billing terms.

## Review and Listening

A recommendation is read-only. Adding it to Wanted opens a persisted import
review, requires an explicit medium and confirmation, and revalidates provider
provenance. It creates no fake local audio or original-track relationship.

Discogs links identify verified provider releases. Apple Music is a clearly
labelled search fallback, not an asserted canonical match or a promise that the
release is available. Discover does not require Apple Developer credentials or
access to the user's music library.

## Related Knowledge

- [Product Boundaries](product-boundaries.md)
- [API Sidecar](../architecture/api-sidecar.md)
- [Collection Isolation](../architecture/collection-isolation.md)
- [Import Deduplication](../workflows/import-deduplication.md)
