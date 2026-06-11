# DiscWeave API Acceptance Checklist

This checklist covers the current local-first API acceptance path for the
macOS desktop architecture.

## Local Setup

- Start the API with `ConnectionStrings__DiscWeave="Data Source=var/discweave.sqlite"`.
- Start the app with the Vite proxy pointed at the API.
- Bootstrap the first admin user when the database is empty.
- Sign in and confirm catalog routes use the authenticated collection session.

## Acceptance Path

1. Bootstrap a clean database and create the first admin user.
2. Create a release manually with artist credits, label metadata, tracklist rows, genres, tags, and one owned item.
3. Search for the created data by artist, release title, track title, label, media, ownership status, tag, and credit role.
4. Open catalog result details and verify graph sections for credits, relations, media coverage, collector signals, and workspace links.
5. Create a manual playlist with ordered release or track references and verify the order remains stable after reload.
6. Create a smart playlist with tag, genre, media, ownership status, or year rules and verify results are computed from current catalog data.
7. Use the desktop app to scan a local audio folder and create an import review session.
8. Confirm every supported audio file includes a SHA-256 `contentHash` in the desktop scan request.
9. Submit a scan without one `contentHash` and verify the API records a `release_import.content_hash_missing` warning while preserving fallback duplicate matching.
10. Re-import the same folder and verify duplicate drafts are no-ops against existing catalog data.
11. Use saved search views for `remixes`, `productions`, `labels`, `physicalWithoutDigital`, `lossyWithoutLossless`, `wantedNotOwned`, and `needsDigitization`.
12. Export JSON and CSV and verify core catalog data, import-created data, playlists, and playlist entries are present.
13. Restore a JSON export into an empty collection and verify restored search, graph context, playlists, and exports.

## Verification Commands

```bash
dotnet test DiscWeave.slnx
dotnet format DiscWeave.slnx --verify-no-changes --verbosity diagnostic
```

Search large-seed smoke:

```bash
dotnet run --project src/DiscWeave.Seeding/DiscWeave.Seeding.csproj -- \
  --connection-string "Data Source=var/discweave-seed.sqlite" \
  --verify-search \
  --search-budget-ms 250
```

Large-collection performance smoke:

```bash
dotnet run --project src/DiscWeave.Seeding/DiscWeave.Seeding.csproj -- \
  --connection-string "Data Source=var/discweave-seed.sqlite" \
  --verify-performance \
  --performance-budget-ms 250
```

## Product Boundaries

- Smart playlists are dynamic rules, not materialized snapshots.
- Browser import review is supported, but local folder scanning is desktop-only.
- Audio files are not uploaded to the API.
- External catalog integrations, streaming, marketplace, social, and recommendation features are outside the product boundary.
