---
type: Workflow
title: Watched Import Folders
description: A folder import can be watched so new releases join the same import and disk changes to known releases are flagged for an explicit decision.
tags: [workflow, import, desktop, local-files]
timestamp: 2026-10-10T00:00:00Z
---

# Watched Import Folders

A local folder can be watched from the desktop app, either by picking it or
from an existing import of it. Watching belongs to the folder, not to an import
session, and is desktop state: the list of watched folders, unseen-draft
markers, and dismissed change notices live in the desktop settings directory,
not in the collection database.

Each watched folder has one import session that receives its new releases. The
app assigns it: an open import of the same folder is reused, otherwise an empty
one is created, and when that import is archived or deleted the next check
moves the folder to another open import or a new empty one. Archiving an import
therefore never stops a watch.

## When a folder is checked

A watched folder is checked when the app starts, when the user asks for a check,
and while the app is open whenever the filesystem reports a change in the
folder. A check walks names, sizes, and modification times only; audio is
opened and hashed only for files that are new or that the user chose to act on.
In cloud-synced folders this means new releases are downloaded when scanned.

## What a check compares

The disk is compared against a baseline the backend builds for the folder:

- every catalog release with local files under the folder is represented by the
  files the catalog currently links to it, whichever import created it, so
  renames and tag edits made through the app are never reported as outside
  changes and a folder that was imported long ago needs no reimport;
- a draft still in review is represented by the files it was created from;
- skipped drafts, tracks left out of a confirmed release, loose-file
  candidates, and catalog files not linked to a release are known paths that
  never resurface as new.

## New releases

Files that belong to no known release are scanned and appended to the same
import session as new drafts or loose-file candidates. A release whose files
are all already drafted in the session is never appended twice, so repeated
checks do not duplicate drafts, and confirmation keeps the existing duplicate
matching, so Tracks are not duplicated. New drafts are marked until opened and
counted on the Imports navigation entry. Files placed directly in the watched
root, or in a new subfolder of a release that is not split into disc folders,
are treated as new releases rather than as changes to an existing one.

## Changes to known releases

A missing file whose size and modification time match exactly one unknown file
is a rename or move; other differences are reported as modified, new, or
missing files. Nothing is applied automatically.

- **Release already in the catalog:** the watched folder lists the release
  with its differences. Applying them points the linked local files at their renamed,
  moved, or modified versions and refreshes their size, timestamp, and content
  hash. Catalog titles, credits, and other reviewed metadata are not rewritten
  from changed tags. New files return as a fresh draft of the same release for
  normal review. Missing files are only flagged; nothing is deleted from disk or
  from the catalog. The notice can be dismissed and stays hidden until the
  folder differs in a new way.
- **Draft not yet confirmed:** the draft is flagged and can be recreated from
  the current folder contents, which discards edits made in that draft. Drafts
  created from loose files and confirmed drafts cannot be recreated.

## Related Knowledge

- [Import Deduplication](import-deduplication.md)
- [Destructive Operations](destructive-operations.md)
- [Local-First Desktop Direction](../product/local-first-desktop.md)
