---
type: Workflow
title: Review Workbench
description: A collection-scoped review queue that separates actionable signals from optional completeness and preserves triage decisions.
tags: [workflow, review, collection, metadata]
timestamp: 2026-11-08T00:00:00Z
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

- Release duplicate candidates require a matching normalized title and a real,
  nonempty catalog number on the same label, plus the same known main-artist
  identities. Matching folds case and whitespace, preserving punctuation and
  edition suffixes. A shared title alone is never a release issue. Missing or
  explicitly unknown catalog numbers and unattributed or Various Artists
  releases do not provide enough evidence for this conservative detector.
- Known release years, dates, types, and provider release identifiers must not
  contradict one another. Missing fields are not evidence of a conflict. An
  incomplete release cannot bridge incompatible editions into one candidate
  group. Shared label/catalog pairs produce one signal for the same targets.
  Candidate targets explain the matching title, artist and label/catalog
  evidence and show each release's available date and type; no automatic merge
  or catalog mutation occurs.
- Track title candidates still require the same known main-artist identity.
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
- Multiple cover image candidates are not a review signal. Imports keep the
  existing cover-selection priority and artifact handling without generating
  this warning. Historical import warnings remain stored, but refresh retires
  their active Workbench signals without deleting triage history.

## Duplicate Track Comparison

Duplicate Track issues open every candidate directly in a read-only comparison,
independent of the loaded catalog page. The comparison includes main artists,
duration, version year, the original-recording marker, credits, genres and tags,
release appearances with positions, and linked files. A missing or inaccessible
candidate blocks selection rather than silently showing a partial group.

The user can explicitly select a record to keep and individual duplicates for a
selection preview. Other candidates remain separate. The keeper choice is not
the Track's original-recording marker, and it does not change stack semantics.
Selections are temporary and no catalog writes or issue resolution occur.
Closing and reopening reloads current records and clears selections.

Merge execution remains unavailable. Ordinary Track update/delete operations
are not a safe merge API. A future operation must atomically retarget existing
ReleaseTrack rows without changing their IDs, positions or file links; preserve
playlist entries and order; reconcile credits, provenance and metadata; explicitly
resolve conflicting per-criterion ratings; validate relation collisions and stack
semantics; and retarget both ordinary and external-review import references,
including reviewed relation endpoints. It must revalidate a reviewed plan against
current collection-scoped data and prove rollback on failure before deleting any
duplicate. The current selection preview does not claim these checks are complete.

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

## Import Notice Resolution

Historical partial-date notices are suppressed when the confirmed catalog
Release has a full date, even when the import snapshot is older. Refresh uses
normal system resolution and preserves dismissed or resolved history. Without
a trustworthy full date for the exact edition, year-only precision is valid;
resolving that notice records acceptance without adding a fabricated date.

Album-tag conflicts identify differing source values and counts for new drafts.
Saving draft metadata preserves the source-file conflict notice; after import
confirmation, explicit Workbench resolution records acceptance of the grouping.
Historical notices explain how to check the current release title, artists and
tracklist, then resolve an intentional grouping. They do not repeat pre-import
instructions after confirmation or rewrite source-file tags. Display-copy
changes preserve existing stable keys and triage decisions.
