---
type: Product Direction
title: Local-First Desktop Direction
description: DiscWeave v2 is a local-first macOS desktop product with an Electron app and ASP.NET Core sidecar.
tags: [product, desktop, local-first, macos]
timestamp: 2026-07-17T00:00:00Z
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
- Apple Silicon signed and notarized DMG releases through GitHub Releases.

Cloud service, SaaS, sync, donations, App Store distribution, mobile, and public
accounts are deferred unless a future roadmap item explicitly scopes them.

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
