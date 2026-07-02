# Local File Open Design

## Context

DiscWeave already stores local audio file links as collection data exposed to
the app through `TrackRecord.digitalFiles`. Tracks, releases, and track stacks
can therefore derive the concrete local audio files connected to catalog
records without changing the domain model.

This design adds a desktop-only way to open those files with the operating
system's default application. It is intentionally not a playback queue, player
integration, or media-control feature.

## Goals

- Let users open a track's associated local audio file from the Tracks
  workspace by double-clicking the track or by using an explicit action.
- Let users inspect local files connected to a release or a track stack and
  open individual files from that list.
- Keep opening delegated to the operating system and the user's file
  associations.
- Avoid any behavior that can accidentally launch many audio files in parallel.

## Scope

The first version supports opening one concrete local audio file per user
action.

- A track with one local file opens that file directly.
- A track with multiple local files opens a file list instead of launching all
  files.
- A release opens a file list for the local files connected to its linked
  tracks.
- A track stack opens a file list for the full stack, including the original
  track and all stack members, regardless of the current Tracks filter.
- Each row in a release or stack file list has its own open action.

Bulk playback, playlist creation, player selection, player command-line
configuration, and queue management are out of scope.

## Product Decisions

Mass opening is deliberately excluded for releases and stacks. macOS can ask
LaunchServices to open multiple paths, but the result depends on the target
player. Some players may create a queue, while others may open separate windows
or start multiple tracks at the same time. DiscWeave should not expose an
action whose outcome it cannot make safe and predictable.

The UI should use file-oriented language such as `Open local file` and
`Local files`. It should not use player language such as `Play`, `Queue`,
`Album playback`, or transport controls.

## Desktop Boundary

Add a narrow Electron bridge for opening one local file:

```text
React UI -> preload localFiles.open(path) -> Electron main IPC handler
```

The main-process handler should:

- accept exactly one local file path;
- reject empty, relative, URL, or otherwise invalid paths;
- verify that the path exists and is a regular file;
- delegate successful opens to the system default application;
- return a structured result instead of leaking raw exceptions to the renderer.

This bridge should be separate from the existing local edit bridge. Local edits
modify file metadata. Local file open only delegates a file to the operating
system.

## UI Model

Add a focused React helper module for openable local files. It should derive a
small UI model from `TrackRecord.digitalFiles`:

```text
trackId
trackTitle
localAudioFileId
digitalTrackFileLinkId
path
format
releaseTitle
position
```

The helper should remove duplicates by stable local file identity when
available, falling back to normalized path. It should not introduce new backend
state.

## Track Interaction

In the Tracks workspace:

- double-clicking a track row invokes the same local-open flow as the explicit
  track action;
- if the selected track has one openable file, DiscWeave opens it immediately;
- if the track has multiple openable files, DiscWeave shows the local file list
  and lets the user open each file individually;
- if the track has no local files, the explicit local-open action is not shown
  and double-clicking the row only selects the track.

The explicit action should live in the track detail panel near existing track
actions. This keeps the track list readable while still making the feature
discoverable.

## Release Interaction

Release detail should expose an `Open local files` action when any linked track
has openable local files. Activating it shows a local file list for the release.

The list should:

- include files from tracks linked to the selected release;
- show the track title and release track position when available;
- de-duplicate files reused by multiple track contexts;
- provide a row-level `Open` action for each file;
- avoid any `Open all` action.

## Stack Interaction

Track stacks do not currently have a separate detail panel, so the first
version should place the explicit stack open action on the stack row in
`TrackStacksPanel`.

Activating it shows a local file list for the full stack:

- original/root track first;
- stack members grouped or ordered by the stack's existing display order;
- all stack tracks included even when current search or filters only reveal
  part of the stack;
- row-level open actions only.

## Local File List

Use one shared `LocalFileOpenPanel` or equivalent component for track,
release, and stack multi-file flows. It should fit the existing DiscWeave
desktop UI: compact, bordered, text-first, and consistent with current panel
and secondary-button styling.

Each file row should show enough context to choose the right file:

- track title;
- release context when available;
- position when available;
- format when available;
- local path, with long paths allowed to wrap or truncate safely;
- row-level `Open` action;
- per-row status after an open attempt.

The panel should be keyboard reachable and should not rely on color alone for
status.

## Error Handling

Opening is best effort at the row level.

The desktop handler should return structured failure reasons such as:

- `invalid-path`;
- `missing`;
- `not-file`;
- `system-error`.

The UI should show success or failure on the affected row. A failed row must not
block other rows in the same release or stack list. If a file is missing, the
user should see which file could not be opened.

## Superdesign Direction

Before implementing React UI changes, run the Superdesign existing-UI workflow
for the affected Tracks and Releases surfaces:

- use the existing `.superdesign/init` context;
- create a faithful current-UI reproduction first;
- iterate only within DiscWeave's existing design system;
- keep the dense desktop master-detail layout;
- avoid introducing new visual language, marketing-style cards, player chrome,
  decorative media, or unrelated navigation changes.

The implementation should follow the approved Superdesign direction, but the
functional requirements in this spec remain authoritative.

## Testing Direction

Add focused coverage for:

- preload exposes a `localFiles.open(path)` contract on `window.discweave`;
- the Electron main handler rejects invalid paths, missing paths, and
  directories;
- the Electron main handler delegates one existing file path to the system open
  API in a mocked test;
- openable-file helpers derive and de-duplicate files from tracks;
- a track with one file opens immediately on explicit action and double-click;
- a track with multiple files opens the local file list;
- release and stack flows show per-file open actions and no `Open all` action;
- stack file collection uses the full stack, not only filtered visible rows;
- failed opens mark only the affected row.

## Delivery Notes

Create a dedicated implementation branch before development starts. The design
spec can be committed separately before implementation planning.

## Non-Goals

- Built-in audio playback.
- Playback queue management.
- Opening all release or stack files in one operation.
- Generated M3U playlists.
- User-configured player executable or command-line arguments.
- Backend domain model changes.
- Import, export, deduplication, or destructive local file operations.

## Acceptance Criteria

- Users can open a single local audio file associated with a track from the
  Tracks workspace.
- Users can inspect release and stack local files and open each file
  individually.
- DiscWeave never offers a release or stack `Open all` action.
- Missing or failed files are reported without blocking other row-level opens.
- Tests cover the desktop bridge, helper model, and key UI interactions.
