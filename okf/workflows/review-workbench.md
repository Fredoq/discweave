---
type: Workflow
title: Review Workbench
description: A collection-scoped review queue that separates actionable signals from optional completeness and preserves triage decisions.
tags: [workflow, review, collection, metadata]
timestamp: 2026-11-07T00:00:00Z
---

# Review Workbench

The default UI focus is **Needs attention**. Incomplete optional metadata and
collection goals remain available under **Optional completeness**, with **All
signals** for a combined view. Focus is derived from the signal subtype, not a
new persisted issue state. Switching focus does not dismiss or resolve anything.

Optional completeness includes missing dates, labels, track durations, physical
copy condition or storage location, and file codec metadata; physical-to-digital
and lossy-to-lossless coverage; and wanted releases not yet owned. Explicit
Needs Digitization status, duplicate candidates, missing file links or formats,
unmapped files, and unresolved import or relation issues remain actionable.

## Signal Confidence

- Duplicate title candidates require the same known main-artist identity.
  A title alone, including an unattributed title, is insufficient evidence.
- Owned and Needs Digitization mean present possession. Wanted and Sold copies
  do not create condition, storage, linked-file, or physical coverage tasks,
  and do not satisfy possession coverage for another copy.
- A variant-title relation needs one unambiguous artist-compatible base. An
  existing expected relation prevents further suggestions for that variant.
- Explicitly rejected import relation suggestions are decisions, not cleanup
  tasks. Their exact directed relation is excluded from later inference when
  confirmed catalog endpoints can be resolved reliably. Unresolved import
  warnings remain visible. Ambiguous historical endpoints are not guessed.
- An M4A container alone does not establish lossy audio quality.

## Counts and Navigation

The list API accepts `focus=actionable|optional|all`; omitted focus retains the
legacy all-signals API behavior. State totals cover the selected focus across
all categories and states. Category totals cover the selected focus and state
across all categories and pages. The result total additionally applies the
selected category.

The UI uses 100-row pages with URL-backed offsets. Focus, category, state and
sort changes reset the offset. Back and Forward restore the URL selection.
When triage removes the last row on a page, the UI returns to the last valid
page. Superseded requests cannot restore an older page or filter.

Existing stable keys and triage history are retained for unchanged signals.
Refresh uses the existing system-resolution behavior when a signal no longer
applies. User-dismissed or user-resolved history is not deleted. No catalog
metadata, ownership records, audio files, or database schema are changed by
these queue refinements.
