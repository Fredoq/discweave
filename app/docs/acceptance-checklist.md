# DiscWeave App Acceptance Checklist

This checklist covers the current React/Electron app acceptance path while the
product moves to the local-first macOS desktop architecture.

## Local Setup

- Run the API from `../api` with `ConnectionStrings__DiscWeave`.
- Start the browser app with the Vite proxy pointed at the API.
- Start the desktop app with `DISCWEAVE_API_BASE_URL` pointed at the API until the local sidecar lifecycle replaces this development override.
- Bootstrap the first admin user when the database is empty.
- Sign in and confirm catalog routes use the authenticated collection session.

## Acceptance Path

1. Bootstrap a clean database and create the first admin user.
2. Create a release manually with artist credits, label metadata, tracklist rows, genres, tags, and one owned item.
3. Search for the created data by artist, release title, track title, label, media, ownership status, tag, and credit role.
4. Open catalog result details and verify graph sections for credits, relations, media coverage, collector signals, and workspace links.
5. Create a manual playlist with ordered release or track references and verify the order remains stable after reload.
6. Create a smart playlist with tag, genre, media, ownership status, or year rules and verify results are computed from current catalog data.
7. Use the browser app to review existing import sessions and confirm it does not expose local folder selection.
8. Use the desktop app to scan a local audio folder through `window.discweaveDesktop.imports.pickAndScan()` and create an import review session.
9. Confirm every supported audio file includes a SHA-256 `contentHash` in the desktop scan request, and confirm audio bytes are not uploaded.
10. Confirm the native import confirmation prompt appears before catalog records are created.
11. Re-import the same folder and verify duplicate drafts are no-ops against existing catalog data.
12. Use saved search views for `remixes`, `productions`, `labels`, `physicalWithoutDigital`, `lossyWithoutLossless`, `wantedNotOwned`, and `needsDigitization`.
13. Open the export workspace and confirm it explains JSON/CSV scope, known limits, no audio export, and personal backup use.
14. Export JSON and CSV and verify core catalog data, import-created data, playlists, and playlist entries are present.
15. Restore a JSON export into an empty collection and verify restored search, graph context, playlists, and exports.

## Verification Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run file-size:check
npm test
npm run build
```

## Product Boundaries

- Smart playlists are dynamic rules, not materialized snapshots.
- Browser import review is supported, but local folder scanning is desktop-only through the Electron preload bridge.
- Audio files are not uploaded to the API.
- User-triggered JSON and CSV exports are portability tools and personal backups.
- External catalog integrations, streaming, marketplace, social, and recommendation features are outside the product boundary.
