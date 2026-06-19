# Import Confirmation File Links Design

## Context

This specification defines the design for GitHub issue
`Fredoq/discweave#43`, Roadmap 59: update release folder import confirmation
for digital release copies and file links.

This work builds directly on:

- `docs/superpowers/specs/2026-06-18-release-owned-digital-copies-design.md`;
- `docs/superpowers/specs/2026-06-19-local-audio-file-link-persistence-design.md`;
- the Roadmap 58 implementation that added `LocalAudioFile` and
  `DigitalTrackFileLink` persistence.

Roadmap 59 is backend/import work. It does not redesign Owned Items UI, Tracks
UI, export/restore, or Review Workbench detectors. Those remain scoped to
Roadmaps 60 through 64.

DiscWeave remains a local-first music archive. Import stores local file
metadata and links, not audio bytes.

## Product Decision

Release folder import confirmation must create collection ownership data in
the release-owned file model:

- one digital `OwnedItem` for the confirmed release;
- one `LocalAudioFile` row for each confirmed scanned audio file path;
- one `DigitalTrackFileLink` row connecting the digital release copy, the
  concrete release track appearance, and the local audio file.

Import deduplication must return on top of the new file-link graph. It must not
restore the old owned-item digital file payload columns.

The selected implementation approach is confirmation-owned file linking:
confirmation owns creation and reuse of digital copies, local files, and links,
while scan deduplication reads already confirmed links.

## Confirmation Flow

Confirmation remains a single transactional operation.

For each confirmed draft:

1. Resolve or create the `Release`.
2. Resolve or create `Track` rows.
3. Ensure the confirmed `Release` has the intended `ReleaseTrack` rows with
   stable `ReleaseTrackId` values.
4. Resolve or create one digital `OwnedItem` for the confirmed release.
5. For each non-skipped draft track:
   - resolve the confirmed `ReleaseTrack` row for the draft track;
   - create or reuse a `LocalAudioFile` from the draft file metadata;
   - create or update the `DigitalTrackFileLink` for the digital owned item and
     release track row.
6. Confirm the draft and update the session status only after the catalog,
   owned item, local file, and link writes have succeeded.

`OwnedItem` remains the release-copy aggregate. It does not store file path,
format, hash, or import identity. `LocalAudioFile` stores concrete local file
metadata. `DigitalTrackFileLink` stores file coverage for one release track
appearance within one digital release copy.

## Local Audio File Reuse

Confirmation resolves local files in this order:

1. Reuse an existing `LocalAudioFile` with the same collection and exact path.
2. If no path match exists, create a new `LocalAudioFile`.

Same content hash at a different path is not an automatic merge. It is valid
collection data and can become a future Review Workbench duplicate identity
signal.

When creating or updating a local file from draft metadata, preserve available
metadata:

- path;
- format;
- size in bytes;
- last modified timestamp;
- content hash;
- import identity derived from path, size, modified timestamp, and optional
  hash.

The current scan contract does not provide codec, quality, duration, bitrate,
sample rate, or channel count in a normalized file-inspection model. Those
fields remain optional and should be populated later when the desktop scanner
or API contract provides them.

Missing optional metadata must not block confirmation. Invalid supplied numeric
metadata must still be rejected by `LocalAudioFile` domain validation.

## File Link Reuse

Confirmation resolves file links by the unique identity:

`collectionId, digitalOwnedItemId, releaseTrackId`.

If no link exists, create one.

If a link already points to the same `LocalAudioFile`, confirmation is a no-op
for that link.

If a link already points to a different `LocalAudioFile`, confirmation updates
the link to the file selected by the current confirmed draft. This is explicit
user confirmation through the import review flow, not automatic cleanup.

This keeps re-import idempotent while still allowing a user to confirm that a
release track should now point at a moved or replaced file.

## Deduplication Flow

Scan deduplication reads confirmed file links and local files.

Matching order:

1. Content hash match.
2. Import fingerprint match using path, size bytes, and last modified
   timestamp.

Hash matching:

`ReleaseImportDraftTrack.ContentHash` maps to `LocalAudioFile.ContentHash`,
then through `DigitalTrackFileLink` to `ReleaseTrack.TrackId`.

