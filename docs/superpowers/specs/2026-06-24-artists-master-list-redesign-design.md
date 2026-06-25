# Artists Master List Redesign Design

## Context

The Artists workspace currently uses a generic catalog table with columns for
`Artist`, `Type`, `Aliases and members`, and `Relation hint`. This creates two
problems:

- aliases and members are different concepts, but they are presented in one
  column;
- relation hints expose raw repeated text such as `Member of, Member of` instead
  of useful relationship context.

The selected direction is the second Superdesign variant:

- Project:
  https://app.superdesign.dev/teams/62703528-4d89-458f-b1ee-8f649c2c209e/projects/43d1fdd0-1462-4b62-be72-e2a07eda336a
- Current-state draft:
  https://p.superdesign.dev/draft/e14a8cd3-0cc4-4398-9107-5ea9ad195202
- Selected redesign draft:
  https://p.superdesign.dev/draft/b43f70b5-a057-49eb-b1d9-10bf5368e143

## Goals

- Keep the DiscWeave workspace pattern: main artist index on the left and sticky
  detail panel on the right.
- Replace the artist table with a dense master-list index that better fits graph
  data.
- Separate aliases, members, memberships, and credit activity visually.
- Stop displaying raw `relationHint` in the index.
- Deduplicate repeated relation labels, including repeated `Member of` pills.
- Preserve compact desktop density and the existing DiscWeave design system.

## Non-Goals

- Do not redesign the app shell, route header, navigation, or global panel
  styling.
- Do not change artist persistence or relation APIs.
- Do not introduce new relation types.
- Do not remove the right-side artist detail panel.

## Main Index Layout

The current table becomes an `Artist master list` panel.

Each artist row contains:

- artist name;
- type badge;
- muted metadata line from tags;
- separate compact chip groups for:
  - aliases;
  - members;
  - memberships;
  - relation summary when there are other relation types;
- right-aligned activity counters for releases, tracks, and copies.

Rows remain selectable buttons. The selected row keeps the current DiscWeave
selected treatment: pale green-gray background and a strong left inset accent.

Empty group behavior:

- omit empty chip groups when at least one other group has data;
- show a single muted `No aliases, members or relations recorded` line when all
  relationship groups are empty.

## Relationship Presentation

`relationHint` is not shown in the index. It may remain searchable for backward
compatibility, but it is not a primary UI field.

Structured relations are summarized from `artist.relations` and the catalog
relations dataset:

- `Member of Depeche Mode` for person-to-band membership;
- `5 members` for bands with known members;
- `Alias of ...` for alias relations;
- `Related to ...` for other relations.

Within one artist row or detail section, relation labels are deduplicated by
normalized relation type plus normalized target. This prevents duplicate
`Member of` pills and repeated links to the same target.

## Detail Panel

The right detail panel stays in the same position and retains the same action
buttons.

The first relationship section changes from a flat mixed list to grouped
relationship data:

- `Memberships` for `memberOf` relations;
- `Members` for band/project members;
- `Aliases` for alias names;
- `Other relations` for remaining relation types.

Each group is rendered only when it has content. Repeated items are deduplicated
before rendering. Credit role badges remain separate from relation groups.

## Data Shaping

Add UI-only helper functions near the Artists feature:

- build per-artist row summaries from the existing artist, release, track, owned
  item, and relation arrays;
- deduplicate relationship items before rendering;
- compute activity counts consistently with the detail panel where practical.

The API contract does not change. This is a presentation-layer redesign.

## Accessibility

- The master list uses semantic list markup with row buttons, not a decorative
  card grid.
- Selected artist rows expose pressed state with `aria-pressed`.
- Chip groups have readable text; no meaning depends on color alone.
- Long alias/member/relation values wrap safely without shifting the row height
  unpredictably.

## Testing

Update Artists workspace tests to cover:

- the old `Aliases and members` column is gone;
- `Relation hint` is not rendered in the index;
- aliases, members, and memberships render in separate groups;
- repeated `Member of` relation data is deduplicated in both the list and detail
  panel;
- selecting an artist still updates the right detail panel;
- search can still match legacy relation hint text even though it is no longer
  displayed.
