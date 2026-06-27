# Track Metadata, Stacks, And Release-Only Rows Design

## Context

This specification defines the selected design direction for richer Track
metadata, relation-derived Track stacks, release-only tracklist rows, and import
controls for deciding whether release tracklist rows should create catalog
Tracks.

This work follows the product discussion on June 27, 2026 and the SuperDesign
exploration in project `DiscWeave Track Stacks Redesign`.

Reference drafts:

- current Tracks workspace:
  <https://p.superdesign.dev/draft/d767e475-9a27-4aa9-b262-4d21f394cc3c>;
- option A, dense workbench:
  <https://p.superdesign.dev/draft/e54b11fb-8647-4328-9a5c-02c12e3f2d36>;
- option B, relation stack explorer:
  <https://p.superdesign.dev/draft/91cd164a-75f3-4dea-be1d-85b9c67e20fa>;
- selected option C, stacked workspace:
  <https://p.superdesign.dev/draft/9c0c5586-3e00-4e88-816d-dd774133a8fb>.

The current system treats release tracklist rows and catalog Tracks too closely:
release import confirmation creates or links a Track for every included draft
track, while the Tracks workspace shows a generic table. This makes DJ mixes,
sets, and non-catalog tracklist rows awkward because not every row in a release
tracklist deserves a standalone Track record.

The current system also has no Track-level year. Release year is stored on
Release metadata, but a concrete track version can have its own year and can
appear on multiple releases with different release years.

## Product Decisions

`Track` remains a concrete track version or recording, not an abstract musical
work entity.

Track metadata starts with a typed `versionYear` field. The year belongs to the
specific Track version or recording. Release year stays on Release metadata.

Arbitrary custom Track metadata is not part of the first implementation. The
model should leave room for future custom metadata fields, but the first scope
should ship typed metadata only.

The original Track in a stack is chosen explicitly by the user. DiscWeave should
not infer the original automatically in the first version.

Track stacks are relation-derived read models. There is no first-version
`TrackStack` entity. A stack starts from an original Track and traverses Track
relations transitively through configured relation type codes. If a relation
path leads to the original, the source Track belongs to that stack.

The collection has one default Track stack relation type setting for the first
version. This is a rule set, not a flag on `TrackRelationType`, so future named
stack profiles or custom stack rules can be added without changing the meaning
of relation types.

Release tracklist rows can be release-only. A release-only row stores tracklist
metadata inside the Release context but does not create or link a catalog Track.
Release-only rows do not appear in the Tracks workspace, do not have Track
ratings, Track relations, Track credits, or Track detail pages.

## Domain Model

### Track

Add typed metadata to Track:

- `versionYear`: optional positive four-digit year for the concrete Track
  version or recording.
- `isOriginal`: explicit user-controlled marker that identifies this Track as
  an original or anchor for relation-derived stack traversal.

The first implementation should keep duration, genres, tags, external sources,
credits, ratings, relations, release appearances, and digital file projections
attached to concrete Tracks.

Do not introduce `TrackVersion` in this scope. That would force a larger rewrite
of credits, ratings, relations, release appearances, file links, imports, and
exports.

### Original Selection

The user can mark a Track as an original or anchor Track for stack purposes.
The first implementation stores this as Track metadata, for example
`isOriginal`.

This marker is collection-scoped because Track records are collection-scoped.
It is not a `TrackStack` entity and it is not inferred from title text or
release order.

If a Track has no reachable original, the UI shows a review state such as
`Needs original` instead of guessing.

### Stack Traversal

The default stack read model:

1. Starts from an original Track.
2. Traverses Track relations transitively.
3. Includes Tracks whose relation path reaches that original.
4. Uses only relation type codes from the default Track stack relation type
   setting.
5. Detects cycles and reports them as stack issues.
6. Filters every query by collection.

The read model should expose whether each member is directly or indirectly
connected to the original.

### Stack Relation Type Setting

Add one collection-level setting:

- `Default track stack relation types`

The starter values should include current version-like relation types, for
example `versionOf`, `remixOf`, and `editOf` when those dictionary entries are
active.

This is intentionally not stored as a boolean on relation type dictionary
entries. Future custom stack behavior should be modeled as named rule sets or
profiles rather than as hard-coded flags on relation types.

### Release Tracklist Rows

Release tracklist rows use a nullable Track link:

- linked row: points at an existing or newly created Track;
- release-only row: stores row metadata without a Track.

Release-only row metadata should include the fields needed to render a useful
release tracklist:

- title;
- position;
- disc;
- side;
- duration when available;
- artist attribution or credits where available;
- optional row notes if the existing release tracklist model already supports
  them or needs them for import review.

Cross-collection constraints remain mandatory for linked rows. Release-only
rows must not bypass release collection ownership.

## Release Entry UX

Manual release entry gets a release-level control:

`Create catalog tracks from this tracklist`

When enabled, new rows default to `Create new Track`, matching current behavior.
When disabled, new rows default to `Release-only row`.

Each row has a mode:

- `Create new Track`;
- `Link existing Track`;
- `Release-only row`.

Disabling the release-level control means "do not create new Tracks by default."
It does not mean "prevent linking existing Tracks." Users can still choose
`Link existing Track` for individual rows.

Rows should show their mode visibly in the tracklist editor. Existing Track
matching is available for linked rows and hidden or disabled for release-only
rows.

## Import Review UX

