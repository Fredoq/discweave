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

The editor saves only name, description, and ordered track references. Save waits
for the server, preserves its returned identity, and retains the draft on write
failure. A refresh failure after a successful write is not a failed save and must
not offer a retry that creates a duplicate. Cancel explicitly discards a changed
draft. Existing Smart playlists remain read-only and retain their exact rules;
manual editing never converts their type.

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
