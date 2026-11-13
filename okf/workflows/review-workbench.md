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

## Duplicate Track Review and Merge

Duplicate Track issues open every candidate directly in a comparison,
independent of the loaded catalog page. The comparison includes main artists,
duration, version year, the original-recording marker, credits, genres and tags,
release appearances with positions, and linked files. A missing or inaccessible
candidate blocks selection rather than silently showing a partial group.

The user explicitly selects a keeper and individual duplicates. Other candidates
remain separate. A server preview returns the current selected records, affected
dependency counts and conflicts. The displayed records and dependency state are
bound to a signed, collection-scoped, ten-minute token. A change to the selection,
metadata, dependencies or displayed identity requires a new preview and explicit
confirmation. Previewing alone does not write catalog data or resolve the issue.

Confirmation runs a dedicated merge in one serializable transaction. It relinks
existing ReleaseTrack rows without changing IDs, positions, title overrides,
row credits or file links. Playlist entries keep their positions and repeats.
The keeper retains its title, duration, version year and original marker;
the confirmation shows differences, including information absent on the keeper.
Genres, tags, external references and contributor roles are combined. Matching
external reference identities retain the newest authoritative URL and timestamp.
Equivalent ratings and relations collapse deterministically while retaining an existing
keeper record when present. Other ratings and directed relations are retargeted.
No audio file is opened, moved, rewritten or deleted.

Different values for the same rating criterion, self-relations, stack cycles,
incompatible original markers and distinct original stacks block the entire merge
until the conflict is resolved. Unfinished imports that could overwrite the
keeper and import relations that would collapse onto themselves also block it.
Confirmed import references, suggested and reviewed relation endpoints, external
bindings and provenance selections are retargeted. External review revisions
advance; historical request and provider fingerprints remain unchanged.

Only after all references have been saved are the selected duplicate Track rows
deleted. Failure at any stage rolls back the entire operation, including search
rebuilds. A successful response refreshes the catalog and queue. If the client
cannot verify the outcome, it requires reconciliation rather than resubmission.
Closing an unsubmitted review clears selections; closing/navigation is disabled
while the merge request is pending. This operation does not use ordinary Track
update/delete endpoints or automatically choose duplicates.

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
applies. User-dismissed or user-resolved history is not deleted. Filtering and
triage do not change catalog metadata, ownership records, audio files or database
schema. Explicitly confirmed Track merges are separate catalog mutations.

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


## Edition-specific date review

Live missing-date signals and confirmed partial-date import notices offer a
Review date action for an accessible catalog Release. Historical signals without
a current matching release do not offer this action. Existing stable keys and
triage decisions remain intact.

Date review loads the local release and searches Discogs using editable title,
main artist and catalog-number hints, or accepts a numeric release ID or Discogs
release URL. Catalog-number and descriptive searches run independently so that
the provider's merged-branch limit cannot discard one branch before ranking.
Candidates are deduplicated by source identity, then ranked by positive matches
on catalog number, artist, label, title and year. Missing or conflicting metadata
does not remove a candidate. Catalog-number spacing and separators are normalized
for ranking only; leading zeroes and distinct edition identities are preserved.
A broader title-only search remains available when the local hints differ from
Discogs. Labels and year inform ranking rather than restricting retrieval.
Search results are limited candidates, not proof that an edition is absent.
Track count is not a hard filter in this flow: the current provider search can
truncate candidates before applying that filter (issue 108).
The user checks edition title, artists, label/catalog number, formats and date,
with a link and attribution to the actual release source. A master release is
not a valid date source. Search and preview do not write collection metadata.

An explicit Apply date confirmation uses a collection- and release-scoped,
ten-minute protected preview. Changing the target or catalog snapshot requires
a new preview. The transactional operation changes only release date and its
corresponding year, preserving title, artists, labels, tracklist, copies, covers,
external sources and files. It does not attach a source or resolve unrelated
issues. Refresh retires date notices through the normal signal lifecycle.

Provider date precision is preserved in the preview. Only a trustworthy full
date can be applied with the current persisted model. Year-only and year-month
sources remain visibly incomplete; neither an assumed month nor a first day of
the month is manufactured. A future month-only persistence model requires its
own schema/upgrade design. Closing review without applying leaves data unchanged.
