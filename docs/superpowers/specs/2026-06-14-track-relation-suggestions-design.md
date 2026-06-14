# Track Relation Suggestions Design

## Context

Issue #27 started as a product decision about structured track version
metadata. The current app has three overlapping concepts:

- `Track.title`, which often includes variant text such as `(Radio Edit)`;
- `release_tracks.version_note`, a free-form note shown as a track version;
- `track_relations`, typed links such as `editOf`, `remixOf`, and `versionOf`.

DiscWeave should remain a music archive centered on explicit relationships.
Version-like meaning should therefore live in track relations, not in a
separate track version field.

## Decisions

DiscWeave will not add a `Version` field to `Track`.

`Track.title` remains the full known title for the catalog record, including
suffixes such as `(Radio Edit)` when those suffixes are part of how the track is
known in the collection.

Semantic variant relationships are represented with `TrackRelation` records.
The relation type comes from the collection's configurable `TrackRelationType`
dictionary. The product must not treat the starter relation type set as a fixed
taxonomy, because users can deactivate, replace, or define their own relation
types.

The Tracks table will remove the `Version` column. The selected track detail
view will show:

- a compact relation summary below the title;
- a complete relations section lower in the detail panel.

`release_tracks.version_note` will be removed as a product concept. Existing
compatibility handling is not required because DiscWeave has no external users
for this data yet. Variant text belongs in `Track.title`; semantic meaning
belongs in `TrackRelation`.

Accepted relation suggestions do not modify track titles.

## Import Workflow

The target workflow is relation-first import review:

1. A scan creates draft releases and draft tracks.
2. The user reviews and edits draft track titles, artists, and selected existing
   tracks.
3. The user opens a dedicated `Relation suggestions` review step.
4. DiscWeave shows saved relation candidates detected from imported track titles
   and Discogs metadata. Filename parsing is not a relation suggestion source
   in this design.
5. The user accepts, rejects, or edits each suggestion.
6. Final import confirmation creates releases, tracks, owned items, and then
   accepted track relations.

Relation suggestions are saved as review artifacts inside the import session.
They are not transient hints recalculated on every render.

Suggestion decisions are:

- `pending`;
- `accepted`;
- `rejected`.

There is no separate `edited` state. The UI can show a suggestion as modified
by comparing the original suggested payload with the reviewed payload.

## Suggestion Endpoints

A suggestion endpoint can refer to either:

- an existing track;
- a draft track in the same import session.

During final confirmation, a resolver maps endpoints to final `TrackId` values:

- existing track endpoint -> that existing track;
- draft track endpoint with `selectedTrackId` -> the selected existing track;
- draft track endpoint without `selectedTrackId` -> the newly created track.

If source and target resolve to the same final track, DiscWeave skips creating
the relation and reports a warning in the import result.

If the accepted relation already exists, DiscWeave skips creating a duplicate
and reports a warning in the import result.

## Parser Rules

Relation suggestion parsing is driven by collection-level parser rules, not by
hard-coded relation type enum values.

The first rule model contains:

- `relation_type_code`;
- `alias`;
- `match_mode`, initially `exactLastParentheticalToken`;
- `confidence`, represented as an integer score from 0 to 100;
- `direction`, initially `variantToBase` or `baseToVariant`;
- `sort_order`;
- `is_active`.

Rules are stored separately from dictionary entries in a
`track_relation_parser_rules` table. Each active rule references an active
`TrackRelationType` dictionary entry by code. Rules whose relation type is
inactive are ignored.

The first analyzer examines the last parenthetical block in a track title. This
keeps earlier parenthetical text as part of the base title.

Example:

```text
It's Like That (Drop The Break) (Radio Edit)
```

The analyzer derives:

- base title candidate: `It's Like That (Drop The Break)`;
- variant token: `Radio Edit`;
- suggested direction: read from the matched parser rule;
- source: `It's Like That (Drop The Break) (Radio Edit)`;
- target lookup title: `It's Like That (Drop The Break)`.

If the token matches an active parser rule, the suggestion receives the rule's
relation type and confidence.

If the token does not match a rule but there is a good base-title target match,
DiscWeave creates an unresolved pending candidate without a relation type. The
user must choose a relation type before accepting it.

## Matching

The first target matching strategy supports:

- exact normalized title matching;
- conservative close normalized title matching.

It does not use fuzzy matching.

Artist and release context are tie-breakers, not primary matching keys. If
there is one clear target, the suggestion can preselect it. If multiple targets
remain plausible, the suggestion stays unresolved and shows target options.

Parser rule direction controls endpoint assignment. Starter suffix-style rules
should use `variantToBase`: source is the suffixed track, and target is the base
track. Rules with `baseToVariant` reverse that assignment.

## Data and API Scope

The implementation should remove `versionNote` from:

- release track request and response contracts;
- domain model and persistence mapping;
- import draft and confirmation flows;
- export and restore formats;
- UI form state and display helpers.

The implementation should add:

- collection-level track relation parser rules;
- saved import relation suggestions;
- endpoint references that can point at existing tracks or draft tracks;
- APIs to list and update relation suggestions for an import session;
- final confirmation logic that creates accepted relations after endpoint
  resolution.

Import sessions are review workflow state. Completed import suggestions do not
need to be included in portable collection exports unless DiscWeave later makes
import history part of the portable archive.

Parser rules are collection settings and should be included in export and
restore.

## UI Scope

Tracks workspace:

- remove the `Version` column from the table;
- keep title, artists, releases, duration, and rating columns;
- move relationship meaning into the detail panel.

Track detail:

- show a compact relation summary below the title;
- keep a full relations section for navigation and inspection.

Import workspace:

- add a `Relation suggestions` step after draft cleanup;
- show pending, accepted, and rejected suggestions explicitly;
- allow changing relation type and target before accepting;
- show modified suggestions by comparing suggested and reviewed payloads;
- show warnings for skipped self-relations or duplicate relations after confirm.

## Testing

Test coverage should include:

- parser rule matching against the last parenthetical block;
- unresolved candidates for unknown suffixes with good base-title matches;
- ignoring rules whose relation type is inactive;
- endpoint resolution for existing tracks and draft tracks;
- skipped self-relations after endpoint resolution;
- skipped duplicate relations;
- Tracks table removal of the `Version` column;
- track detail relation summary and full relation block;
- import relation suggestion review lifecycle;
- export and restore without `versionNote`;
- export and restore of parser rules.

## Out of Scope

This design does not introduce a track version field.

This design does not auto-create relations without user confirmation.

This design does not parse filenames for relation suggestions in the first
version.

This design does not implement fuzzy matching or a general pattern language.
