---
type: Domain Entity
title: Rating
description: Five-point ratings per criterion with a standout mark, plus computed track averages for releases, labels, and artists.
tags: [domain, entity, rating]
timestamp: 2026-10-11T00:00:00Z
---

# Rating

A Rating is the collector's own score for an artist, release, track, or label
under one rating criterion. Criteria are configurable per collection; the
built-in `Overall` criterion applies to releases and tracks.

## Scale

- A rating is a whole number from 1 to 5.
- A 5 may additionally be marked as a standout: an exceptional item that
  deserves to be told apart from an ordinary 5. Standout is a flag on the
  rating, not a sixth point, and it only exists on a 5.
- The UI shows a rating as a five-bar level meter rather than a number. A
  standout is drawn in gold with a spark mark.

## Computed Track Averages

A manual rating is an opinion about the whole; the track average shows what
the rated tracks actually add up to. Averages are calculated on read and never
stored.

- An average is computed per criterion from track ratings only.
- Unrated tracks are skipped; the result reports how many tracks were rated
  out of how many are in scope.
- A standout counts as 5.
- Each catalog track counts once per target, even when it appears on several
  releases. Versions and remixes in a track stack are separate tracks.
- Release: the linked tracks of its tracklist. Release-only rows have no
  rating and do not count.
- Label: the unique tracks across all releases of the label.
- Artist: the tracks where the artist holds one of the criterion's counted
  credit roles. The counted roles are a per-criterion setting and default to
  main artist and remixer.
- Artist identity is transitive in one direction: an artist answers for their
  own credits, for their aliases, and for the groups they or their aliases
  belong to. An alias or a group answers only for its own credits, so a
  group's average is not diluted by its members' solo work.
- A track's artists come from its track credits and its release tracklist
  credits; a track with neither falls back to the credits of the releases it
  appears on.

## Related Knowledge

- [Track](track.md)
- [Release](release.md)
- [Artist](artist.md)
- [Label](label.md)
- [Credit](credit.md)
- [SQLite Storage](../architecture/sqlite-storage.md)
