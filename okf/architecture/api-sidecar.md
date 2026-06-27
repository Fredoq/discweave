---
type: Architecture Decision
title: API Sidecar
description: The Electron desktop app owns a local ASP.NET Core API sidecar lifecycle.
tags: [architecture, api, electron, aspnetcore, sidecar]
timestamp: 2026-06-27T00:00:00Z
---

# API Sidecar

The DiscWeave desktop shell owns a local ASP.NET Core API sidecar lifecycle.

The API is a local companion process for the desktop app, not a public cloud
service by default.

## Constraints

- Bind local API access to loopback.
- Protect local API calls with a per-launch token.
- Avoid local login UI in baseline local mode.
- Keep sidecar lifecycle behavior aligned with the Electron app.

## Related Knowledge

- [Local-First Desktop Direction](../product/local-first-desktop.md)
- [SQLite Storage](sqlite-storage.md)
- [Collection Isolation](collection-isolation.md)
