---
type: Product
title: DiscWeave
description: Personal music knowledge base and collection inventory for collectors, DJs, bloggers, journalists, and researchers.
tags: [product, archive, collection]
timestamp: 2026-06-27T00:00:00Z
---

# DiscWeave

DiscWeave is a personal music archive for understanding what exists in a
collection and how music-related entities connect.

Its central product question is:

> What do I have in my collection, and how is it connected?

DiscWeave should feel precise, calm, fast, and respectful of incomplete, rare,
and unusual collection data.

## Audience

DiscWeave is for people with large local music libraries, vinyl, CD, and
cassette collectors, DJs, music bloggers, journalists, and researchers.

It is also for users who currently keep collection knowledge in spreadsheets,
folders, Discogs, MusicBrainz, notes, or custom tables.

## Search and Navigation

Search is the cross-entity entry point for the archive. It retains the `/catalog`
route and query parameters so existing saved links remain valid. Saved views,
entity types, advanced filters, date-added sorting and pagination retain their
collection-scoped semantics. Advanced filters are disclosed on demand with an
active count; closing them must not clear the selection. Result titles open the
appropriate entity workspace. An explicit Preview action retains graph context
and cover actions without a permanent generic detail panel.

Navigation groups daily collection browsing under Library and maintenance under
Organize. Specialized Owned Items and Relations managers live with Exports in a
collapsed Tools disclosure, which opens when entering one of their routes.
Their workspaces and deep links remain functional: contextual Copies and
relationships do not replace collection-wide filtering, copy reassignment,
endpoint editing, or access to unsupported legacy relation records. Search
remains the cross-entity entry point; there is no separate Catalog tab. This
presentation change does not alter entity identities, ownership, relationships
or storage.

## Related Knowledge

- [Product Boundaries](product-boundaries.md)
- [Local-First Desktop Direction](local-first-desktop.md)
- [Release](../domain/release.md)
- [Owned Item](../domain/owned-item.md)