Fingerprint matching:

Draft `filePath`, `sizeBytes`, and `lastModifiedAt` map to either
`LocalAudioFile.ImportIdentity` or equivalent path, size, and modified metadata,
then through `DigitalTrackFileLink` to `ReleaseTrack.TrackId`.

Candidate selection keeps the existing conservative behavior:

- if the candidates resolve to one unambiguous logical track, set
  `selectedTrackId`;
- if candidates are ambiguous, leave `selectedTrackId` null;
- add the existing duplicate-file warning only when an actual duplicate match
  selected a track.

This restores re-import behavior without making `Track` own file metadata.

## Idempotency Rules

Re-importing the same folder should not create duplicate release-copy or file
coverage data.

Required idempotency:

- digital owned item: reuse an existing digital item for the release;
- local audio file: reuse by collection and exact path;
- digital track file link: reuse by collection, digital owned item, and release
  track row;
- duplicate scan: preselect already confirmed tracks through local file links.

Moved file behavior:

- scan can preselect the existing track by content hash;
- confirmation creates a new `LocalAudioFile` for the new path;
- confirmation creates or updates the file link for the confirmed release track
  row;
- the old `LocalAudioFile` is not deleted or merged.

## Review And Cleanup Boundaries

Roadmap 59 should surface data needed for future cleanup, but it should not
implement the cleanup workflow.

Skipped draft tracks:

- do not create `LocalAudioFile` rows;
- do not create `DigitalTrackFileLink` rows.

Unresolved release track mapping after confirmation is a confirmation error,
because a file link cannot be created without a concrete release track row.

Files that are scanned but not mapped to release track rows are future import
cleanup data. Roadmap 59 should not invent fake tracks or loose-file ownership
records for them.

No automatic merge, delete, path rewrite, or audio byte storage belongs in this
issue.

## Collection Isolation

All lookups and writes must be collection scoped.

Scan deduplication must only consider local audio files and links in the
authenticated current collection.

Confirmation must only link:

- a digital owned item from the current collection;
- a release track row from the current collection;
- a local audio file from the current collection.

Database foreign keys remain the final guard for cross-collection references.
Application queries should prevent accidental cross-collection selection before
the database raises an error.

## API Boundary

Existing import endpoints remain the public surface:

- desktop folder scan creates import sessions and drafts;
- draft update supports manual selected-track review;
- draft confirmation writes catalog and ownership data.

Roadmap 59 should not add a broad new owned item, track, or local file API
contract. Roadmap 60 owns those public contract changes.

Existing response fields such as `selectedTrackId` and import issues remain
valid. Their implementation changes from old owned-item file payload matching
to new local-file link matching.

## Testing Direction

API and import tests should cover:

- confirmation creates one digital owned item for the release;
- confirmation creates one `LocalAudioFile` per confirmed non-skipped file;
- confirmation creates one `DigitalTrackFileLink` per confirmed release track
  file;
- re-importing the same folder does not duplicate digital owned items, local
  files, or file links;
- moved duplicate file scan preselects the existing track by content hash;
- confirming a moved duplicate creates a new local file row and updates or
  creates the correct file link;
- fingerprint/path duplicate scan works when content hash is missing;
- manual selected-track review still creates a link to the selected existing
  track;
- partial duplicate import can reuse selected tracks and add missing tracks
  with correct links;
- skipped tracks do not create local audio files or links;
- scan deduplication stays collection scoped;
- confirmation link creation stays collection scoped.

Infrastructure or domain tests should be added only where Roadmap 58 coverage
does not already prove the persistence invariant.

The full verification command for this issue is:

```bash
dotnet test api/DiscWeave.slnx --no-restore
```

## Out Of Scope

This design does not implement:

- playback;
- audio byte storage;
- automatic duplicate merge;
- automatic file deletion;
- loose-file import without release context;
- Owned Items API contract redesign;
- Track API contract redesign;
- Owned Items UI;
- Tracks UI;
- Review Workbench detector changes;
- export or restore of local audio file links;
- seed data and acceptance coverage updates beyond tests needed for Roadmap 59.
