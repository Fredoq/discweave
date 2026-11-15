# Desktop Import API Boundary

This document defines the API boundary for local folder scans produced by the
macOS desktop app. The browser app may review import sessions, but it must not
browse arbitrary local folders. The desktop app performs native folder
selection and local filesystem walking. In full-scan mode it also extracts audio
metadata, reads cover candidates, and calculates SHA-256 hashes before
submitting metadata to the API. In names-only mode it submits paths, file names,
file sizes, and timestamps without opening audio or cover files, so cloud-only
folders can be reviewed without downloading file contents.

The backend remains the owner of collection scope, import pattern parsing,
release grouping, review sessions, duplicate matching, confirmation, and final
catalog persistence.

## Endpoint

```http
POST /api/imports/desktop-folder-scans
```

The endpoint requires the authenticated collection-member cookie. The active
collection is resolved from the signed-in user's default collection. Clients
must not send `collectionId`, and normal import responses must not expose it.

Successful submissions return `201 Created` with the persisted
`ReleaseImportSession` detail response. The `Location` header points to
`/api/imports/{sessionId}`.

## Request Contract

```json
{
  "sourceRoot": "/Users/example/Music",
  "ignoredFileCount": 0,
  "diagnostics": [
    {
      "code": "metadata_read_failed",
      "severity": "warning",
      "message": "Import scanner could not read audio metadata for this file.",
      "filePath": "/Users/example/Music/Release/01 Track.flac",
      "relativePath": "Release/01 Track.flac",
      "extension": ".flac",
      "sizeBytes": 12345678,
      "source": "metadata"
    }
  ],
  "files": [
    {
      "filePath": "/Users/example/Music/Release/01 Track.flac",
      "relativePath": "Release/01 Track.flac",
      "format": "flac",
      "sizeBytes": 12345678,
      "lastModifiedAt": "2026-05-16T12:00:00Z",
      "contentHash": "70bc8f4b72a86921468bf8e8441dce51d8c6cb7d792fa7bbcb0d4d9eba328b75",
      "audioMetadata": {
        "title": "Track",
        "artists": ["Artist"],
        "albumTitle": "Release",
        "albumArtists": ["Artist"],
        "catalogNumber": "CAT-001",
        "releaseDate": "2026-05-16",
        "year": 2026,
        "durationSeconds": 321,
        "trackNumber": 1
      },
      "coverArtifact": null
    }
  ]
}
```

`sourceRoot` is the selected local folder root. `filePath` is the absolute local
path used for inventory and fallback duplicate matching. `relativePath` is the
path relative to `sourceRoot` and is used for grouping releases and tracks.

`diagnostics` is required, even when empty. The desktop scanner uses it for
files and directories that were skipped, hidden, unreadable, too large, past the
scan-depth limit, or partially readable. Diagnostic severities are `info`,
`warning`, or `error`. Persisted diagnostics are scoped to the import session
and do not create catalog, local audio file, or digital file link rows.

Supported audio formats are `flac`, `mp3`, `wav`, `ogg`, and `m4a`. Full-scan
desktop clients should send a SHA-256 `contentHash` for every supported audio
file. Names-only scans send `contentHash: null` and `audioMetadata: null`. The
backend accepts a missing hash, records a warning issue with code
`release_import.content_hash_missing`, and falls back to duplicate matching by
path, file size, and last modified time.

Cover images may be submitted only as import review artifacts, not as audio
files. Supported cover extensions are `.jpg`, `.jpeg`, `.png`, and `.webp`.
The backend accepts each supported cover artifact up to 10 MiB and retains
bounded app-owned review candidates. Full scans keep at most 32 candidates and
64 MiB per draft; skipped or invalid candidates produce actionable warnings.
Names-only scans do not retain image bytes or use source-path fallback for new
managed drafts. An explicit upload or external selection can supply a cover.

## Cover artwork review

`GET /api/imports/{sessionId}/drafts/{draftId}/cover-artwork` returns the selected
stored image, available stored candidates, editability, and actionable warnings.
Image metadata includes filename, content type, byte size, source path when
available, and an authenticated preview URL. Candidate image bytes are separate
from the session response, keeping normal import review payloads small.

