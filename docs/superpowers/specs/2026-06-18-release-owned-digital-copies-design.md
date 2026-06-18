# Release-Owned Digital Copies Design

## Context

DiscWeave is a music archive and collection inventory, not a music player. Its
collection model must answer what the user owns and how that ownership connects
to catalog releases, tracks, files, and physical copies.

The current implementation mixes two different concepts in the user-facing
model:

- track catalog data, such as title, artists, credits, genres, release
  appearances, duration, and relations;
- concrete collection data, such as a local file path, file format, physical
  storage location, and condition.

The backend already keeps digital file data inside `OwnedItem`, but the
frontend projects the first matching digital owned item into
`TrackRecord.fileMetadata`. That makes the UI read as if local file metadata
belongs directly to a `Track`. It also causes review signals such as missing
storage location to be generated for digital files, even though a local file
path is the storage fact for a digital copy.

The local database can be reset for this redesign. No compatibility migration
for existing local data is required.

## Product Decision

An owned item is a concrete owned copy of a release.

`Track` remains a logical catalog entity. It does not own local file metadata.
It can be shown with related local files as a read projection, but those files
belong to digital release copies in the collection.

Owned item types are fixed product concepts, not user-configurable dictionary
entries. Initial types are:

- `digital`;
- `vinyl`;
- `cd`;
- `cassette`;
- `other`, as a fixed fallback for unusual physical or archival copies.

Each type can have its own required and optional data. This is more explicit
than the current configurable medium-profile approach and better matches how a
collector reasons about copies.

## Core Model

### Release

`Release` stores release-level catalog facts: title, release type, year or date,
labels, cover, cataloging, credits, and tracklist.

### Release Track

`ReleaseTrack` represents a track's appearance on a specific release. It should
be addressable by a stable `ReleaseTrackId`.

Release track data includes:

- `releaseTrackId`;
- `releaseId`;
- `trackId`;
- position number;
- optional disc;
- optional side;
- optional title override;
- optional duration override if a release-specific edit differs from the base
  track duration.

The stable id matters because digital files are linked to a track appearance in
a digital release copy, not only to a logical track.

### Track

`Track` stores facts that are independent of ownership and storage:

- title;
- duration when known;
- artists and credits;
- genres and tags;
- external references;
- relations such as remix, edit, version, alias, and other track-level
  relationships.

`Track` must not store file path, storage location, condition, import identity,
checksum, or physical copy state.

If both `Track` and `LocalAudioFile` have duration data, the track duration is
the catalog-level musical duration while the file duration is inspection
metadata for one concrete file.

### Owned Item

`OwnedItem` represents one concrete copy of one release in the user's
collection.

Common owned item data includes:

- `ownedItemId`;
- `collectionId`;
- `releaseId`;
- fixed `type`;
- ownership status, such as owned, wanted, sold, or needs digitization;
- acquisition/source notes if available;
- user notes;
- tags if the product keeps copy-level tags.

`OwnedItem` no longer targets a standalone track in the first implementation of
this redesign. Loose track-only imports are deferred.

### Digital Owned Item

A digital owned item is a digital copy of a release. It does not have physical
condition and does not require physical storage location.

Digital copy data includes:

- source folder path when imported from a folder;
- import session reference when available;
- optional copy notes;
- links from release track appearances to local audio files.

The source folder is useful context, but it is not a replacement for per-track
file links because a digital release can be incomplete, split across folders, or
share files with another release.

### Physical Owned Item Details

Physical owned item types have physical detail data.

Vinyl details can include:

- physical storage location;
- media condition;
- sleeve condition;
- pressing notes;
- optional barcode or catalog note if needed later.

CD details can include:

- physical storage location;
- media condition;
- sleeve or booklet condition;
- disc count;
- matrix or edition notes if needed later.

Cassette details can include:

- physical storage location;
- media condition;
- case or insert condition;
- tape type;
- digitization status.

`other` details should stay intentionally small: name/description, physical
storage location, condition, and notes.

## Local Audio Files

`LocalAudioFile` is a first-class local collection object for a concrete audio
file on disk.

Fields include:

- `localAudioFileId`;
- `collectionId`;
- absolute path;
- file format;
- codec when known;
- lossless/lossy classification;
- size bytes when known;
- last modified timestamp when known;
- content hash when available;
- duration when read from the file;
- bitrate when available;
- sample rate when available;
- channel count when available;
- import identity or inspection metadata.

The same local audio file can be linked from more than one digital release copy.
This is required for the case where `Release1` and `Release2` both contain the
same logical `Track1`, and the user wants both release copies to point to the
same file path.

## Digital Track File Links

`DigitalTrackFileLink` connects a digital release copy to a local file for one
release track appearance.

Fields include:

- `digitalTrackFileLinkId`;
- `digitalOwnedItemId`;
- `releaseTrackId`;
- `localAudioFileId`;
- optional role or state, such as primary, alternate, missing, or ignored if
  future workflows need it.

This link is the model answer to "which local file represents this track within
this digital copy of this release?"

The model supports these cases:

- `Release1` has `Track1` and `Track2`.
- `Release2` has `Track1` and `Track3`.
- The user's digital copy of `Release1` links `Release1.Track1` to
  `/music/release1/01-track1.flac`.
