# Artists Relationship And Credit Cleanup Design

## Context

The Artists workspace has started moving from a table-like catalog view toward a
relationship-first archive view. The current implementation still exposes several
legacy and duplicated concepts:

- `Copies` appears in the artist master list and in the right detail panel, but
  copy ownership is not useful enough in Artists to justify the space.
- `Collection copies` repeats owned-item data that belongs in release, track, or
  owned item workflows.
- `Memberships` can render duplicate rows, including a raw relation-title style
  row such as `Member of Alan Wilder to Depeche Mode`.
- The lower `Aliases, members and tags` block mixes unrelated concepts and
  duplicates group members already shown above.
- `aliases`, `members`, and `tags` are legacy artist fields without a clear edit
  model in the current product.
- `Credit appearances` is too bulky for long lists and is organized around role
  headings rather than the releases and tracks the collector is trying to inspect.

The selected direction combines the Superdesign `Relationship-First Artist
Workspace` draft with the more compact credit rows from the `DiscWeave Artists
Profile View` draft:

- Current-state baseline:
  https://p.superdesign.dev/draft/a045d6b2-babd-40a5-94c4-96e5e7b64c9e
- Relationship-first draft:
  https://p.superdesign.dev/draft/9f171efb-944b-4b8f-abf2-fb5f05082093
- Compact profile draft:
  https://p.superdesign.dev/draft/88ae7667-e5c5-4f76-be3a-eb530deb1273

## Product Model

DiscWeave will use explicit relations as the source of truth for artist graph
meaning.

- `memberOf` is the fixed relation type for artist membership. It is stored from
  the member artist to the group artist.
- Group members are derived from reverse `memberOf` lookup.
- `aliasOf` is the fixed relation type for artist aliases. It is stored from
  the alias artist to the real-name artist and appears as identity metadata in
  Artists.
- Discogs name variations and ANV-style spellings are not separate Artist
  records. They should be handled later as credited-as/import provenance data,
  not as artist identities.
- Legacy artist `aliases`, `members`, and `tags` fields are removed from the
  Artists UI. No backward-compatible display fallback is required.

## Goals

- Keep the existing DiscWeave app shell and two-column Artists workspace.
- Make the master list read as an artist relationship index, not a generic table.
- Remove copy ownership information from Artists.
- Remove legacy aliases/members/tags display from Artists.
- Show memberships and group members once, without duplicates.
- Redesign credit appearances around Releases and Tracks lists with role pills.
- Keep the UI dense, calm, and suitable for long cataloging sessions.

## Non-Goals

- Do not redesign the global navigation, workspace header, or route structure.
- Do not add a tag editor.
- Do not add a dedicated alias editor beyond the existing relation flows.
- Do not change owned-item workflows outside Artists.
- Do not introduce Discogs or MusicBrainz identifiers as required core entity
  fields.

## Master List

The left panel remains `Artist master list`.

Each row shows:

- artist name;
- type badge;
- one relationship summary line;
- right-aligned `Releases` and `Tracks` counts.

The row no longer shows:

- `Copies`;
- legacy `tags`;
- legacy `aliases`;
- legacy `members`;
- raw relation hints.

Relationship summary rules:

- For group-like artists, show `Members` with member names derived from reverse
  `memberOf` relations.
- For person-like artists, show `Member of` with target group names derived from
  direct `memberOf` relations.
- For aliases, show `Real name` when the artist has an outgoing `aliasOf`
  relation and `Aliases` when other artists point to it.
- If no explicit relation applies, show a quiet empty state such as
  `No direct relations recorded`.

Selected row styling continues to use the existing pale selected background and
left inset accent.

## Right Detail Panel

The right detail panel stays present for consistency with other catalog
workspaces.

The header keeps:

- entity type;
- artist name;
- `Edit record`;
- `Update via Discogs`;
- `Delete record`.

The statistics section shows only:

- `Releases`;
- `Tracks`;
- `Roles`.

It no longer shows `Copies`.

The relationship section renders explicit groups:

- `Members` for group-like artists with reverse `memberOf` relations;
- `Member of` for member artists with direct `memberOf` relations;
- `Aliases` only when explicit `aliasOf` relations exist;
- `Other relations` for remaining relation types.

Do not render a second raw relation row for the same `memberOf` edge. The detail
panel should never show both `Member of Depeche Mode` and a separate raw
relation-title row for the same relationship.

The panel removes:

- `Collection copies`;
- lower `Aliases, members and tags`;
- legacy member/tag chips outside the structured relationship groups.

## Credit Appearances

`Credit appearances` changes from role-first cards into two compact lists:

- `Releases`;
- `Tracks`.

Each release row contains:

- release title link;
- role pills for this artist on that release;
- compact metadata such as year, labels, format, and genre when available;
- optional cover thumbnail only when it does not make the list bulky.

Each track row contains:

- track title link;
- role pills for this artist on that track;
- compact metadata such as track position, release title, and duration.

Long-list behavior:

- the right panel remains scrollable;
- each list may use a constrained internal max height if needed;
- rows stay compact and stable, with no large repeated cards;
- empty states are rendered per list, not per role.

Roles remain visible on every row because the same artist can appear differently
across releases and tracks.

## Data Shaping

Artist relationship UI should be built from explicit relation data.

Deduplication key:

- relation type;
- normalized source artist id or name;
- normalized target artist id or name.

The UI should derive:

- direct memberships from relations where selected artist is the source and type
  is `memberOf`;
- group members from relations where selected artist is the target and type is
  `memberOf`;
- release appearances from release artist credits;
- track appearances from track artist credits.

Owned-item copy counts may still exist in data helpers for other views, but they
are not rendered in Artists.

## Accessibility

- Master list rows remain keyboard-selectable buttons in semantic list markup.
- Selected rows expose pressed state with `aria-pressed`.
- Count labels use readable text, not color-only meaning.
- Role pills and relationship labels are plain readable text.
- Long names and metadata wrap or truncate predictably without overlapping
  adjacent counts.

## Testing

Update Artists workspace tests to cover:

- `Copies` is absent from the artist master list.
- `Copies` is absent from the right detail statistics.
- `Collection copies` is absent from Artists detail.
- Lower `Aliases, members and tags` is absent.
- Legacy artist `aliases`, `members`, and `tags` do not render in the Artists UI.
- Group rows show members derived from `memberOf`, not legacy `members`.
- Member rows show `Member of` derived from `memberOf`.
- Duplicate `memberOf` data renders once in the master list and once in the
  matching detail relationship group.
- Credit appearances render as Releases and Tracks lists with role pills.
- Selecting an artist still updates the right detail panel.
