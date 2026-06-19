# Owned Item, Track, And Local File API Contracts Design

## Context

This specification defines the design for GitHub issue
`Fredoq/discweave#44`, Roadmap 60: update owned item, track, and local file API
contracts for the release-owned file model.

This work builds directly on:

- `docs/superpowers/specs/2026-06-18-release-owned-digital-copies-design.md`;
- `docs/superpowers/specs/2026-06-19-local-audio-file-link-persistence-design.md`;
- `docs/superpowers/specs/2026-06-19-import-confirmation-file-links-design.md`;
- the Roadmap 58 and Roadmap 59 implementations that persist
  `LocalAudioFile` and `DigitalTrackFileLink` records during confirmed release
  folder import.

Roadmap 60 is an API contract and client DTO cleanup. It should not redesign the
Owned Items UI, Tracks UI, export/restore, or Review Workbench workflows. Those
remain separate roadmap items.

There is no compatibility requirement for the old local database or old API
contracts. The API and frontend DTOs should use the clean release-owned model.

## Product Decision

An owned item is a concrete owned copy of a release.

`Track` remains catalog metadata. It does not own local file metadata. Track
responses may show related digital files as derived collection context, but
those files belong to digital release copies and their release track file links.

Local file edit flows must identify the concrete `LocalAudioFile`, and when
needed the concrete `DigitalTrackFileLink`. They must not update a track-owned
file payload or a generic owned-item digital file payload.

Collection scoping remains implicit through the local owner and current
collection context. Client-controlled `collectionId` fields should not be added
to these public request contracts.

## Owned Item API

Owned item requests and responses must be release-only.

The public contract should stop accepting or returning track-targeted owned item
behavior. API types and frontend DTOs should not expose `track` as an owned item
target option.

Owned item response identity should make the release-copy relationship explicit:

- `id`;
- `releaseId`;
- release summary, such as title and artist/label context when already
  available;
- ownership status;
- fixed owned item type;
- inventory signals;
- type-specific details.

The response can keep a literal `targetType: "release"` only if it helps the
existing shared catalog UI route data consistently. It must not be a union that
also includes `track`.

## Type-Specific Owned Item Details

The owned item response should separate digital file coverage from physical copy
fields.

Digital details should include:

- source folder path when known;
- release track count;
- linked file count;
- missing file count;
- file coverage rows for the release track appearances covered by this digital
  copy.

Each file coverage row should include:

- `digitalTrackFileLinkId`;
- `releaseTrackId`;
- `trackId`;
- track title;
- release position fields, such as disc, side, and position;
- `localAudioFileId`;
- path;
- file format;
- codec and quality when known;
- size bytes when known;
- last modified timestamp when known;
- content hash when known.

Physical details should be separate per type:

- vinyl: storage location, media condition, sleeve condition, pressing notes;
- CD: storage location, media condition, booklet or sleeve condition, disc
  count, edition notes;
- cassette: storage location, media condition, case or insert condition, tape
  type, digitization status;
- other: name or description, storage location, condition, notes.

The first implementation can expose only fields already supported by the domain
model, but the API shape should be type-specific so digital details are not
encoded as nullable physical fields or old `MediumResponse.path` and
`MediumResponse.format` values.

## Track API

Track list and detail responses should expose related digital files as derived
collection context.

Add a `digitalFiles` projection to track responses. Each row represents a file
link that reaches the logical track through a release track appearance:

- `digitalTrackFileLinkId`;
- `localAudioFileId`;
- `digitalOwnedItemId`;
- `releaseId`;
- `releaseTitle`;
- `releaseTrackId`;
- release position fields, such as disc, side, and position;
- path;
- file format;
- codec and quality when known;
- size bytes when known;
- last modified timestamp when known;
- content hash when known;
- duration, bitrate, sample rate, and channel count when known.

This data is derived from:

- `Track`;
- `ReleaseTrack`;
- `OwnedItem`;
- `DigitalTrackFileLink`;
- `LocalAudioFile`.

