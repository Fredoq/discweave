# Local Audio File Link Persistence Design

## Context

This specification defines the design for GitHub issue
`Fredoq/discweave#42`, Roadmap 58: add local audio files and digital track file
link persistence.

This work follows the accepted release-owned digital copy model in
`docs/superpowers/specs/2026-06-18-release-owned-digital-copies-design.md`.

It also preserves the Review Workbench boundaries from
`docs/superpowers/specs/2026-06-17-collection-review-workbench-design.md`.
The persistence model must support future review signals such as duplicate
digital file identities and missing digital file coverage, but this issue does
not implement cleanup, merge, recommendation, playback, or automatic repair
flows.

DiscWeave remains a local-first music archive. Local file metadata is
collection ownership data, not catalog track data, and audio bytes are never
stored in the database.

## Product Decision

`OwnedItem` remains one concrete owned copy of one `Release`.

A digital owned item is a release copy whose files are represented through
separate local file records and release-track file links. A digital copy can
exist before every release track has a linked file.

`Track` remains catalog data only. It must not own local file path, hash,
format, import identity, storage location, or physical condition data.

`LocalAudioFile` becomes the first-class collection object for a concrete local
audio file on disk.

`DigitalTrackFileLink` connects one digital release copy, one release track
appearance, and one local audio file. This is the persisted answer to:

> Which local file represents this release track within this digital copy of
> this release?

No compatibility migration is required from the old owned-item digital file
columns. The local development database may be reset. Idempotent SQLite table
creation is useful for existing local files, but it must not backfill or keep
old owned-item file payload semantics alive.

## Model Boundary

### Owned Item

`OwnedItem` keeps release-copy ownership fields:

- `ownedItemId`;
- `collectionId`;
- `releaseId`;
- ownership status;
- fixed medium type;
- physical-only condition and storage fields.

Digital owned items no longer store file path, file format, content hash, or
import identity directly. The old `owned_items.digital_file_*` and
`owned_items.import_identity_*` payload fields should stop being mapped.

This keeps `OwnedItem` focused on the copy, while file records and links model
the contents of that copy.

### Local Audio File

`LocalAudioFile` represents one concrete audio file path known to a collection.

Fields:

- `localAudioFileId`;
- `collectionId`;
- absolute path;
- file format when known;
- codec when known;
- lossless or lossy classification when known;
- size in bytes when known;
- last modified timestamp when known;
- content hash when available;
- duration when read from the file;
- bitrate when available;
- sample rate when available;
- channel count when available;
- import identity fields when available.

The same `LocalAudioFile` can be linked from multiple digital owned items. This
supports cases where two release copies intentionally point to the same file
path or same inspected file identity.

### Digital Track File Link

`DigitalTrackFileLink` connects:

- `digitalTrackFileLinkId`;
- `collectionId`;
- `digitalOwnedItemId`;
- `releaseTrackId`;
- `localAudioFileId`.

The link uses the stable `ReleaseTrackId` introduced by Roadmap 57. It points
to a release track appearance, not only to a logical track, because the same
logical track can appear on multiple releases with different positions, title
overrides, editions, or local files.

For the first implementation, each digital owned item can have at most one
linked local audio file per release track row. Alternate file semantics are
future scope and need explicit UI/API design before relaxing that invariant.

## SQLite And EF Core Schema

### Owned Items

The `owned_items` table keeps:

- `owned_item_id`;
- `collection_id`;
- `release_id`;
- `ownership_status`;
- `medium_type`;
- physical detail columns.

It should no longer map:

- `digital_file_path`;
- `digital_file_format`;
- `import_identity_path`;
- `import_identity_size_bytes`;
- `import_identity_last_modified_at`;
- `import_identity_content_hash`.

The physical-detail check constraint remains: digital items must not carry
physical condition or physical storage.

### Local Audio Files

The `local_audio_files` table stores collection-scoped file metadata.

Recommended columns:

- surrogate `id` primary key;
- `local_audio_file_id`;
- `collection_id`;
- `path`;
- `format`;
- `codec`;
- `quality`;
- `size_bytes`;
- `modified_at`;
- `content_hash`;
- `duration_ticks`;
- `bitrate_kbps`;
- `sample_rate_hz`;
- `channels`;
- `import_identity_path`;
- `import_identity_size_bytes`;
- `import_identity_last_modified_at`;
- `import_identity_content_hash`.

Constraints and indexes:

- alternate key on `collection_id, local_audio_file_id`;
- foreign key from `collection_id` to `collections.collection_id`;
- unique index on `collection_id, path`;
- lookup index on `collection_id, content_hash`;
- lookup index on import identity fields where available.

There should be one `LocalAudioFile` row per collection and absolute path.
Multiple release copies reuse that file through `DigitalTrackFileLink` rows
instead of duplicating the path row. Content hash is intentionally not unique:
the same hash at multiple paths is valid collection data and can become a
future duplicate identity review signal.

### Digital Track File Links

The `digital_track_file_links` table stores release-copy track file coverage.

Recommended columns:

- surrogate `id` primary key;
- `digital_track_file_link_id`;
- `collection_id`;
- `digital_owned_item_id`;
- `release_track_id`;
- `local_audio_file_id`.

Constraints and indexes:

- alternate key on `collection_id, digital_track_file_link_id`;
- foreign key from `collection_id, digital_owned_item_id` to
  `owned_items(collection_id, owned_item_id)`;
- foreign key from `collection_id, release_track_id` to
  `release_tracks(collection_id, release_track_id)`;
- foreign key from `collection_id, local_audio_file_id` to
  `local_audio_files(collection_id, local_audio_file_id)`;
- unique index on `collection_id, digital_owned_item_id, release_track_id`;
- lookup index on `collection_id, local_audio_file_id`;
- lookup index on `collection_id, release_track_id`.

The database constraints must enforce collection isolation. Cross-collection
links must fail through foreign keys, not only through application checks.

## Application Behavior

Roadmap 58 is a persistence foundation. It must not implement the full import
confirmation, owned item API, track API, or UI redesign.

Expected behavior in this issue:

- EF Core can create the new schema from the model.
- SQLite startup can idempotently create the new tables for existing local
  database files if needed.
- Domain objects can represent local audio files and digital track file links.
- Infrastructure tests can save, load, and constrain shared file link
  scenarios.
- Old owned-item file payload mapping is removed from the clean model.

Expected deferrals:

- Roadmap 59 updates import confirmation to create or reuse
  `LocalAudioFile` rows and create `DigitalTrackFileLink` rows from draft
  tracks.
- Roadmap 60 updates owned item, track, and local file API contracts.
- Roadmap 61 and Roadmap 62 update the UI surfaces.
- Roadmap 63 updates Review Workbench and catalog quality detectors for
  release-owned digital file coverage.
- Roadmap 64 updates export, restore, seed data, and acceptance coverage.

Existing old-contract code such as the owned-item digital file update endpoint
must not drive the new model. If it cannot remain meaningful without old
owned-item file columns, it should be disabled or return a clear unsupported
response until Roadmap 60 replaces the contract.

Import confirmation should stop creating one digital owned item per track file.
If Roadmap 58 touches that path, the minimum acceptable behavior is one digital
release copy without per-track file links. Creating real file links from import
drafts belongs to Roadmap 59.

## Review Workbench Compatibility

This issue creates the data foundation for future review signals, but does not
generate review items.

The model should make future Workbench detectors possible for:

- duplicate digital file identities;
- digital release copies missing linked files for release track rows;
- file metadata inspection gaps such as missing format or codec;
- lossy-without-lossless file coverage;
- shared file paths or hashes that deserve manual review.

The Workbench remains a review workflow, not an automatic cleanup engine. This
issue must not merge files, delete files, rewrite paths, or auto-resolve review
state.

## Testing Direction

Infrastructure tests should cover:

- schema creation includes `local_audio_files` and
  `digital_track_file_links`;
- `owned_items` no longer includes mapped digital file payload columns;
- a `LocalAudioFile` can be linked by multiple digital owned items;
- the same logical track can resolve to different files through different
  release-track appearances;
- cross-collection digital file links fail by database constraint;
- file path and hash lookup indexes are scoped by collection;
- SQLite table creation for the new tables is idempotent.

Domain tests should cover:

- local audio file metadata validation for path, known format, size, duration,
  bitrate, sample rate, and channels where those values are supplied;
- import identity hash normalization continues to use lower-case hashes;
- digital track file links preserve the three public ids they connect.

No test should assert audio bytes are stored.

## Out Of Scope

This design does not implement:

- playback;
- audio byte storage;
- cloud sync;
- automatic duplicate merge or cleanup;
- loose-file import without a release context;
- import confirmation file-link creation;
- owned item or track API contract redesign;
- Owned Items UI;
- Track detail UI;
- Review Workbench detector changes;
- export or restore of local audio file links.