`PUT` to the same route selects a stored candidate using `{ "candidateId": "..." }`.
`{ "candidateId": null }` explicitly selects no cover and clears both the stored
selected content and path fallback. `POST` to the route accepts one multipart
`file` field to import and select a local image. Mutations return the current
artwork state; they do not save unrelated draft metadata.

The `/image` child route serves the selected stored image. The
`/candidates/{candidateId}` child route serves a stored candidate. Every request
checks the active collection, session, and draft; a foreign resource is returned
as not found. These routes do not accept arbitrary filesystem paths or remote
image URLs. Confirmed and skipped drafts are not editable.

The selected image and explicit no-cover state survive reopening a draft.
Metadata saves cannot overwrite them through stale `coverPath` values. Recreating
the same local release draft preserves its selected snapshot or no-cover state.
Confirmation uses owned bytes; moving or deleting the original image does not
invalidate a selected stored cover. Reusing an existing catalog Release leaves
that Release's existing cover unchanged. Legacy path-only drafts show a warning
until the collector explicitly selects a stored image or no cover.

This feature uses the existing `artifacts/imports` area and the existing draft
cover fields. It requires no SQLite schema upgrade or collection reset. Back up
the full data directory to preserve unfinished review candidates.

### External cover lookup

The following child routes are scoped to the same authenticated draft:

- `GET /search?artist=...&title=...&catalogNumber=...&barcode=...` searches
  MusicBrainz editions and returns `{ "items": [...] }` with title, artist, date,
  country, format, label, catalog number, barcode, and source-page evidence.
- `GET /releases/{releaseId}` lists Cover Art Archive front images for the exact
  MusicBrainz release UUID. It does not fall back to a release group or another
  edition.
- `GET /releases/{releaseId}/images/{imageId}` serves a bounded preview through
  the authenticated backend, not an arbitrary image URL supplied by a client.
- `POST /external-selection` accepts `{ "releaseId": "...", "imageId": "..." }`.
  It revalidates the front image against that edition, downloads and validates
  its bytes, and only then replaces the draft selection with an owned copy.
  Failure leaves the previous image selected. The response is the normal cover
  artwork state.

Selected-image metadata includes optional `provenance` with provider, release
and image identifiers, source URL, download time, and SHA-256. After confirmation,
`GET /api/releases/{releaseId}/cover-image/provenance` exposes the stored source
for the active collection's cover. A local image without external provenance
returns a null provenance value.

Read-only search and previews do not change draft metadata. Source provenance
is stored alongside managed artwork and preserved on new-release confirmation;
reusing an existing release still does not overwrite its cover. The integration
uses the existing MusicBrainz configuration and request gate. Discogs images are
not fetched. See the [cover-art source boundary](../integrations/cover-artwork.md)
for network and source restrictions.

## Response Contract

The response uses the existing import session detail shape:

