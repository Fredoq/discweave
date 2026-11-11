---
type: Domain Entity
title: Label
description: A label, imprint, publisher, or cataloging entity connected to releases and versions.
tags: [domain, entity, label]
timestamp: 2026-11-11T00:00:00Z
---

# Label

A Label represents a label, imprint, publisher, or other cataloging entity tied
to releases and versions.

Labels are important for collection navigation because catalog numbers, imprints,
editions, and release histories often define what a collector owns.

## Modeling Notes

- Preserve label names and catalog numbers as collector-facing metadata.
- Do not require external service identifiers for label identity.
- Support multiple labels on a release when needed.

## Collection Overview

- The Labels workspace shows releases already recorded in the active collection,
  not an external label's complete discography or a completion percentage.
- A release appears once per label, retaining all catalog numbers for that label.
  A co-label's catalog numbers are not displayed or searched under another label.
- In collection includes releases with an Owned or Needs digitization item.
  Wanted includes releases with a Wanted item. These filters can overlap when
  different copies or formats of one release have different statuses.
- Filter counts are release counts, not copy counts. Sold, unclassified, and
  metadata-only releases remain visible in All without implying ownership.
- Release search covers title, artist, year, and label-specific catalog numbers.
  Switching labels resets the release search and collection-status filter.
- The overview is read-only. Label editing and release links remain available.
  Individual collection items, their media, and statuses are accessible through
  each release's Collection item backlinks; Labels does not repeat that list.

## Related Knowledge

- [Release](release.md)
- [Import Deduplication](../workflows/import-deduplication.md)

## Import Continuation

- A collector may explicitly link existing local-file import sessions to a label.
  The link is collection-scoped, many-to-many, and independent of release label
  metadata. A folder name is never evidence for assigning a release to a label.
- The Labels inspector keeps Releases as its default view; Imports is a separate
  view loaded on demand so source lists do not crowd the release overview.
  It shows pending release drafts and pending loose files for
  linked sessions, with direct navigation back to normal import review.
  Completed and archived sessions are hidden by default but remain available.
- Counts describe scanned materials in each session, not a label's complete
  discography. Separate scans may overlap; their counts are not added into an
  alleged unique-file total or a catalog completion percentage.
- Linking does not scan a folder, watch it, confirm a draft, or edit a release.
  Unlinking removes only the organizational association; import history and
  catalog records remain intact.
- Existing compatible archives must be backed up and upgraded before links can
  be stored. Deferring this additive update keeps normal catalog and import
  work available, while the link view explains the required update rather than
  presenting a retry loop. Unknown schemas are not opened for editing.
