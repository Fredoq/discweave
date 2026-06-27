---
type: Product Direction
title: Local-First Desktop Direction
description: DiscWeave v2 is a local-first macOS desktop product with an Electron app and ASP.NET Core sidecar.
tags: [product, desktop, local-first, macos]
timestamp: 2026-06-27T00:00:00Z
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

## Related Knowledge

- [API Sidecar](../architecture/api-sidecar.md)
- [SQLite Storage](../architecture/sqlite-storage.md)
- [Collection Isolation](../architecture/collection-isolation.md)
- [Product Boundaries](product-boundaries.md)
