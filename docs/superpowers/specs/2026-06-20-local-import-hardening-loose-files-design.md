# Local Import Hardening And Loose Files Design

## Context

This specification defines the product contract for GitHub issue
`Fredoq/discweave#51`, Roadmap 70: define local import hardening and loose-file
workflow scope.

DiscWeave is a local-first music archive. Folder import already supports desktop
folder selection, names-only and full scans, release import drafts, SHA-256
identity, audio metadata extraction, review, deduplication, confirmation,
release-owned digital copies, `LocalAudioFile` rows, and
`DigitalTrackFileLink` rows.

The next import step is to make messy real-world local libraries reviewable
without losing context, creating fake catalog data, or moving cleanup into the
Review Workbench. Review Workbench remains skipped for this roadmap slice. The
Imports workspace is the staging surface for scanned folders, release drafts,
loose file candidates, diagnostics, and explicit user actions.

This work builds on:

- `api/docs/imports/desktop-import-api-boundary.md`;
- `docs/superpowers/specs/2026-06-18-release-owned-digital-copies-design.md`;
- `docs/superpowers/specs/2026-06-19-local-audio-file-link-persistence-design.md`;
- `docs/superpowers/specs/2026-06-19-import-confirmation-file-links-design.md`.

## Product Decision

Local import hardening should preserve all useful scan context and expose it to
the user before catalog writes happen.

A scan can produce three kinds of reviewable output:

1. release drafts, for files with enough release context to enter the existing
   review and confirmation flow;
2. loose file candidates, for supported audio files that should stay reviewable
   but must not become release drafts automatically;
3. scan diagnostics, for skipped, ignored, failed, or constrained files and
   folders.

Loose files are import workflow data. They are not catalog tracks, standalone
owned items, or Review Workbench items in this slice.

Confirmation remains explicit. DiscWeave must not automatically merge duplicate
file identities, delete old local file rows, move files on disk, rewrite paths,
or create fake releases to make a scan look complete.

## Workflow Terms

`Release draft` means an import-review draft that can be edited, skipped, and
confirmed through the existing release import flow. Confirming a release draft
creates or reuses catalog data, one digital release owned item, local audio
files, and digital track file links.

`Loose file candidate` means a supported scanned audio file that belongs to the
current import session but does not yet have enough user-reviewed release
context. A loose candidate can later be used to create a release draft, attach to
an existing release, remain pending, or be ignored for that import session.

`Ignored file` means a scanned filesystem entry that is intentionally not a
release draft or loose candidate. Unsupported extensions, hidden paths, symlinks,
non-files, unreadable entries, and excessive nesting are examples. Ignored files
should be represented through diagnostics, not catalog rows.

`Scan diagnostic` means a structured explanation of something the scanner or API
noticed while walking and ingesting a selected folder. Diagnostics can be
informational, warning-level, or error-level. Diagnostics can summarize ignored
files and can also point to specific paths when safe.

`Rescan` means scanning a previously imported `sourceRoot` again as a new or
versioned import session. Rescan must not silently mutate prior reviewed
sessions.

`Moved or renamed file hint` means DiscWeave detects that a scanned file looks
like a previously known file at a different path. It is a hint for user review,
not an automatic path rewrite or cleanup instruction.

`Attach-to-existing-release flow` means the user selects loose files, chooses an
existing release, maps files to release track rows, and explicitly confirms
creation or reuse of local audio files, a digital owned item, and file links.

## Classification Rules

Classification should be conservative. When DiscWeave is not confident, it
should preserve loose candidates and ask the user later instead of inventing
catalog structure.

### Normal Release Folders

A folder should become a release draft when its audio files share a clear release
context. Safe signals include a single folder that maps to a release naming
pattern, consistent album tags, consistent album artist tags, or a tracklist that
can be reviewed as one release.

Multi-disc and side subfolders can still belong to one release draft when they
live under the same release root and their tags or paths agree.

### Root-Level Files

Root-level audio files should become a release draft only when they clearly form
one release. Examples include a small selected folder whose root files share one
album tag, one album artist, and compatible track numbers.

Root-level files with unrelated album tags, no album tags, or conflicting
metadata should become loose file candidates or multiple candidate groups. They
must not be forced into one fake release draft.

