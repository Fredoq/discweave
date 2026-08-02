---
type: Workflow
title: Import Deduplication
description: Every import path needs an explicit strategy for matching, merging, and preserving music collection data.
tags: [workflow, import, deduplication]
timestamp: 2026-06-27T00:00:00Z
---

# Import Deduplication

Every DiscWeave import path must have a clear deduplication strategy.

Imports may come from files, spreadsheets, folders, notes, Discogs, MusicBrainz,
or custom tables, but core entity identity must not depend on external service
identifiers.

## Expectations

- Define matching keys and confidence rules before importing records.
- Separate reference release data from owned item data.
- Let users decide whether a release import should create catalog Tracks from
  its tracklist. The release-level default and per-row override should be
  explicit in review before confirmation.
- Keep "do not create a new Track" separate from "link an existing Track"; users
  may still link selected rows to existing Tracks while keeping other rows
  release-only.
- When an import row links to an existing Track, reviewed Track metadata such as
  title, duration, and version year should be applied to that Track on
  confirmation.
- Preserve user-entered data unless the user explicitly chooses an overwrite.
- Track ambiguous matches so users can resolve them.
- Write tests for import, deduplication, and collection isolation behavior.

## External review provenance

External metadata review keeps provider-neutral release and track references in
the draft. A draft reference identifies its provider, resource type, external
identifier, and source URL, but has no catalog confirmation timestamp. Review
updates may echo these references but cannot add, remove, or rewrite them;
server-side provider enrichment is the only authoritative union operation.
Confirmation converts the reviewed references to catalog references with one
server-supplied timestamp for the operation. Binding and local provenance
selections remain collection-scoped and are persisted with the draft so a
review can be reloaded without losing the selected original relationship.

## Related Knowledge

- [Release](../domain/release.md)
- [Owned Item](../domain/owned-item.md)
- [Collection Isolation](../architecture/collection-isolation.md)
