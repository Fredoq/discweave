# Track Stack Drag-and-Drop Design

## Goal

Make stack relation creation feel like a direct track organization action in
the Tracks workspace. A user should be able to drag one standalone track row
onto another track or an existing stack and choose the stack relation type that
connects it to the stack root.

## Scope

This design covers the first version of drag-and-drop stack creation only.

- Dragging is available only for standalone track rows.
- Dropping creates one Track relation from the dragged track to a stack root.
- Dropping onto a standalone track automatically marks that target as an
  original track.
- Dropping onto an expanded stack targets that stack's root/original track.
- Moving whole stacks, moving tracks out of stacks, and moving tracks between
  stacks are out of scope.

## Interaction Model

Each draggable standalone track row exposes a clear drag affordance through the
row interaction state. During drag, valid drop targets highlight:

- standalone track rows that are not the source track;
- expanded stack rows and their visible member area.

When a user drops a track on a valid target, the UI opens a compact chooser
near the drop target. The chooser is titled `Add to stack as` and lists the
currently configured stack relation types. Product-owned relation types should
be labeled as `Remix` and `Version`; custom stack relation types use their
dictionary display name.

After the user chooses a relation type, the app creates:

```text
sourceTrackId = dragged track
targetTrackId = target stack root/original track
type = chosen stack relation type
```

The affected stack is expanded and the newly added member is highlighted
briefly. The dragged track should no longer appear as a standalone top-level row
after the next catalog refresh.

## Target Resolution Rules

Drop target resolution must be deterministic:

- If the drop target is a standalone track, that track becomes the target root.
- If the drop target is an expanded stack header or member area, the stack root
  becomes the target root.
- If the drop target is a visible member inside an expanded stack, the member
  is treated as part of the stack drop zone; the relation still targets the
  stack root.

When a standalone target is used, the API call sequence should first ensure the
target track has `isOriginal = true`, then create the relation. If relation
creation fails, the UI should surface the relation error; it does not need to
roll back the original flag in this first version.

## Guards

The UI should prevent or reject these actions before opening the chooser:

- dropping a track onto itself;
- dragging a track that is already a stack member;
- dragging a track that already has stack members;
- dropping onto a non-track area;
- creating a duplicate relation identity;
- creating a cycle.

Backend validation remains authoritative. If the backend rejects the relation,
show a concise inline error and leave the list unchanged after refresh.

## Components

The first implementation can stay inside the Tracks workspace with small helper
functions. Add extraction only where it keeps the file readable:

- drag state for source track id and current target;
- drop target resolver for standalone rows and stack rows;
- relation type chooser component;
- stack action helper that updates the target original flag and calls the
  existing relation creation client.

The existing Track relation endpoint and relation client should be reused.

## Accessibility and Fallback

Drag-and-drop should not be the only path forever, but the first version can
ship with pointer interaction only if the existing Relations workspace remains
available for keyboard users. A later pass can add a row menu action named
`Add to stack...` that uses the same chooser and validation path.

## Tests

Add focused frontend tests for:

- chooser opens when a standalone track is dropped on another standalone track;
- choosing `Version` creates a `versionOf` relation with dragged track as
  source and target/root as target;
- dropping on an expanded stack targets the stack root, not the visible member;
- stack members and stack roots with members are not draggable;
- duplicate/self drops do not open the chooser.

Add backend tests only if an API gap appears. Existing relation validation
should already cover duplicate, self-relation, and invalid reference cases.

## Out of Scope

- Reparenting existing stack members.
- Moving an entire stack into another stack.
- Bulk relation creation.
- Custom stack rule authoring beyond the existing stack relation type settings.
- Rollback of the automatic original flag if relation creation fails.