It must not be persisted as `Track.fileMetadata`, and API response names should
avoid implying that the track owns the file.

Track list responses may return a compact version of `digitalFiles` if needed
for performance. Track detail responses should return enough information to
open the local file edit flow without another track-owned lookup.

## Local File Edit API

The old owned-item digital file update contract should be removed from the
active client surface:

`PATCH /api/owned-items/{ownedItemId}/digital-file`

Local file edit flows should update the concrete local file record:

`PATCH /api/local-audio-files/{localAudioFileId}`

The request should support fields produced by local inspection, rename, or tag
edit workflows:

- path;
- file format;
- codec;
- quality;
- size bytes;
- last modified timestamp;
- content hash;
- duration;
- bitrate;
- sample rate;
- channel count.

If a flow needs to move a release track appearance to a different local file, it
should use a link-level contract instead of a track contract:

`PATCH /api/digital-track-file-links/{digitalTrackFileLinkId}`

That link update should accept the replacement `localAudioFileId` and should
remain collection scoped.

The first implementation may skip the link update endpoint if no existing UI
flow needs relinking yet. Rename and tag edit support requires the
`LocalAudioFile` update endpoint.

## Frontend DTO And Client Boundary

Frontend API DTOs should match the new API contracts directly.

Required cleanup:

- remove `track` from owned item target DTO unions;
- remove old digital file fields from `MediumDto`;
- add type-specific owned item detail DTOs;
- add `TrackDto.digitalFiles`;
- replace owned-item digital file update client calls with local-audio-file
  update calls;
- update local file editor state to identify `localAudioFileId` and, when
  needed, `digitalTrackFileLinkId`.

The existing React screens can keep minimal internal adapters only to avoid
turning Roadmap 60 into a UI redesign. Those adapters must be downstream of the
new DTOs and must not keep the old API shape alive.

Roadmap 60 should leave the application in a state where future UI work can
rename and restructure visible sections around "digital files in collection"
without changing the API again.

## Error Handling

Expected API errors:

- `404 Not Found` when the owned item, local file, or file link does not exist
  in the current collection;
- `400 Bad Request` for invalid path, invalid metadata values, or unsupported
  owned item type details;
- `409 Conflict` when a local file update conflicts with the collection's local
  file identity rules, such as a duplicate normalized path if uniqueness is
  enforced;
- `422 Unprocessable Entity` only if an endpoint receives syntactically valid
  data that cannot be applied to the current release-owned file graph.

The API should prefer explicit error codes and messages that mention local audio
files or file links, not track-owned file metadata.

## Collection Isolation

All owned item, track projection, local audio file, and file link queries must be
scoped to the current collection.

Track responses should only include digital files from the current collection.
Owned item responses should only include release-copy details from the current
collection. Local audio file and file link updates should reject cross-collection
references before writing.

No public request should accept a user-supplied `collectionId` for these flows.

## Testing Direction

API tests should cover:

- owned item create and update requests reject or no longer expose track targets;
- owned item detail responses expose release-owned identity;
- digital owned item responses expose file coverage from
  `DigitalTrackFileLink` and `LocalAudioFile`;
- physical owned item responses expose physical fields separately from digital
  coverage;
- track detail and list responses include derived `digitalFiles` only for the
  current collection;
- local audio file patch updates file metadata without touching `Track`;
- local audio file patch enforces collection isolation and duplicate identity
  conflicts;
- the old owned-item digital file patch route is removed from the active client
  tests or explicitly rejected if the route remains during cleanup.

Frontend tests should cover:

- DTO and mapper updates for type-specific owned item details;
- `TrackDto.digitalFiles` mapping into the existing track detail data model;
- local file edit client calls targeting `localAudioFileId`;
- absence of `track` as an owned item target in owned item client types.

## Non-Goals

Roadmap 60 should not implement:

- visual redesign of track or owned item pages;
- export and restore contracts;
- Review Workbench detectors or cleanup actions;
- destructive local file deletion;
- audio byte storage;
- loose track-only ownership records;
- cloud sync or external catalog identity requirements.