```json
{
  "id": "00000000-0000-0000-0000-000000000000",
  "sourceRoot": "/Users/example/Music",
  "status": "readyForReview",
  "draftCount": 1,
  "trackCount": 1,
  "ignoredFileCount": 0,
  "createdAt": "2026-05-16T12:00:00Z",
  "updatedAt": "2026-05-16T12:00:00Z",
  "diagnostics": [
    {
      "id": "00000000-0000-0000-0000-000000000003",
      "code": "metadata_read_failed",
      "severity": "warning",
      "message": "Import scanner could not read audio metadata for this file.",
      "filePath": "/Users/example/Music/Release/01 Track.flac",
      "relativePath": "Release/01 Track.flac",
      "extension": ".flac",
      "sizeBytes": 12345678,
      "source": "metadata",
      "createdAt": "2026-05-16T12:00:00Z"
    }
  ],
  "diagnosticSummaries": [
    {
      "code": "metadata_read_failed",
      "severity": "warning",
      "count": 1
    }
  ],
  "drafts": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "sourcePath": "/Users/example/Music/Release",
      "relativePath": "Release",
      "status": "ready",
      "title": "Release",
      "type": "unknown",
      "catalogNumber": "CAT-001",
      "labelName": null,
      "releaseDate": "2026-05-16",
      "year": 2026,
      "isVariousArtists": false,
      "notOnLabel": false,
      "artistNames": ["Artist"],
      "artistCredits": [
        {
          "artistId": null,
          "name": "Artist",
          "role": "mainArtist"
        }
      ],
      "selectedArtistIds": [],
      "artistSuggestions": [],
      "labels": [],
      "genres": [],
      "tags": [],
      "coverPath": null,
      "issues": [],
      "tracks": [
        {
          "id": "00000000-0000-0000-0000-000000000002",
          "filePath": "/Users/example/Music/Release/01 Track.flac",
          "relativePath": "01 Track.flac",
          "format": "flac",
          "sizeBytes": 12345678,
          "lastModifiedAt": "2026-05-16T12:00:00Z",
          "durationSeconds": 321,
          "position": 1,
          "title": "Track",
          "artistNames": ["Artist"],
          "artistCredits": [
            {
              "artistId": null,
              "name": "Artist",
              "role": "mainArtist"
            }
          ],
          "artistSuggestions": [],
          "trackSuggestions": [],
          "isSkipped": false,
          "selectedTrackId": null,
          "selectedArtistIds": [],
          "issues": []
        }
      ]
    }
  ]
}
```

Import issue and scan diagnostic severities are `info`, `warning`, or `error`.
Error issue severity keeps the affected draft in `needsReview`; warning issue
severity preserves a reviewable draft while surfacing data quality or
duplicate-detection concerns. Scan diagnostics are session-level evidence from
the desktop scanner and remain visible even when no draft is created for the
affected path.

## Deduplication

Duplicate matching is scoped to the authenticated user's active collection.
The backend never matches files globally across users or collections.

Matching order:

1. Normalized SHA-256 `contentHash`.
2. Fallback fingerprint: `filePath + sizeBytes + lastModifiedAt`.

When a scan matches an existing owned digital track, the draft track receives
`selectedTrackId` and a `release_import.duplicate_file` warning. Confirming a
fully duplicate draft is a no-op for existing release, track, and owned item
rows. Confirming a partial duplicate reuses a same-title release only when the
existing release tracklist is safely represented by selected duplicate tracks in
the reviewed draft; the backend then appends only missing tracks and owned
digital items. Repeating the same scan must not create duplicate catalog data.

## Watched Folders

The desktop app may keep watching a folder it imported. Two session-scoped
endpoints support this without changing the stored import model.

```http
GET /api/imports/{sessionId}/folder-baseline
```

Returns what the session's source folder should be compared against on disk.
`drafts` holds two kinds of entries: every catalog release of the collection
with local files under the source root (`draftId` null, `releaseId` and `title`
set, files with `localAudioFileId`, size, and modification time), whichever
import created it, and every draft of this session still in review (`draftId`
set, the files it was created from). `otherKnownPaths` lists skipped and
confirmed draft files, loose-file candidates, and catalog files under the root
that are not linked to a release. Archived sessions return `404` so the desktop
app moves the watched folder to another import.

```http
POST /api/imports/{sessionId}/desktop-folder-scans
```

Appends a partial rescan to the existing session. The body is
`{ "scan": <desktop folder scan request>, "replaceDraftIds": [] }`, and
`scan.sourceRoot` must equal the session source root. A scanned release whose
files are all already drafted in the session is skipped, so repeating the same
request never duplicates drafts or loose-file candidates. Drafts named in
`replaceDraftIds` are deleted and recreated from the scan; confirmed drafts and
drafts created from loose files are rejected. Duplicate matching and relation
suggestions run as they do for a new scan, and the session reopens for review
when drafts are added.

## No Audio Uploads

The v1 API stores metadata, local paths for inventory, hashes, file size,
timestamps, review issues, and optional cover artifacts. It must not receive,
store, proxy, stream, or serve third-party audio file bytes.

Roadmap 15 should keep folder selection and scanning behind the Electron
main/preload boundary. Roadmap 16 can build on this contract for deeper import
review, grouping, confirmation, and deduplication behavior without reopening
the desktop/browser filesystem boundary.
