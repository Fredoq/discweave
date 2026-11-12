---
type: Domain Entity
title: Owned Item
description: A concrete physical or digital copy in the user's collection, separate from reference release metadata.
tags: [domain, entity, ownership, collection]
timestamp: 2026-06-27T00:00:00Z
---

# Owned Item

An Owned Item is a concrete copy in the user's collection.

Owned items answer collection inventory questions: which copies exist, what
format they are, what condition or status they have, where they are stored, and
whether there are physical or digital gaps.

## Modeling Notes

- Do not mix owned copy data into [Release](release.md).
- An owned item should reference a release when known.
- The model must support incomplete ownership data.
- Destructive operations affecting owned items require explicit confirmation.
- An external original import defaults to an explicit Wanted intent. A user
  must choose a physical or digital medium before confirmation, or explicitly
  reuse a matching existing item. External metadata never creates an implicit
  Owned item, local audio file, or digital track-file link.

## Contextual Copies

Release detail groups its copies into physical, digital, and Wanted views.
Copy details and editing remain scoped to the concrete Owned Item ID, not to a
release title match. Different editions with the same title must not share
copies implicitly. The legacy inventory workspace and its deep links remain
available for collection-wide filtering and navigation.

Copy editing preserves medium-specific data and digital file coverage unless
an explicit change requires otherwise. A digital-to-physical conversion that
removes linked file coverage requires a specific warning and confirmation.
Saving must not close an editor before persistence succeeds; a refresh failure
after a successful write must not invite repeating that write.

Ownership changes require an explicit supported status; blank or unrecorded
values must not silently become Owned. Dictionary media profiles determine the
physical/digital form fields. Changing a medium label within the same medium
type preserves recorded physical details, including disc count. New inventory
entries are selected using the server-assigned ID after persistence.

## Related Knowledge

- [Release](release.md)
- [Medium](medium.md)
- [Collection Isolation](../architecture/collection-isolation.md)
- [Destructive Operations](../workflows/destructive-operations.md)
