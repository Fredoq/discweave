---
type: Product Direction
title: Local-First Desktop Direction
description: DiscWeave v2 is a local-first macOS desktop product with an Electron app and ASP.NET Core sidecar.
tags: [product, desktop, local-first, macos]
timestamp: 2026-09-26T00:00:00Z
---

# Local-First Desktop Direction

DiscWeave v2 is a local-first macOS desktop product.

Baseline architecture:

- Electron and React app UI.
- Local ASP.NET Core API sidecar owned by the desktop app lifecycle.
- SQLite database and artifact directories under macOS Application Support.
- No local login UI.
- Local mode provisions one owner and one default collection.
- Local API binds to loopback and uses per-launch token protection.
- Apple Silicon DMG releases through GitHub Releases. The free distribution
  path uses a complete ad-hoc signature and requires a one-time macOS Privacy &
  Security override. When Developer ID credentials are configured, the same
  pipeline produces a Developer ID signed and notarized DMG instead. Both paths
  strictly verify the application inside the final DMG before publication.

External original-track discovery remains local-first: the Tracks workspace
opens a persisted Import review deep link, and the local sidecar performs
collection-scoped provenance and authoritative provider validation before any
catalog mutation. A metadata-only review does not manufacture local files; it
can create a Wanted item only after the user selects its medium.

The discovery dialog prioritizes compact concrete-release results. Broader
lineage analysis is an explicit deeper-search action, remains deterministic,
and does not require an LLM or a remote semantic-search service.

Cloud service, SaaS, sync, donations, App Store distribution, mobile, and public
accounts are deferred unless a future roadmap item explicitly scopes them.

## Local File Edits

Renaming a release folder through Edit Local Files moves its auxiliary files
(including covers and nested artwork folders) along with the audio when every
supported audio file in the folder and its subfolders is selected, even when
the release contains only one track. Partial selections, folders containing
symbolic links, and moves into a child or parent folder use individual file
moves instead, leaving unselected files in place.

## Staged Local Edits During Import

On desktop, a local-files import draft can stage file renames and tag writes
before confirmation, using the same naming profiles and tag editor as the
Releases tab. Nothing is written to disk while staging. The staged plan is kept
in desktop browser storage per draft, not in the import session, so the schema
does not change.

Confirmation writes the catalog first. The staged plan is then applied to the
new release's linked local audio files through the regular local edit bridge,
and the catalog paths are reconciled. On success the plan is cleared and the
Releases tab opens with the confirmed release selected. If applying stops
partway, the release stays in the catalog, finished files keep their changes,
there is no rollback, and the remaining work is done from the Releases tab.
Tags of import files are readable before confirmation only for files captured
by a native folder scan.

## Local File Trust

Operating-system file opens are provenance-gated. A file is eligible when its
current identity was captured by a native full scan or produced by a
successfully validated DiscWeave local edit.

Local edit provenance persists across desktop restarts and is bound to the
stable local audio file identifier, normalized absolute path, file size,
last-modified timestamp, and SHA-256 content hash. DiscWeave verifies the
current file against that identity before opening it. Files moved, renamed,
replaced, or modified outside DiscWeave require a new native full scan.

Full-scan provenance is independent of metadata parsing. When a native full
scan can read and hash an audio file but cannot parse its tags, the manifest
still records the path, size, last-modified timestamp, and SHA-256 content hash
needed for trusted opening. The metadata failure remains retryable during later
full scans. A failed content hash creates no persistent scan provenance.

## Related Knowledge

- [API Sidecar](../architecture/api-sidecar.md)
- [SQLite Storage](../architecture/sqlite-storage.md)
- [Collection Isolation](../architecture/collection-isolation.md)
- [Product Boundaries](product-boundaries.md)