Import draft review uses the same model:

- release-level `Create catalog tracks from this tracklist`;
- row-level `Create new Track`, `Link existing Track`, or `Release-only row`.

If the release-level control is disabled, draft rows default to release-only.
The user can still link selected rows to existing Tracks.

Relation suggestions are only relevant for rows that will produce or link a
Track. Release-only rows should not receive actionable Track relation
suggestions. If an existing suggestion becomes not applicable after a row mode
change, the UI should show it as not applicable or remove it from the active
review list.

Confirmation creates catalog Tracks only for rows in `Create new Track` mode.
It links rows in `Link existing Track` mode to the selected Track. It preserves
release-only rows inside the Release tracklist without creating Track records.

The first implementation should not pretend that release-only local files are
Track-owned data. Digital file linking behavior for release-only rows should be
handled deliberately as release-context data or deferred to a later issue.

## Tracks Workspace

The selected UI direction is SuperDesign option C, `Stacked Workspace`.

The implementation should keep the DiscWeave app shell, route header, compact
desktop density, restrained color system, and right-side detail panel pattern.
It should replace the Tracks table with an expandable relation-derived stack
list.

The main list shows original Tracks as stack rows:

- title;
- artist display;
- `versionYear`;
- stack member count;
- release appearance count;
- relation health badges;
- file or rating badges;
- expand/collapse control.

Expanded rows show member Tracks:

- title;
- relation type;
- direct or indirect relation indicator;
- `versionYear`;
- release context;
- duration;
- file badge when available.

Selecting the original row opens stack overview mode in the detail panel.
Selecting a member row opens Track detail mode for that concrete Track.

### Detail Panel

Stack overview mode shows:

- original Track metadata;
- stack member summary;
- relation paths and cycle issues;
- release appearances across members;
- digital files across linked Tracks;
- credits where useful.

Track detail mode shows:

- concrete Track metadata;
- relation path to the original;
- release appearances;
- Track credits;
- digital files in collection;
- playlist backlinks.

The UI may use the word `stack`, but it must not imply a persisted `TrackStack`
entity in the first implementation.

### Filters

The first stacked workspace should support practical filters:

- search across original and member titles, artists, release context, relation
  type, and file facts;
- relation type;
- has files;
- stack state, including `Originals`, `Needs original`, and `Cycle issue`.

Release-only rows are not shown in the Tracks workspace. They remain visible in
Release detail tracklists.

## Search, Export, Restore, And Review Workbench

Track search should include `versionYear` and stack member facts where practical
without making release-only rows appear as Tracks.

Release detail and export should preserve release-only rows. Exports must remain
human-readable and should distinguish linked tracklist rows from release-only
rows.

Restore must recreate release-only rows and Track metadata. It must also restore
the default Track stack relation type setting.

Review Workbench should eventually surface:

- Tracks with no original;
- stack cycles;
- relation types used in stacks that no longer exist or are inactive;
- release-only rows with local file context that cannot be linked to Track file
  projections.

Review Workbench integration can be a follow-up unless required by the first
implementation plan.

## Roadmap Decomposition

Create four roadmap issues in this order:

1. `Track metadata and relation-derived stack model`
   - add `versionYear`;
   - add explicit original/anchor selection;
   - add default stack relation type setting;
   - add cycle-safe, collection-scoped stack read model;
   - update OKF and tests.

2. `Release-only tracklist rows`
   - allow release tracklist rows without a Track;
   - preserve row metadata;
   - update manual release entry contracts;
   - update export, restore, search, and tests.

3. `Import review controls for track creation`
   - add release-level create-tracks default;
   - add row-level create/link/release-only modes;
   - update confirmation;
   - skip relation suggestions for release-only rows;
   - add import, idempotency, and collection isolation tests.

4. `Tracks stacked workspace redesign`
   - replace the Tracks table with the selected stacked workspace;
   - add stack and member detail modes;
   - add stack filters and relation health badges;
   - add frontend tests.

## Testing Direction

Backend tests should cover:

- `versionYear` validation and mapping;
- explicit original selection;
- stack traversal over allowed relation type codes;
- direct and indirect stack membership;
- cycle detection;
- collection isolation for stacks;
- release-only row creation and editing;
- linked row collection constraints;
- export and restore for Track metadata, stack settings, and release-only rows;
- import confirmation behavior for create/link/release-only row modes.

Frontend tests should cover:

- manual release row modes;
- import draft release-level and row-level controls;
- relation suggestions disappearing or becoming not applicable for release-only
  rows;
- Tracks workspace expandable stacks;
- selecting original versus member rows;
- `Needs original` and `Cycle issue` states;
- search and filters over stack data.

## Risks

`ReleaseTrack.TrackId` is currently central to release appearances, digital file
links, review signals, imports, exports, and Track response projections. Making
rows release-only requires careful contract and query updates.

Stack traversal can become confusing if relation direction is not consistent.
The first implementation should document how configured relation types point
toward the original and should test that direction.

If multiple originals are reachable, the read model should report an issue
rather than silently picking one.

## Non-Goals

The first implementation does not include:

- arbitrary custom Track metadata fields;
- multiple named stack profiles;
- general user-defined stack rule language;
- DJ mix cue sheet or segment modeling;
- automatic original detection;
- automatic relation creation outside the existing reviewed suggestion flow;
- a persistent `TrackStack` aggregate;
- a `TrackVersion` sub-entity.