- The user's digital copy of `Release2` can either link `Release2.Track1` to
  the same `LocalAudioFile`, or to a different path such as
  `/music/release2/01-track1.flac`.
- The Track detail view for `Track1` can show both release appearances and all
  related digital files, grouped by file path and release-copy context.

## Identity And Duplicates

Local audio file identity should prefer content hash when available. If a hash
is not available, identity can fall back to normalized path plus file size and
last modified timestamp.

The product should distinguish these situations:

- same path reused in multiple digital track links: expected and valid;
- same hash at multiple paths: likely duplicate file identity, reviewable;
- one file linked to different logical tracks: allowed only as reviewable data,
  because it can be valid for hidden tracks, medleys, or bad imports;
- one release track linked to multiple files: allowed only if future UI
  introduces explicit alternate-file semantics.

No automatic merge, deletion, or rewrite should happen in this redesign.

## Import Behavior

Folder import should create or update a digital owned item for the imported
release and create local audio files for scanned track files.

The import review flow should map files to release track appearances. On
confirmation it should create:

- a release if needed;
- tracks and release track rows if needed;
- one `OwnedItem` of type `digital` for the release;
- `LocalAudioFile` rows for scanned files;
- `DigitalTrackFileLink` rows from release track rows to local files.

If the same path or content hash already exists, import should reuse the
existing `LocalAudioFile` when that is safe.

Loose files without a release context are out of scope for the first
implementation. They can become a future import cleanup workflow that creates a
draft release or asks the user to attach the files to an existing release.

## UI Direction

### Owned Items

Owned Items should be release-copy records.

The list should show:

- release title;
- artist context;
- owned item type;
- ownership status;
- type-specific summary;
- digital file coverage or physical storage/condition depending on type.

For digital owned items, the detail panel should show:

- linked release;
- file coverage by release track;
- local file paths;
- format and codec summary;
- missing file rows for release tracks that do not have a linked file;
- source folder/import context when known.

For physical owned items, the detail panel should show:

- linked release;
- physical storage location;
- condition fields;
- type-specific physical details;
- digitization status where relevant.

The UI must not show "Physical details" for a digital item.

### Tracks

Track detail should keep release appearances, credits, relations, ratings, and
playlist backlinks as track facts.

The local-file area should become a derived collection section such as "Digital
files in collection". It should show:

- each local file path connected to this track;
- format and codec;
- release copy context;
- release track position context;
- whether the same file path is reused by multiple release copies.

The UI should not imply that the track owns the file.

## Review Workbench And Quality Signals

Review signals must follow the new ownership semantics.

Missing condition applies only to physical owned item types.

Missing physical storage location applies only to physical owned item types.

Digital review signals should include:

- digital release copy missing files for one or more release track rows;
- local audio file missing format or codec when inspection failed;
- digital copy with files not mapped to release track rows;
- duplicate local audio file identities;
- lossy digital copy without a lossless linked file for the same release track
  or logical track, depending on the review queue.

Format gap signals should be based on release-copy coverage and linked file
coverage, not on a track pretending to own a file.

## Export And Restore

Portable export should make ownership and file data explicit.

Recommended export sections:

- `owned_items` for release copies;
- `local_audio_files` for local file metadata, with no audio bytes;
- `digital_track_file_links` for links between digital release copies, release
  track rows, and local files.

Export must not include audio bytes. It may include absolute local paths because
this is user archive workflow data, but the export UI should document that paths
are local-machine-specific.

Restore can recreate rows without trying to verify that local file paths still
exist.

## Compatibility

No compatibility migration is required for the existing local development
database. The implementation may reset local schema and seed data.

Public API names and frontend types should still be changed deliberately so the
new semantics are clear to tests and future contributors.

## Out Of Scope

This design does not implement:

- playback;
- audio byte storage;
- cloud sync;
- automatic file deduplication cleanup;
- automatic merge or delete;
- loose-file import without a release context;
- full MusicBrainz or Discogs dependency;
- mobile or SaaS workflows.

## Implementation Notes

The implementation should be split into focused issues:

1. Update the domain and persistence model for release-owned items, fixed
   owned item types, local audio files, and digital track file links.
2. Update import confirmation to create digital release owned items and file
   links.
3. Update API contracts for owned items, tracks, and local file edit flows.
4. Update Owned Items UI to show digital and physical details separately.
5. Update Tracks UI to show derived digital files in collection.
6. Update Review Workbench and catalog quality signals for physical-only
   condition/storage checks and digital file coverage checks.
7. Update export/restore and CSV/report documentation.
8. Replace seed data and acceptance tests with release-owned digital copy
   scenarios.

## Testing Direction

Tests should cover:

- digital owned item does not require condition or physical storage;
- physical owned items still support and review condition/storage;
- a digital owned item links files to release track rows;
- one local audio file can be linked from two release copies for the same
  logical track;
- one logical track can show different local file paths from different release
  copies;
- import creates digital owned item, local audio files, and digital track file
  links;
- Workbench no longer reports missing physical fields for digital files;
- Track detail API/UI shows file data as related collection data, not track
  data;
- export/restore preserves file links without exporting audio bytes.
