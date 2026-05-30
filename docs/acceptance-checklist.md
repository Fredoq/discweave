# DiscWeave Acceptance Checklist

This checklist describes the shared product acceptance path for `discweave-api`
and `discweave-web`.

## Local Setup

- Run PostgreSQL and start the API with `ConnectionStrings__DiscWeave`.
- Start the web app with the Vite proxy pointed at the API.
- Start the desktop app with `DISCWEAVE_API_BASE_URL` pointed at the API.
- Bootstrap the first admin user when the database is empty.
- Sign in and confirm catalog routes use the authenticated cookie.

## Hosted Setup

- Serve browser web and API traffic from one HTTPS origin.
- Route `/api/*` and `/health` to the API container.
- Route `/web-health` and every other path to the web static container.
- Keep browser API calls relative to `/api`.
- Confirm private beta desktop packages target `https://discweave.example.com` by default, with `DISCWEAVE_API_BASE_URL` available as a runtime override.
- Build the API and web Docker images, then run the example compose stack and verify `/health`, `/web-health`, web routing and authenticated `/api` calls through the reverse proxy.
- Verify staging and production do not share PostgreSQL databases, service storage, secrets, invite data or user accounts.
- Review `discweave-api/docs/private-beta/data-handling-and-trust.md` and `discweave-api/docs/private-beta/release-readiness.md` before private beta evidence is collected.

## Acceptance Path

1. Bootstrap a clean database and create the first admin user.
2. Confirm sign-in and bootstrap copy describes invited private beta access, the default private collection, and the hosted archive workflow without marketing claims.
3. Create a release manually with artist credits, label metadata, tracklist rows, genres, tags and one owned item.
4. Search for the created data by artist, release title, track title, label, media, ownership status, tag and credit role.
5. Open catalog result details and verify server graph sections for credits, relations, media coverage, collector signals and workspace links.
6. Create a manual playlist with ordered release or track references and verify the order remains stable after reload.
7. Create a smart playlist with tag, genre, media, ownership status or year rules and verify results are computed from current catalog data.
8. Confirm playlists appear in search, export data, catalog links and graph backlinks.
9. Use the browser app to review existing import sessions and confirm it does not expose local folder selection.
10. Use the desktop app to scan a local audio folder through `window.discweaveDesktop.imports.pickAndScan()` and create an import review session.
11. Confirm every supported audio file includes a SHA-256 `contentHash` in the desktop scan request, and confirm audio bytes are not uploaded.
12. Confirm the native import confirmation prompt appears before catalog records are created.
13. Re-import the same folder and verify fully duplicate drafts are no-ops against existing catalog data.
14. Rename or move duplicate files and verify same-collection content hash matching still preselects existing tracks.
15. Add a partial duplicate folder and verify existing tracks are preselected while missing catalog data can still be created.
16. Use saved search views for `remixes`, `productions`, `labels`, `physicalWithoutDigital`, `lossyWithoutLossless`, `wantedNotOwned` and `needsDigitization`.
17. Open the export workspace and confirm it explains JSON/CSV scope, known v1 limits, no audio export, and the difference between user exports and hosted service backups.
18. Export JSON and CSV and verify core catalog data, import-created data, playlists and playlist entries are present.
19. Restore a JSON export into an empty collection and verify restored search, graph context, playlists and exports.

## Verification Commands

Backend:

```bash
dotnet test DiscWeave.slnx
dotnet format DiscWeave.slnx --verify-no-changes --verbosity diagnostic
```

Frontend:

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
- Browser import review is supported, but local folder scanning is desktop-only through the Electron preload bridge. The API boundary is documented in `discweave-api/docs/imports/desktop-import-api-boundary.md`.
- Audio files are not uploaded to the API.
- User-triggered JSON and CSV exports are portability tools and personal backups. Hosted service backups are separate operator-managed recovery work, and the export v1 contract is documented in `discweave-api/docs/exports/portable-export-v1.md`.
- Private beta data-handling and release-readiness expectations are documented in `discweave-api/docs/private-beta/data-handling-and-trust.md` and `discweave-api/docs/private-beta/release-readiness.md`.
- External catalog integrations, streaming, marketplace, social, and recommendation features are outside the product boundary.
