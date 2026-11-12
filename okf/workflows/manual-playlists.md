---
type: Workflow
title: Manual Playlists
description: Ordered track selections with explicit saves and non-destructive legacy handling.
tags: [playlists, tracks, data-safety]
---

# Manual Playlists

A manual playlist is an ordered list of track references, not a playback queue.
Every occurrence is independent: A, B, A remains three entries. Reordering or
removing an occurrence does not change the track or its collection membership.
Album information is context, not a selectable playlist entry.
The picker marks tracks already present and disables adding them again. Existing
repeated occurrences are preserved and remain individually reorderable/removable;
removing the last occurrence makes the track available to add again. Addition
feedback stays in the picker, with a direct action to view the selected tracks.

The editor saves only name, description, and ordered track references. Save waits
for the server, preserves its returned identity, and retains the draft on write
failure. A refresh failure after a successful write is not a failed save and must
not offer a retry that creates a duplicate. Cancel explicitly discards a changed
draft. Existing Smart playlists remain read-only and retain their exact rules;
manual editing never converts their type.

New manual drafts retain one client request UUID for their lifetime, including
lost-response retries and track-only copies. The create API accepts that optional
UUID as the playlist identity within the current collection: identical normalized
payload replays return the existing record, while a changed payload returns a
conflict. Concurrent replays cannot insert duplicate playlists. Older clients
that omit the key retain ordinary create semantics. Successful saves update the
returned playlist without a discarded full-catalog reload.

## Legacy Release References

Opening an old manual playlist does not migrate or save it. Release references
are projected into track rows in the stored entry order and release tracklist
order. The original is read-only. An explicit track-only copy creates a separate
unsaved record that the collector reviews and saves under a new identity.

Copying requires a known original order and a complete resolution of every
reference. Missing releases, missing tracklists, unresolved tracks, or release-only
rows without standalone Track IDs block copying with an explanation. Never drop
such rows, create substitute Track IDs, or silently replace release references.
Repeated references remain repeated in the copy. Smart rules and original
playlists are not rewritten by this workflow.

## External-Player Export

Saved track-only manual playlists can be exported from the desktop app as UTF-8
M3U8 files. This is an external-player handoff, not built-in playback. Track order
and repeated occurrences are preserved. A sole linked audio file is selected;
multiple linked files require an explicit choice for each occurrence, including
its release appearance. Smart playlists and legacy release references are outside
this first export stage; legacy selections must first become a lossless copy.

Before export, the desktop process verifies the current collection's Track/file
link, authoritative path, local trust, and a readable regular audio file. Missing,
unverified, unsupported, and unlinked entries remain visible. Omitting unavailable
entries requires explicit partial-export consent; zero available entries cannot
be exported. Availability is checked again before and after the Save dialog. A
changed result or expired inspection requires review again rather than silent
omission. Inspections accept at most 10,000 occurrences. Each catalog lookup has
a 15-second deadline; the complete inspection has a 60-second budget and stops
scheduling work on timeout. A failed recheck clears the previous availability
result and requires a successful new inspection before export.

The output contains absolute file URLs and sanitized EXTINF metadata. It contains
no audio, changes no catalog or source files, and opens no player automatically.
Paths are tied to this Mac and must be re-exported after files move; codec support
belongs to the external player. Browser mode cannot verify local availability and
therefore does not expose an active export action.