### Mixed Album Tags

A folder with multiple album tags should not automatically become one release
draft unless the grouping is otherwise unambiguous. The default behavior should
be loose candidate groups grouped by album tag or folder context, with a warning
that the user must review the grouping.

Future album-tag clustering can suggest release drafts, but it should remain
reviewable and reversible.

### Missing Album Tags

Files without album or album artist tags can still become a release draft when
folder naming and track numbering provide enough context. If both path and tags
are weak, the files should remain loose candidates.

### Singles

Single-track releases are valid release drafts when the user selected a folder
or group that clearly represents one release or single. A single loose file at a
library root should stay a loose candidate until the user chooses to create a
release draft or attach it to an existing release.

### Compilations

Compilation folders can become release drafts when the folder or tags indicate a
single compilation release. Various-artist tags should not make DiscWeave split a
valid compilation into unrelated loose files.

Track-level artist differences inside one compilation are expected and should be
reviewed as release track metadata.

### Moved Or Renamed Files

A file with the same content hash at a different path should be shown as a likely
moved or renamed file. A same size and modified timestamp match without a hash is
only a low-confidence hint.

Moved or renamed hints should help the user choose an explicit relink or import
decision. The old `LocalAudioFile` row remains valid archive data until a future
explicit cleanup feature says otherwise.

### Duplicate Hashes At Different Paths

The same content hash at different paths is valid collection data. It can mean a
copied file, a reused file across releases, a moved file, or a duplicate. It must
not trigger automatic merge or deletion.

Duplicate identity information can be used for import suggestions and warnings,
but the user decides whether to attach, relink, ignore, or leave candidates
pending.

## Scan Diagnostics

The scanner should report structured diagnostics instead of only an aggregate
ignored count.

Recommended diagnostic fields:

- code;
- severity;
- message;
- absolute path when safe;
- relative path when available;
- extension when available;
- size bytes when available;
- optional source subsystem such as scanner, metadata, hashing, cover, or API.

Recommended diagnostic codes include:

- `hidden_path`;
- `symlink_ignored`;
- `non_file_ignored`;
- `unsupported_extension`;
- `depth_limit`;
- `directory_unreadable`;
- `file_stat_failed`;
- `metadata_read_failed`;
- `hash_read_failed`;
- `cover_too_large`;
- `cover_read_failed`.

Diagnostics should support both detail rows and grouped counts so large scans do
not become unreadable.

Names-only scans must keep their existing safety guarantee: they submit paths,
file names, sizes, timestamps, and supported-format metadata without opening
audio or cover file bytes.

Full scans should continue after per-file failures and report each failure as a
diagnostic when possible.

## Loose File Candidate Model

A loose candidate should preserve enough scan data for later user action without
creating catalog rows.

Recommended fields:

- candidate id;
- collection id, stored internally only;
- import session id;
- optional source draft id or draft track id if the file came from a skipped or
  unresolved draft context;
- absolute path;
- relative path;
- file format;
- size bytes;
- last modified timestamp;
- optional content hash;
- optional duration;
- optional codec;
- optional lossless or lossy quality;
- optional bitrate;
- optional sample rate;
- optional channel count;
- tag hints such as title, artists, album title, album artists, catalog number,
  release date, year, and track number;
- reason code;
- decision state;
- decision timestamp where useful.

Initial decision states should stay small:

- `pending`, for candidates that still need user attention;
- `ignored`, for candidates the user intentionally hides from the active import
  session without deleting anything;
- `convertedToDraft`, for candidates consumed by a release draft;
- `attachedToRelease`, for candidates consumed by an explicit existing-release
  attachment flow.

The model should be idempotent within an import session. Re-ingesting the same
candidate should not create duplicate pending candidates when path, size,
modified timestamp, hash, and source context are unchanged.

## User Actions

### Create Release Draft From Loose Files

The user can select one or more loose candidates and create a normal release
import draft. DiscWeave may seed release and track fields from shared tags,
filenames, track numbers, and cover candidates. Conflicting hints should become
warnings, not blockers.

The created draft uses the existing import editor and confirmation flow. The
loose candidates become `convertedToDraft` only after a draft is created.

### Attach Loose Files To Existing Release

