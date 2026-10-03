---
type: Workflow
title: Import Deduplication
description: Every import path needs an explicit strategy for matching, merging, and preserving music collection data.
tags: [workflow, import, deduplication]
timestamp: 2026-10-03T00:00:00Z
---

# Import Deduplication

Every DiscWeave import path must have a clear deduplication strategy.

Imports may come from files, spreadsheets, folders, notes, Discogs, MusicBrainz,
or custom tables, but core entity identity must not depend on external service
identifiers.

## Expectations

- Define matching keys and confidence rules before importing records.
- Track positions are scoped to disc and side. Complete selected-track
  reimports compare draft and catalog identities in the same disc, side, and
  track-number order, so repeated track numbers across discs reuse the release.
  Numbered disc markers sort numerically, and missing track positions use the
  same indexed fallback as track materialization.
- Separate reference release data from owned item data.
- Let users decide whether a release import should create catalog Tracks from
  its tracklist. The release-level default and per-row override should be
  explicit in review before confirmation.
- Keep "do not create a new Track" separate from "link an existing Track"; users
  may still link selected rows to existing Tracks while keeping other rows
  release-only.
- When an import row links to an existing Track, reviewed Track metadata such as
  title, duration, and version year should be applied to that Track on
  confirmation.
- Preserve user-entered data unless the user explicitly chooses an overwrite.
- Saving or preflighting a reviewed draft clears a stale field-parse error when
  the current field value is valid or intentionally empty; unrelated issues
  remain visible.
- Track ambiguous matches so users can resolve them.
- Write tests for import, deduplication, and collection isolation behavior.

## Relation suggestion review

Relation suggestion review identifies both endpoints by Track title, artist,
and version year when known. Target choices distinguish Tracks already in the
collection from draft Tracks in the current import. The full selected identity
and directed relation remain visible before acceptance, including on narrow
screens. Import responses resolve this display metadata within the active
collection for suggested endpoints, reviewed endpoints, and every target option;
the UI does not rely on a previously loaded catalog page. IDs remain internal
mutation identifiers rather than user-facing labels.

## Nested disc folders

A desktop folder scan groups audio into one release per release folder. When
every audio subfolder of a folder matches an active Disc folder import pattern,
that folder is the release and each subfolder becomes one of its discs or
parts. Disc folder patterns are collection settings like Release folder and
Track file patterns; built-ins cover `CD`, `Disc`, `Disk`, and `Part` folders
with an optional title (`Disc 03 - Retrospective Mix`), and users may add their
own labels such as `Vinyl {disc}`. `{disc}` is required, whitespace before it is
optional, and `{discTitle}` is optional.

The track disc marker is the folder name up to and including the disc number
(`Disc 03`), so titled and untitled folders keep a stable, comparable marker
for reimports; disc titles are not persisted yet because there is no Medium
record to hold them. Album tags that differ only by a trailing disc marker
(`Album Cd1`, `Album (Disc 2)`) count as one album: they do not send a folder to
Loose files, and the shared base title becomes the draft title. Review lists
draft tracks by disc, side, and position.

## Desktop folder scan transport

Desktop folder scans send metadata and Base64 cover artifacts in one request.
The scan endpoint accepts up to 128 MiB per request; other endpoints retain
their existing limits. Each cover artifact remains limited to 10 MiB.
Larger folder scans must be split into smaller source folders until artifact
transfer supports batching.

Folder scans accept ISO dates and English day-month-name dates from audio
metadata. Tag years outside 1000–9999 are ignored with a review warning;
the parsed date or folder supplies the fallback year, or the year stays unset.

## Local-file Discogs enrichment

Match imported local-file rows independently of their source order before
applying a Discogs tracklist. Discogs supplies final track metadata and order,
while each matched draft row retains its local-file identity and file-specific
fields. Unique normalized-title matches may be automatic; ambiguous remaining
matches require explicit review. Every provider row must be mapped once or
explicitly skipped, and every local row must be mapped once or explicitly kept;
stale, duplicate, or unresolved decisions block Tracklist application while
other selected Discogs groups remain independently applicable. Partial
enrichment keeps the original local row order, positions, file identities, and
effective metadata for kept and skipped local rows, and updates only mapped
rows. Metadata-only external drafts continue to use their authoritative server-side row binding and
do not pretend to have local-file mapping.
Ambiguous mapping rows require an explicit confirmation token at both the
review control and apply boundary; a structurally complete but unconfirmed row
cannot be applied. When a partial update request changes only the release year
and omits Tracks, the stored nullable track version year is retained; a later
response reports that explicit null state so the client does not invent a year
for a kept row.

