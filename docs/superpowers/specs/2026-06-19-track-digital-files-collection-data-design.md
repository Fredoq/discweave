# Track Digital Files As Collection Data Design

## Context

This specification defines the UI design for GitHub issue
`Fredoq/discweave#46`, Roadmap 62: show track digital files as related
collection data.

This work builds on:

- `docs/superpowers/specs/2026-06-18-release-owned-digital-copies-design.md`;
- `docs/superpowers/specs/2026-06-19-owned-item-track-local-file-api-contracts-design.md`;
- `docs/superpowers/specs/2026-06-19-owned-items-digital-physical-ui-design.md`.

Roadmap 62 is a Tracks UI and local-file edit flow refinement. It should
consume the release-owned file model and the existing `TrackResponse.DigitalFiles`
projection. It should not reopen backend ownership modeling, import confirmation,
Owned Items UI, Review Workbench detectors, export/restore, or loose-file import.

The selected visual direction is SuperDesign variant A, "Grouped Release-Copy
Context":

https://p.superdesign.dev/draft/a55e77fd-3912-43da-9114-913578d94241

## Product Decision

Track detail must treat local files as derived collection context, not as
track-owned metadata.

`Track` remains the logical music entity: title, duration, artists, credits,
release appearances, relations, ratings, tags, and playlist backlinks. Digital
files appear only because the track is present in one or more release track
appearances, and those appearances are linked through digital owned release
copies to concrete local audio files.

The UI should therefore replace `Local files` with `Digital files in collection`.
That copy is intentionally explicit: it tells the user that the section is about
collection ownership relationships, not a storage field on the track itself.

## Visual Direction

Use the existing DiscWeave desktop shell and calm collector-tool visual language:

- dense master-detail layout;
- restrained borders and pale selected states;
- Inter/system typography;
- small uppercase labels;
- compact secondary buttons;
- status badges that use text, not color alone;
- no player controls, waveform UI, queue language, social framing, marketplace
  framing, or recommendation copy.

The selected design keeps the surrounding Tracks page stable. It changes only
the local-file area inside the track detail panel.

## Track Detail Structure

The Track detail panel should keep track facts as facts:

- header and track actions;
- ratings;
- release appearances;
- track credits;
- track relations;
- `Digital files in collection`;
- playlist backlinks.

`Digital files in collection` should remain a peer section, not a child of
release appearances. The release appearances section answers where the logical
track appears. The digital files section answers which owned digital release
copies and local files are connected through those appearances.

## Digital Files Section

The section should start with a compact summary derived from
`track.digitalFiles`:

- linked file rows;
- unique local files;
- reused local file contexts;
- distinct local file paths.

The summary should stay small enough for the existing right-side detail panel.
It is an orientation aid, not a dashboard.

After the summary, render release-copy grouped file rows. Each row should show:

- release title;
- release track position, including disc and side when available;
- local file path;
- format;
- codec;
- quality;
- content hash when available;
- duration, bitrate, sample rate, and channel count when available;
- row-level edit action.

Rows should keep long paths scannable. Visual text can truncate or wrap within
the panel, but the full path must remain available through a native `title`
attribute or equivalent accessible label.

## Shared And Different File Contexts

The UI must make two important collection cases visible.

If the same `localAudioFileId` appears in multiple digital file rows, show that
the same local file is reused by multiple release-copy contexts. A concise badge
such as `Same local file reused` is enough.

If the same logical track has multiple distinct paths across release contexts,
show that those contexts use different files. A concise badge such as
`Different file path` is enough.

These states are informational. Roadmap 62 should not automatically merge,
delete, relink, or deduplicate files.

## Row-Level Local File Editing

Local file editing should be attached to a concrete file row.

Each editable row should expose a secondary `Edit file` action. Clicking it
opens the existing local file editor for that row's `localAudioFileId`, while
using the selected row's release-copy and release-track context to populate
metadata tags and naming previews.

The implementation should stop treating the first digital file on a track as
the only editable local file. It can support this by either:

- extending `localEditableFileFromTrack` with a selected
  `TrackDigitalFile`; or
- adding a focused helper such as `localEditableFileFromTrackDigitalFile`.

The local editor remains desktop-only. Browser mode should still hide local
edit actions.

## Empty And Partial States

If `track.digitalFiles.length === 0`, show:

`No digital files linked to this track through release copies yet.`

This empty state should not say that the track is missing a file. It should
describe the absence of collection links.

If a file row has missing codec, quality, hash, or technical metadata, show the
existing neutral fallbacks such as `Not recorded`. Missing technical metadata
should not block display of the row.

If a row has a path and no format, keep the row visible and show
`Unknown format`.

## Search And Filters

The existing Tracks filter labeled `File format` can remain, but it should keep
reading from `track.digitalFiles`.

Track search text should continue to include local file paths, formats, quality,
bitrate, sample rate, channel count, and content hash from `track.digitalFiles`.
Search copy should avoid implying that those values are stored on `Track`.

## Data Mapping Direction

Roadmap 60 already introduced `TrackResponse.DigitalFiles` and frontend
`TrackRecord.digitalFiles`. Roadmap 62 should build on that shape.

The UI should not reintroduce `Track.fileMetadata` or any single-file track
projection. It should preserve the one-to-many relationship:

`Track -> ReleaseTrack appearances -> DigitalTrackFileLink -> LocalAudioFile`.

Derived helpers may group rows by release copy, local file id, or path, but they
must remain downstream of `TrackRecord.digitalFiles`.

## Accessibility And Responsive Behavior

The section must stay keyboard reachable.

Each `Edit file` button needs an accessible name that identifies the row, such
as `Edit file for Selected Ambient Works 85-92 track 3`.

Badges for shared-file and different-path states must include readable text.
They must not rely on color alone.

On narrow widths, file rows should stack rather than overflow. The existing
detail panel should not force horizontal scrolling for ordinary file metadata.

## Testing Direction

Roadmap 62 implementation should add focused Testing Library coverage:

- the Track detail section title is `Digital files in collection`;
- the old `Local files` heading is no longer rendered in Track detail;
- digital file rows show release copy context and release track position;
- a shared `localAudioFileId` reused by multiple release-copy contexts is shown
  as reused;
- one logical track with different paths across release contexts is shown as
  different paths;
- each row-level `Edit file` action opens the local file editor for that row's
  `localAudioFileId`;
- browser mode still hides local edit actions;
- file format filtering and search still use `track.digitalFiles`.

Mapper or helper tests should cover any new grouping helpers for reused files
and distinct paths.

## Non-Goals

Roadmap 62 should not implement:

- backend ownership model changes;
- new import confirmation behavior;
- Owned Items UI changes;
- Review Workbench detectors;
- export or restore changes;
- destructive local file deletion;
- automatic file deduplication, merge, cleanup, or relinking;
- playback or player-oriented flows;
- loose local file import without release context;
- cloud sync, marketplace, social, or recommendation features.

## Acceptance Criteria

The implementation is complete when:

- Track detail no longer implies that local file metadata is stored on the
  track;
- users can see all digital files connected to a logical track and the
  release-copy context for each one;
- shared-file reuse and different-path contexts are visible;
- local file editing acts on the selected file row, not an implicit first file;
- tests cover shared-file, different-path, and row-level edit scenarios.
