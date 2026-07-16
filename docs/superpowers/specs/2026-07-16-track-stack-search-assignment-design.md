# Track Stack Search Assignment Design

**Status:** Design approved; pending written-spec review
**Date:** 2026-07-16

## Context

The Tracks workspace currently supports relation-derived stack creation through
drag-and-drop. That interaction works when the standalone source Track and the
destination stack are visible at the same time. It breaks down in a long list:
the destination may be above the current scroll position, hidden by filters, or
located on another future result page. Visual scanning also becomes unreliable
as the number of Tracks and stacks grows.

The existing drag-and-drop design intentionally deferred a keyboard-accessible
`Add to stack...` action. This design adds that scalable path without replacing
drag-and-drop and without introducing a stored `TrackStack` entity.

## Goals

- Add one selected standalone Track to one existing stack without scrolling to
  or rendering the destination in the underlying list.
- Make destination discovery useful across a large collection and future list
  pagination.
- Preserve explicit `source -> root` Track relation semantics.
- Require the user to choose the stack relation type deliberately.
- Keep drag-and-drop as the fast path when both Tracks are already visible.
- Reuse one mutation path and one authoritative set of validation rules for
  both entry points.
- Preserve strict active-collection isolation and local-first operation.
- Provide a complete keyboard-accessible path.

## Non-Goals

- Adding an existing stack member to another stack.
- Moving a Track between stacks or removing a Track from a stack.
- Moving or merging whole stacks.
- Bulk assignment.
- Creating a new stack from the searchable dialog.
- Showing standalone Tracks as searchable destinations.
- Editing stack relation-type settings from the dialog.
- Replacing the existing drag-and-drop interaction.
- Introducing a persisted `TrackStack` aggregate.

## Selected Approach

The selected standalone Track exposes an `Add to stack...` action in the sticky
right-hand detail panel. The action opens a two-step modal dialog:

1. Search and select an existing destination stack.
2. Explicitly select the relation type and confirm.

The dialog is independent of the Tracks list's scroll position, active filters,
and visible page. It keeps the source Track and selected destination visible so
the underlying list never needs to show both records simultaneously.

The approved SuperDesign references are:

- [Step 1: choose destination stack](https://p.superdesign.dev/draft/454b95b5-c25e-4462-a2a6-00babb0f4e2a)
- [Step 2: choose relation type](https://p.superdesign.dev/draft/2b25584c-b87b-43d6-8403-cb256a440698)
- [DiscWeave Tracks assignment canvas](https://superdesign.dev/teams/62703528-4d89-458f-b1ee-8f649c2c209e/projects/2a69add8-7498-41db-8290-5e968832e5ab)

These drafts define interaction hierarchy and information density. Production
code must use the repository's existing CSS tokens, components, and semantic
HTML rather than copying generated utility classes.

## Eligibility and Entry Point

Show `Add to stack...` only when the selected Track satisfies the same source
eligibility rule as the current drag interaction:

- the Track is represented by its own top-level stack row;
- that row has no stack members; and
- the Track is not already a member of another stack.

The eligibility decision must come from a shared stack-model helper. The detail
panel must not reimplement these rules independently.

Place the action in the selected Track's sticky detail panel with the other
record actions. Use a native button and the existing primary contextual-action
treatment. Omit the action when the Track is ineligible; do not leave a disabled
placeholder that suggests the operation may become available on the same
selection.

## Step 1: Search and Select a Stack

Opening the dialog must:

- set the dialog title to `Choose destination stack`;
- identify the state as `Step 1 of 2`;
- pin the source title and artist display above the search results;
- focus the search field; and
- show initial guidance to enter at least two characters.

The dialog searches existing stacks only. For this feature, an existing stack
is a Track marked as original with at least one transitive, deduplicated member
in the configured stack-relation projection. A standalone Track, including a
standalone Track marked as original, is not returned. Creating a stack from two
standalone Tracks remains a drag-and-drop capability.

The client waits 250 milliseconds after the latest input change and does not
request results for a trimmed query shorter than two characters. It must cancel
the previous request where possible and, independently, ignore any response
that does not belong to the latest query generation.

When the normalized query changes, clear the loaded pages, selected destination,
and any relation-type selection left from a later step before loading the new
first page. Changes that normalize to the same query may retain current state.
`Continue` can use only a destination selected from the current normalized
query's results.

Each result represents one destination root and shows:

- root Track title;
- root artist display;
- version year when present;
- member count; and
- `Matched member: <member title>` only when the query matched member context
  rather than the root.

Root matches do not need a generic match-reason label. If multiple members
match, return the member with the normalized title that sorts first, then the
stable Track identifier as a tie-breaker. Keep the result as a single stack
row.

Selecting a row enables `Continue`. `Continue` advances within the same dialog;
it does not mutate the catalog.

## Step 2: Choose the Relation Type

The second step must:

- set the title to `Choose relation type`;
- identify the state as `Step 2 of 2`;
- show the source title and artist;
- show the destination title, artist, version year, and member count; and
- make the `source -> destination stack` direction visually explicit.

Render the currently enabled stack relation types from Track stack settings.
Product-owned relation types use the established labels:

- `remixOf` -> `Remix`;
- `versionOf` -> `Version`.

Custom enabled stack relation types may use their dictionary display names.
No relation type is selected by default. `Add to stack` remains disabled until
the user makes an explicit selection.

If the collection has no enabled stack relation types, omit the detail-panel
entry action. A dialog already open when settings change shows a blocking
`No stack relation types are enabled` state and cannot submit.

`Back` returns to Step 1 while preserving the search query, loaded results, and
selected destination. `Cancel`, the close button, and Escape close the dialog
without mutation.

## Submission and Success Behavior

Confirmation creates one directed Track relation:

```text
sourceTrackId = selected standalone Track
targetTrackId = selected destination root
type = explicitly selected stack relation type
markTargetAsOriginal = false
```

The target is already an existing stack, so this flow never promotes a
standalone target to an original Track.

While the request is pending:

- disable Back, Cancel, close, relation selection, and confirmation;
- show a compact pending state on `Add to stack`; and
- prevent duplicate submissions.

After success:

- close the dialog;
- refresh stack and Track relation data;
- keep the source Track selected;
- remove the now-ineligible `Add to stack...` action after refresh;
- leave the destination's expansion state unchanged; and
- announce `Added <source> to <destination> as <relation type>.` through a new
  workspace action-status live region.

Do not change the active Tracks query, filters, page, or scroll position. Do not
navigate or force-scroll to a destination that is not currently rendered.

## Domain Semantics

Stacks remain a read projection over Track metadata and directed Track
relations. The feature creates no new domain entity or ownership boundary.

The relation direction remains member to root. The active collection owns the
source Track, destination Track, relation record, stack settings, and returned
search projection. Cross-collection discovery or mutation is forbidden.

The configured product stack relation types remain the only product-owned
meanings. This feature does not infer whether a Track is a Remix or Version from
its title; the user supplies that meaning explicitly.

## Stack Target Search API

Add a collection-scoped, paginated endpoint:

```http
GET /api/tracks/stack-targets?sourceTrackId=<id>&search=<text>&offset=<n>&limit=<n>
```

`sourceTrackId` is required so the server can exclude the source and apply
authoritative source validation. `search` is trimmed and must contain between 2
and 200 characters. `offset` defaults to `0` and must be non-negative. `limit`
defaults to `20`; positive values above `50` are clamped to `50`, while zero or
negative values are rejected.

The response shape is:

```json
{
  "items": [
    {
      "rootTrackId": "track-id",
      "title": "Phat Bass",
      "artistDisplay": "Warp Brothers, Aquagen",
      "versionYear": 1994,
      "memberCount": 2,
      "matchedMember": {
        "trackId": "member-id",
        "title": "Phatt Bass (Aquagen More Bass Mix)",
        "artistDisplay": "Warp Brothers, Aquagen"
      }
    }
  ],
  "offset": 0,
  "limit": 20,
  "total": 1
}
```

`versionYear` is a nullable integer. `memberCount` uses the same transitive,
deduplicated count as the existing stack projection. `matchedMember` is nullable
and appears only when member context explains the match.

Search normalized, case-insensitive text across:

- root title;
- root artist display;
- member titles; and
- member artist displays.

Do not add fuzzy typo correction in this version. Results use deterministic
relevance ordering: root title matches first, then root artist matches, then
member-context matches. Ties sort by normalized root title and then stable root
identifier. The same ordering must apply across pages.

The endpoint returns only original roots with at least one member and never
duplicates a root because more than one member matched. It must not load the
complete stack catalog into the client before filtering.

An unknown or cross-collection `sourceTrackId` returns the same generic `404`
response so the endpoint does not disclose foreign records. A known source that
is no longer an eligible standalone Track returns a typed `409` conflict. Invalid
search length, negative offset, or non-positive limit returns typed `400`
validation. An offset beyond `total` returns an empty page with the same total.

## Mutation Contract and Validation

Reuse `POST /api/track-relations/stack` for the write. Drag-and-drop and the new
dialog normalize their UI state into one shared, identifier-based persistence
command:

```text
sourceTrackId
targetRootTrackId
relationTypeCode
markTargetAsOriginal
```

The dialog always supplies `markTargetAsOriginal = false`. Drag-and-drop keeps
its existing ability to promote a standalone destination when required. The
search endpoint, rather than this boolean alone, is what restricts picker choices
to roots that already have members. The shared write must continue to accept a
zero-member target that is already marked original, because it is a valid
standalone drag-and-drop target.

Before the atomic write, the server must authoritatively validate:

- authenticated access to the active collection;
- source and target existence in that collection;
- source and target are different;
- the relation type is currently enabled for Track stacks;
- unless the exact relation already exists, the source is not a stack member
  and has no members of its own;
- when `markTargetAsOriginal` is `false`, the target is already marked original;
- when `markTargetAsOriginal` is `true`, the target has no stack members and is
  promoted to original in the same transaction;
- the relation will not create a stack cycle; and
- the exact `(source, target, relation type)` identity is not a conflicting
  database duplicate.

Check for an identical relation before applying standalone-source guards so a
retry can remain idempotent after the first request has made the source a member.
An identical existing relation is a normal idempotent success. Another stack
relation originating from the source is reported as `source not standalone`,
not as a duplicate. A database collision for the exact identity or a cycle is a
typed validation failure.

The current endpoint already wraps relation creation and target promotion in a
transaction. Preserve that atomicity: failed validation or persistence must not
leave either Track metadata or relation state partially changed.

## Frontend Component Boundaries

### `TracksWorkspace`

The workspace owns orchestration rather than dialog presentation:

- selected source Track;
- open/closed picker state;
- the shared stack-relation mutation command;
- refresh and selection behavior after success; and
- a new workspace action-status live region.

It supplies the same persistence and refresh primitive to drag-and-drop and the
picker. Entry-point-specific success effects remain separate: drag-and-drop
retains its current destination expansion and highlight behavior, while the
picker preserves the list's expansion and scroll state.

### Track detail components

The detail layer receives presentation-level eligibility and an
`onAddToStack` callback. It renders the action but does not derive the relation
graph, search targets, or call APIs directly.

### `TrackStackPickerDialog`

Create a focused dialog component responsible for:

- Step 1 and Step 2 state;
- query debounce and request sequencing;
- paginated result presentation;
- destination and relation-type selection;
- loading, empty, invalid, and submission states; and
- keyboard and focus behavior.

Keep API transport in a small catalog client. The component consumes typed
search and mutation interfaces so its state transitions can be tested without
the full workspace.

### Shared stack model

Keep source eligibility, relation-type labels, and command construction in
small shared helpers. Do not import dialog-local state into
`TrackStacksPanel`, and do not copy the current drag guards into detail-panel
code.

## Data Flow

```text
Select eligible Track
  -> activate Add to stack...
  -> search stack-target projection on the active collection
  -> select one root
  -> explicitly select relation type
  -> submit shared stack-relation command
  -> validate and atomically persist relation
  -> refresh stack/Track projections
  -> retain source selection and announce success
```

The underlying Tracks list is not part of destination resolution. Its current
scroll position, filters, and page are therefore irrelevant to the operation.

## Loading, Empty, and Error States

Step 1 needs distinct states for:

- query shorter than two characters;
- loading the first page;
- no matching existing stacks;
- loaded results;
- loading another page; and
- search failure with `Retry`.

Step 2 and submission need distinct messages for:

- destination no longer exists or is inaccessible;
- destination is no longer an original root;
- relation type is no longer enabled;
- cycle validation failure;
- conflicting relation;
- network or storage failure.

Search or mutation errors must not close the dialog. Preserve the query,
selected destination, and selected relation type whenever those values remain
valid. Retry only the failed operation. If the destination becomes invalid,
return the user to Step 1 with the query preserved and explain why reselection
is required.

Treat an identical existing relation as success rather than an error, refresh
the catalog, and use the normal success announcement. Never create a second
relation record.

## Accessibility

- Use a semantic modal dialog with an accessible title and trapped focus.
- Focus the search input on open and return focus to `Add to stack...` on close.
- Use a semantic single-selection listbox or equivalent radio-group behavior
  for destination results.
- Use native radios or equivalent radio semantics for relation types.
- Support Arrow keys for movement and Enter or Space for selection.
- Keep Back, Cancel, close, and Escape behavior consistent.
- Mark pending and error messages with appropriate polite live-region behavior.
- Do not encode selected, loading, or error states by color alone.
- Keep visible focus treatment from the existing DiscWeave design system.

## Test Strategy

### Frontend model and component tests

1. The action appears for an eligible standalone Track.
2. The action is omitted for a stack member and for a root with members.
3. The action is omitted when no stack relation type is enabled.
4. Opening the dialog focuses search and shows the pinned source summary.
5. Queries shorter than two trimmed characters do not call the API.
6. Search is debounced and a stale response cannot replace newer results.
7. Changing the normalized query clears prior pages and destination selection.
8. A destination outside the currently visible Tracks list can be selected.
9. Member-context matches render one root and the matched-member explanation.
10. Loading another page preserves previous results and current selection.
11. Continue is disabled until a destination is selected.
12. Step 2 starts without a selected relation type.
13. Add is disabled until a relation type is selected.
14. Back preserves the query, results, and destination selection.
15. Confirmation sends the selected source, root, relation type, and
    `markTargetAsOriginal = false`.
16. Pending state prevents duplicate submission.
17. Search and mutation failures keep the dialog open and preserve valid state.
18. Cancel, close, and Escape perform no mutation and restore focus.
19. Successful assignment retains source selection, announces success, and does
    not change list query, filters, page, expansion, or scroll position.
20. Drag-and-drop continues to use the shared persistence path, expands and
    highlights its destination, and preserves standalone-target behavior.

### API and persistence tests

1. Search is isolated to the active collection.
2. Unknown and cross-collection source identifiers return the same response
   without data disclosure.
3. Root-title, root-artist, member-title, and member-artist queries match.
4. Multiple matching members produce one root result.
5. Standalone Tracks and zero-member roots are excluded.
6. The representative matching member is deterministic.
7. Relevance ordering and pagination are stable, including an offset beyond
   the final page.
8. Search length, offset, and limit boundaries follow the documented contract.
9. A known ineligible source returns the typed source-state conflict.
10. Unknown target, self-target, and disabled relation type are rejected on
    mutation.
11. A source that is a member or has members is rejected unless the exact
    requested relation already exists.
12. A non-original target with `markTargetAsOriginal = false` is rejected.
13. A zero-member target already marked original remains valid for
    drag-and-drop with `markTargetAsOriginal = false`.
14. A promoted target must be standalone, and promotion is atomic with relation
    creation.
15. Cycle creation is rejected authoritatively.
16. An identical relation request is idempotent, while an exact-identity
    database collision is a typed conflict.
17. Failed validation leaves both Track metadata and relations unchanged.

## Acceptance Criteria

- A user can select an eligible standalone Track and start assignment from the
  sticky detail panel.
- The user can find an existing stack that is not visible in the current list,
  is filtered out, or would live on another result page.
- Search results identify same-title stacks with artist, year, member count,
  and member-match context when needed.
- The user must explicitly choose a configured relation type.
- Confirmation creates the directed relation to the stack root without
  promoting another Track.
- Success does not disturb Tracks list query, filters, page, or scroll.
- Failure does not discard valid dialog state.
- The complete workflow is operable by keyboard.
- Drag-and-drop remains available and follows the same authoritative mutation
  validation.
- No `TrackStack` persistence model or unrelated stack-management capability is
  introduced.