The user can select loose candidates, search for an existing release, map files
to release track rows, and explicitly confirm the attachment.

Confirmation creates or reuses:

- `LocalAudioFile` rows;
- one digital `OwnedItem` for the release where needed;
- `DigitalTrackFileLink` rows.

If a release track already has a linked file, replacing or relinking requires an
explicit confirmation message. The action must not delete the old local file row
or any file on disk.

### Leave For Later

Leaving a candidate pending is valid. The user may close and reopen the import
session later. This does not create catalog data.

### Ignore From Session

Ignoring a candidate is non-destructive and scoped to import workflow state. It
does not delete catalog rows, local audio file rows, file links, or files on
disk.

## Rescan And Moved File Semantics

A rescan of a saved import source should create a new or explicitly versioned
session. It should not silently mutate a prior reviewed session.

Incremental scanner manifests can optimize full scans by reusing hash and audio
metadata for unchanged files. A cached entry can be reused only when the scanner
version, relative path, size, and modified timestamp indicate that the cached
metadata still applies.

Moved or renamed file detection should prefer content hash. When no hash exists,
DiscWeave may show lower-confidence hints from size and modified timestamp, but
must not auto-select or relink solely from weak evidence.

Rescan should preserve the distinction between:

- a known file intentionally reused by multiple release copies;
- a file copied to a different path;
- a file moved or renamed;
- an ambiguous duplicate identity.

All outcomes stay reviewable.

## API, Desktop, And UI Boundaries

The desktop app owns local folder selection, filesystem traversal, hashing,
metadata reads, cover reads, scan diagnostics, incremental scan manifests, and
safe path access through Electron main/preload.

The API owns collection scope, import session persistence, release draft
creation, loose candidate persistence, deduplication, confirmation, catalog
writes, and file-link writes.

The renderer can review import sessions, diagnostics, release drafts, loose
candidates, and explicit user actions. It must not browse arbitrary local paths
or receive the local API sidecar token.

UI work for Roadmap 73, Roadmap 76, and later import flows should use
SuperDesign before implementation so the dense collector-workflow UX is designed
before React code changes.

## Downstream Issue Boundaries

Roadmap 71 adds structured scanner diagnostics in the Electron desktop scanner.

Roadmap 72 persists scan diagnostics in import sessions and exposes them through
API responses.

Roadmap 73 shows scan diagnostics and release-level draft issues in the import
UI.

Roadmap 74 adds a read-only import confirmation preflight summary.

Roadmap 75 persists loose file candidates in import sessions.

Roadmap 76 adds a Loose Files view to the Imports workspace.

Roadmap 77 creates release drafts from loose files.

Roadmap 78 attaches loose files to existing releases.

Roadmap 79 adds incremental rescan support for local folders.

Roadmap 80 adds a Rescan action for saved import sessions.

Roadmap 81 detects moved and renamed files during rescan.

Roadmap 82 adds import session cleanup and filtering.

Roadmap 83 adds regression fixtures and acceptance coverage.

## Testing Direction

Downstream implementation should cover:

- structured diagnostics for ignored, skipped, unreadable, unsupported, and
  oversized files;
- names-only scans that do not open audio or cover bytes;
- full scans that continue after per-file failures;
- diagnostic persistence and collection isolation;
- loose candidates that do not create catalog or ownership data by themselves;
- loose candidate idempotency;
- creating release drafts from loose candidates;
- attaching loose candidates to existing releases;
- explicit relink confirmation when a release track already has a linked file;
- rescan behavior for missing roots, unchanged files, changed files, and moved
  files;
- duplicate hashes at different paths as reviewable data, not automatic cleanup;
- no audio bytes stored or uploaded;
- import session cleanup that never deletes confirmed catalog data.

## Out Of Scope

This design does not implement API, Electron, React, persistence, export,
restore, or test fixture changes.

This design does not implement Review Workbench integration.

This design does not define automatic merge, automatic duplicate cleanup,
automatic relation creation, or destructive file operations.

This design does not move, rename, delete, stream, proxy, upload, or store audio
bytes.

This design does not require Discogs, MusicBrainz, cloud sync, SaaS, mobile,
social, marketplace, recommendation, or playback scope.