## External review provenance

External metadata review keeps provider-neutral release and track references in
the draft. A draft reference identifies its provider, resource type, external
identifier, and source URL, but has no catalog confirmation timestamp. Review
updates may echo these references but cannot add, remove, or rewrite them;
server-side provider enrichment is the only authoritative union operation.
Confirmation converts the reviewed references to catalog references with one
server-supplied timestamp for the operation. MusicBrainz Recording and Track
references are both retained, while Discogs release provenance is unioned when
an edition route is authoritatively confirmed.

The selected Recording-to-release-row binding, collection-item intent, and
local Release/Track provenance choices are persisted with an optimistic
external-review revision. Release and Track provenance are independent: each
may resolve to zero, one, or many collection-scoped matches, and ambiguous
matches require an explicit typed selection. Provider route or row replacement
after draft creation is available only through an authoritative typed rebind;
the generic draft update is an equality echo for bindings and provenance. A
collection-item intent remains ordinary review state and may be changed through
the generic update with revision checking. Applying a Discogs candidate to an
external-original draft first asks the server to resolve and persist the
compatible Discogs row; only then may the client overlay editable Discogs
metadata on the returned canonical draft.
The row resolver does not assume MusicBrainz and Discogs use the same side
ordering or punctuation. It matches complete tracklists one-to-one by
normalized title, artist, and duration, then persists the exact selected
Discogs row position and fingerprint.

Selected original bindings have distinct MusicBrainz and Discogs-only domain
variants. The MusicBrainz variant always carries its Recording, release, and
row together; an optional Discogs edition must have a matching row locator.
Release routes likewise distinguish MusicBrainz-backed and Discogs-only
variants. Incomplete MusicBrainz state in persisted bindings is rejected.

Discogs-only original drafts use the same review transaction with an absent
MusicBrainz Recording and row. Existing nullable binding columns store the
Discogs release and row locator; no placeholder MBIDs are persisted. A changed
provider row blocks confirmation. The bound Track's release-row provenance
supports collection-scoped reuse on later imports of the same verified row.

Metadata-only external imports use this same review and confirmation lifecycle
without fabricated file descriptors. A new Wanted intent is explicit and
medium-specific. An accepted Required original relation is validated and
applied in the same transaction as Release, Track, provenance, and Wanted
effects; a rejected relation leaves the independent import valid.

Accepted parser-generated BestEffort relation suggestions preserve their
reviewed source and target endpoints. Confirmation and preflight use the same
stack eligibility rule: for a configured stack relation type, a non-original
target is promoted only when it has no outgoing configured stack membership.
Incoming members do not prevent promotion, while an already-original target or
a target that is itself a member is not rewritten or promoted. Multiple
accepted suggestions for one target therefore appear in one relation-derived
stack projection.

Original-track discovery first lists concrete external release routes. Selecting
one persists that exact route into import review, so review never starts from an
unactionable Recording without a release row. A separate deep search may append
less direct Recording candidates without discarding quick results or changing a
previously selected release.

The ordinary external-original review is summary-first. It exposes the selected
Release and original Track, MusicBrainz/Discogs coverage, collection intent, and
medium, while authoritative external identifiers and typed rebind/provenance
repair controls stay internal. The user may disclose the normal metadata editor
for exceptional corrections. A provider format preselects the collection
medium when it maps unambiguously to digital, vinyl, compact disc, or cassette;
otherwise the user chooses it before confirmation. Its single confirmation action still saves the
draft, runs the read-only preflight, and applies Release, Track, provenance,
Wanted or owned-item effects, and the Required relation only through the same
atomic confirmation boundary; a blocked preflight performs no catalog write.

## Related Knowledge

- [Release](../domain/release.md)
- [Owned Item](../domain/owned-item.md)
- [Collection Isolation](../architecture/collection-isolation.md)
