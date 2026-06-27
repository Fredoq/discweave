---
type: Domain Entity
title: Label
description: A label, imprint, publisher, or cataloging entity connected to releases and versions.
tags: [domain, entity, label]
timestamp: 2026-06-27T00:00:00Z
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

## Related Knowledge

- [Release](release.md)
- [Import Deduplication](../workflows/import-deduplication.md)
