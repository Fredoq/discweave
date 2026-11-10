---
type: Domain Entity
title: Label
description: A label, imprint, publisher, or cataloging entity connected to releases and versions.
tags: [domain, entity, label]
timestamp: 2026-11-10T00:00:00Z
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
