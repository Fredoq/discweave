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

## Optional Discogs Catalog

- A collector explicitly selects a Discogs label. Names alone do not establish
  identity, and similarly named labels are not automatically linked.
- The external catalog is loaded in pages on request, not scanned in the
  background. Loaded counts and partial coverage stay visible. Search and
  prefix filters apply only to loaded entries. Discogs can repeat the same
  edition in its label response: distinguish raw entries loaded from displayed
  unique edition/catalog-number pairs. Do not treat provider totals as a count
  of distinct albums.
- Multiple catalog-number prefixes can be selected and remembered per local
  label. These are personal filters, not claims about official Discogs Series.
  Unselected prefixes remain available rather than being deleted or classified
  as invalid data.
- Preserve the provider's catalog-number spelling. Case and separator-insensitive
  comparison assists search and candidate matching; it does not establish release
  identity. Keep suffixes and format markers. Do not infer releases from gaps in
  a numerical sequence or collapse records with absent catalog numbers.
- An exact Discogs release ID identifies a recorded edition. Possible matches
  require local evidence and remain explicitly uncertain. Unmatched means not
  matched, not missing from the collection. Owned and Wanted are independent
  statuses derived from recorded collection items, not from metadata alone.
- Different editions are not automatically merged. Catalog browsing does not
  write releases, change files, or synchronize a Discogs account's wantlist.
  Review for Wanted reuses the explicit import-review workflow, including medium
  selection and final confirmation.
- Label choice and prefix preferences are local, collection-scoped settings
  stored separately from the SQLite archive. They do not require a database
  upgrade and are not part of the portable catalog export. No credentials are
  stored in these preferences.

## Related Knowledge

- [Release](release.md)
- [Import Deduplication](../workflows/import-deduplication.md)
