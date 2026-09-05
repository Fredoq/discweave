# Workflow Knowledge

- [Import Deduplication](import-deduplication.md)
- [Human-Readable Export](export-human-readable.md)
- [Destructive Operations](destructive-operations.md)

Workflow changes should preserve user trust in local collection data.

## Date Added Sorting

Catalog, Releases, Tracks, Artists, Labels, Playlists, Owned Items, Relations,
Imports, and Review Workbench offer newest-first and oldest-first sorting.
Sort choices are stored locally per workspace and restored after navigation or
restart. Explicit Review Workbench URL sorting overrides the saved choice.
Default order preserves each workspace's existing ordering. Filters and selected
records remain independent of sorting; paged lists sort before pagination and
return to the first page when the sort changes.

Catalog record dates come from the creation timestamp embedded in UUIDv7 IDs.
Records with legacy or synthetic IDs have unknown dates and remain last in both
directions. Import sessions use their recorded creation date. Review Workbench
uses the first persisted detection date, not the latest refresh date. Track
stacks sort by the original Track's creation date and preserve member grouping.
