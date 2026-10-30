---
type: Workflow
title: Destructive Operations
description: User data is important and destructive operations require explicit confirmation.
tags: [workflow, data-safety, destructive-actions]
timestamp: 2026-10-13T00:00:00Z
---

# Destructive Operations

Treat all DiscWeave user data as important.

Any destructive operation must require explicit confirmation and should make the
scope of deletion or mutation clear to the user.

## Expectations

- Avoid implicit destructive side effects.
- Make the affected collection, entity, and relationship scope clear.
- Write tests for destructive workflows that affect domain data, imports,
  exports, or collection isolation.

## Deleting Import Files From Disk

Import review can move an unconfirmed local-files draft's files to the system
Trash; nothing is unlinked permanently.

- The desktop shell only touches files an import scan captured, and it plans
  the move before the user confirms it in a dialog that shows the folder, the
  audio count, and the other files that go with it.
- The whole release folder goes to Trash only when it holds no audio from other
  releases and is not an import source root, a watched folder, the home folder,
  or a filesystem root. Otherwise only the draft's own audio files move.
- Confirmation is bound to a one-use desktop plan. If the affected files or
  folder contents change before execution, nothing moves and the user must
  close the dialog and confirm a fresh plan.
- Import source roots recovered from scan manifests remain protected from
  whole-folder removal after restart; this does not authorize unattended rescans.
- After a successful move the draft is marked Skipped. Confirmed drafts cannot
  be trashed from import; the catalog release must be deleted first.

## Related Knowledge

- [Owned Item](../domain/owned-item.md)
- [Collection Isolation](../architecture/collection-isolation.md)
- [Product Boundaries](../product/product-boundaries.md)
- [Watched Import Folders](watched-import-folders.md)
