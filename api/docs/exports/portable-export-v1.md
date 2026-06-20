# Portable Export

Portable export is the contract for user-owned collection exports. It exists for
portability, spreadsheet work, and personal backups. Local database backup and
recovery behavior for the desktop product is tracked by Roadmap 44.

## Endpoints

```http
GET /api/exports/json
GET /api/exports/csv
POST /api/exports/json/restore
```

All export and restore endpoints require the authenticated collection-member
cookie. The active collection is resolved from the signed-in user's default
collection. Clients must not send `collectionId`, and export responses must
not expose it.

`GET /api/exports/json` returns `200 OK` with a JSON snapshot.
`GET /api/exports/csv` returns `200 OK`, `application/zip`, and
`discweave-export-csv.zip`. `POST /api/exports/json/restore` restores a
supported JSON snapshot into the authenticated user's empty active collection
only when the request includes:

```http
X-DiscWeave-Confirm-Restore: restore-empty-collection
```

## JSON Snapshot

The JSON snapshot uses readable catalog API shapes rather than persistence
models. Current exports use `formatVersion: 2`. Restore remains compatible with
legacy `formatVersion: 1` snapshots. The top-level sections are:

- `artists`
- `labels`
- `releases`
- `tracks`
- `ownedItems`
- `localAudioFiles`
- `digitalTrackFileLinks`
- `playlists`
- `credits`
- `artistRelations`
- `trackRelations`
- `dictionaries`
- `importPatterns`
- `namingProfiles`
- `tagRoleMappings`
- `trackRelationParserRules`
- `releaseNamingOverrides`
- `ratingCriteria`
- `ratings`

Review Workbench persisted triage state is intentionally omitted from portable
export v1. It is local workflow state derived from current catalog signals plus
user triage decisions. Users can regenerate active review items from the
restored catalog after restore, but dismissed, resolved, reopened, and note
state does not travel with this export format.

The snapshot intentionally includes convenience read fields that help users
inspect the archive outside DiscWeave: track release appearances, owned item
targets, release-owned local file metadata, file-to-release-track links,
inventory signals, playlist results, release labels, tracklists, credit names,
tags, genres, external source provenance, and release cover metadata. These
fields are part of the portable JSON export and must remain restore-compatible
for supported format versions.

Release tracklist items may include optional `disc` and `side` fields. They are
grouping labels only; `position` remains the release-wide tracklist order.
Older v1 snapshots without these fields remain valid and restore with no
disc/side markers.

The snapshot must not include user account data, collection ids, internal
database-only fields, import review sessions or drafts, Review Workbench triage
state, raw cover image bytes, cover artifact `contentBase64`, or audio file
bytes. `localAudioFiles` may include local absolute paths, file metadata, and
content hashes so duplicate detection and release-owned file links can survive
restore.

## CSV ZIP

The CSV export is a ZIP archive of normalized tables for spreadsheet workflows.
CSV fields use UTF-8 without BOM. Values that could be interpreted as formulas
by spreadsheet tools are prefixed with `'`.

The current archive entries and headers are:

| File | Header |
| --- | --- |
| `artists.csv` | `id,type,name` |
| `labels.csv` | `id,name` |
| `releases.csv` | `id,title,type,label_id,year,release_date,is_various_artists,not_on_label,genres,tags,cover_image_url,cover_image_content_type,cover_image_original_file_name,cover_image_size_bytes,cover_image_source_type` |
| `release_labels.csv` | `release_id,label_id,name,catalog_number,has_no_catalog_number` |
| `release_tracklist.csv` | `release_id,release_track_id,track_id,position,title,duration_seconds,disc,side` |
| `local_audio_files.csv` | `id,path,format,codec,quality,size_bytes,modified_at,content_hash,duration_seconds,bitrate_kbps,sample_rate_hz,channels` |
| `digital_track_file_links.csv` | `id,digital_owned_item_id,release_track_id,local_audio_file_id` |
| `tracks.csv` | `id,title,duration_seconds,genres,tags` |
| `owned_items.csv` | `id,release_id,release_title,status,medium_type,medium_description,medium_disc_count,condition,storage_location` |
| `playlists.csv` | `id,name,type,description,rule_tags,rule_genres,rule_media,rule_ownership_statuses,rule_year_from,rule_year_to` |
| `playlist_entries.csv` | `playlist_id,position,kind,id,title` |
| `credits.csv` | `id,contributor_artist_id,contributor_name,target_type,target_id,role` |
| `artist_relations.csv` | `id,source_artist_id,target_artist_id,type,start_year,end_year` |
| `track_relations.csv` | `id,source_track_id,target_track_id,type` |
| `dictionaries.csv` | `id,kind,code,name,sort_order,is_active,is_builtin,is_protected,media_profile` |
| `track_relation_parser_rules.csv` | `id,relation_type_code,alias,match_mode,confidence,direction,sort_order,is_active,is_builtin` |
| `import_patterns.csv` | `id,kind,template,sort_order,is_active,is_builtin` |
| `rating_criteria.csv` | `id,code,name,target_types,sort_order,is_active,is_builtin,is_protected` |
| `ratings.csv` | `id,criterion_id,target_type,target_id,value` |
| `review_report.csv` | `category,subtype,title,source_detector,target_kind,target_id,target_title,target_subtitle` |

Multi-value fields such as `genres`, `tags`, `target_types`, and smart
playlist rule arrays are joined with `|`.

The `release_tracklist.csv` `disc` and `side` columns are grouping labels.
Empty values mean no grouping marker.

The `local_audio_files.csv` and `digital_track_file_links.csv` tables preserve
release-owned local file metadata and links. They do not contain audio bytes.

The `review_report.csv` table contains a generated point-in-time report of
active Review Workbench signals and targets. It is for documentation and audit
work; JSON restore does not import it, and persisted triage state remains
outside portable export v1.

External source provenance is JSON-only. CSV exports intentionally omit
`externalSources`.

## Cover And Import Boundaries

Exports include cover metadata only: API URL, content type, original file name,
size in bytes, and source type. They do not include raw cover bytes. A restored
snapshot preserves stored cover metadata but does not recreate object storage
bytes.

Confirmed desktop imports become ordinary catalog data and are included in
exports as releases, tracks, credits, labels, owned digital items, and media
paths. Release-owned file metadata and file links are included when they exist.
Export v1 does not include import review sessions, draft issues, desktop scan
DTOs, cover artifact base64 content, audio metadata request payloads, or audio
file bytes.

## Restore Boundary

JSON restore is a portability and personal backup tool. It requires an empty
active collection, preserves public ids from the snapshot, and rejects
unsupported `formatVersion` values or invalid references with structured
errors. Missing settings arrays from older supported snapshots restore as empty
settings sections. Full local database backup and recovery remain outside
portable export and are covered by the local backup roadmap item.
