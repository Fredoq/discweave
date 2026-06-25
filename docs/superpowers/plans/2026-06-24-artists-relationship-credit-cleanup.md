# Artists Relationship And Credit Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the Artists workspace so it shows explicit artist relationships and compact release/track credit appearances without legacy aliases, members, tags, or copy ownership sections.

**Architecture:** Keep the existing React feature files and CSS structure. Update the Artists workspace row summary helpers to derive relationship display from explicit relation data, then update the right detail panel to render only structured relationship groups and compact Releases/Tracks credit lists.

**Tech Stack:** React, TypeScript, Vite/Vitest, Testing Library, vanilla CSS, Electron desktop shell.

---

### Task 1: Lock The Desired UI With Tests

**Files:**
- Modify: `app/src/App.workspaces-artists.test.tsx`

- [ ] **Step 1: Replace legacy master-list expectations**

Update the `renders the artists workspace with relation-first artist rows` test so it asserts the new relationship-first contract:

```tsx
expect(h.screen.queryByText('Aliases and members')).not.toBeInTheDocument()
expect(h.screen.queryByText('Relation hint')).not.toBeInTheDocument()
expect(h.screen.queryByText('Copies')).not.toBeInTheDocument()

const aphexRow = h.screen.getByRole('button', { name: /aphex twin/i })
expect(h.within(aphexRow).getByText('No direct relations recorded')).toBeInTheDocument()
expect(h.within(aphexRow).queryByText('Aliases')).not.toBeInTheDocument()
expect(h.within(aphexRow).queryByText('Richard D. James')).not.toBeInTheDocument()
```

- [ ] **Step 2: Replace duplicate membership fixture with explicit `memberOf` expectations**

In `deduplicates repeated memberOf relations in artist rows and details`, keep the repeated `artist.relations` fixture, but assert these strings instead:

```tsx
const row = h.screen.getByRole('button', { name: /alan wilder/i })
expect(h.within(row).getAllByText('Member of Depeche Mode')).toHaveLength(1)
expect(h.within(row).queryByText('Aliases')).not.toBeInTheDocument()
expect(h.within(row).queryByText('Members')).not.toBeInTheDocument()

const detailPanel = h.screen.getByRole('complementary', {
  name: 'Alan Wilder',
})
const relationsSection = h.detailSection(detailPanel, 'Relations and credits')
expect(h.within(relationsSection).getAllByText('Member of')).toHaveLength(1)
expect(h.within(relationsSection).getAllByText('Depeche Mode')).toHaveLength(1)
expect(
  h.within(relationsSection).queryByText('Member of Alan Wilder to Depeche Mode'),
).not.toBeInTheDocument()
```

- [ ] **Step 3: Add an explicit legacy-field removal test**

Add this test:

```tsx
it('does not render legacy artist aliases members tags or copy sections', () => {
  h.seedCatalogForTests({
    artists: [
      {
        ...h.artistRecords[0],
        id: 'legacy-artist',
        name: 'Legacy Artist',
        type: 'Person',
        aliases: ['Legacy Alias'],
        members: ['Legacy Member'],
        tags: ['Legacy Tag'],
        relations: [],
      },
    ],
    releases: [],
    tracks: [],
    ownedItems: [
      {
        ...h.ownedItemRecords[0],
        id: 'legacy-copy',
        artist: 'Legacy Artist',
        title: 'Legacy Copy',
      },
    ],
    relations: [],
    playlists: [],
  })
  window.history.pushState({}, '', '/artists?artist=legacy-artist')

  h.render(<h.App />)

  const row = h.screen.getByRole('button', { name: /legacy artist/i })
  expect(h.within(row).queryByText('Legacy Alias')).not.toBeInTheDocument()
  expect(h.within(row).queryByText('Legacy Member')).not.toBeInTheDocument()
  expect(h.within(row).queryByText('Legacy Tag')).not.toBeInTheDocument()

  const detailPanel = h.screen.getByRole('complementary', {
    name: 'Legacy Artist',
  })
  expect(h.within(detailPanel).queryByText('Collection copies')).not.toBeInTheDocument()
  expect(h.within(detailPanel).queryByText('Aliases, members and tags')).not.toBeInTheDocument()
  expect(h.within(detailPanel).queryByText('Legacy Copy')).not.toBeInTheDocument()
})
```

- [ ] **Step 4: Replace role-heading credit test**

Change `groups artist release and track appearances by contribution role` so it no longer expects role headings. It should assert Releases and Tracks groups with role pills:

```tsx
const creditSection = h.detailSection(detailPanel, 'Credit appearances')

expect(
  h.within(creditSection).getByRole('heading', { name: 'Releases' }),
).toBeInTheDocument()
expect(
  h.within(creditSection).getByRole('heading', { name: 'Tracks' }),
).toBeInTheDocument()
expect(
  h.within(creditSection).queryByRole('heading', { name: 'Main artist' }),
).not.toBeInTheDocument()
expect(h.within(creditSection).getByRole('link', { name: 'Polynomial-C' })).toHaveAttribute(
  'href',
  '/tracks?track=polynomial-c',
)
expect(h.within(creditSection).getByText('Composer')).toBeInTheDocument()
```

- [ ] **Step 5: Run the focused test file and confirm failure**

Run:

```bash
npm --prefix app test -- App.workspaces-artists.test.tsx
```

Expected: tests fail because the implementation still renders legacy aliases, members, copies, role headings, and copy sections.

### Task 2: Clean Up Artist Master List Relationship Summaries

**Files:**
- Modify: `app/src/features/artists/ArtistsWorkspace.tsx`
- Modify: `app/src/styles/common-panels.css`

- [ ] **Step 1: Remove legacy row display**

In `ArtistMasterRow`, remove rendering of `artist.tags`, `Aliases`, `Members`, `Memberships`, `Relations`, and the `Copies` count. Replace the relationship block with one summary line:

```tsx
<span className="artist-master-relationship">
  {summary.relationshipSummary}
</span>
```

Keep only:

```tsx
<ArtistActivityCount label="Releases" value={summary.releases} />
<ArtistActivityCount label="Tracks" value={summary.tracks} />
```

- [ ] **Step 2: Update `buildArtistMasterRowSummary`**

Return this shape:

```ts
return {
  relationshipSummary: artistRelationshipSummary(artist, catalogData),
  releases: releases.length,
  tracks: tracks.length,
}
```

Remove `copies`, `aliases`, `members`, `memberships`, and `otherRelations` from the returned object.

- [ ] **Step 3: Add relation-derived summary helpers**

Add helpers near the existing row summary helpers:

```ts
function artistRelationshipSummary(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
) {
  const memberships = directRelationTargets(artist, 'member of')
  const members = groupMemberNames(artist, catalogData)

  if (isGroupArtist(artist) && members.length > 0) {
    return `Members: ${members.join(', ')}`
  }

  if (!isGroupArtist(artist) && memberships.length > 0) {
    return memberships.map((target) => `Member of ${target}`).join(', ')
  }

  return 'No direct relations recorded'
}

function directRelationTargets(artist: ArtistRecord, type: string) {
  const normalizedType = normalizeText(type)

  return uniqueNonEmpty(
    artist.relations
      .filter((relation) => normalizeText(relation.type) === normalizedType)
      .map((relation) => relation.target),
  )
}

function groupMemberNames(artist: ArtistRecord, catalogData: CatalogLinkData) {
  const groupName = normalizeText(artist.name)

  return uniqueNonEmpty(
    catalogData.artists.flatMap((candidate) =>
      candidate.relations
        .filter(
          (relation) =>
            normalizeText(relation.type) === 'member of' &&
            normalizeText(relation.target) === groupName,
        )
        .map(() => candidate.name),
    ),
  )
}

function isGroupArtist(artist: ArtistRecord) {
  return (
    artist.type === 'Band' ||
    artist.type === 'Project' ||
    artist.type === 'Collective'
  )
}
```

- [ ] **Step 4: Adjust master-list CSS**

Rename or replace unused tag/chip-group styles with:

```css
.artist-master-relationship {
  color: var(--color-soft);
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Keep `.artist-master-row-main`, `.artist-master-row-title`, `.artist-master-activity`, and `.artist-master-count`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm --prefix app test -- App.workspaces-artists.test.tsx
```

Expected: master-list assertions pass; detail-panel and credit appearance assertions may still fail.

- [ ] **Step 6: Commit Task 2**

```bash
git add app/src/features/artists/ArtistsWorkspace.tsx app/src/styles/common-panels.css app/src/App.workspaces-artists.test.tsx
git commit -m "feat: simplify artists master list relationships"
```

### Task 3: Clean Up Artist Detail Relationships And Statistics

**Files:**
- Modify: `app/src/features/artists/ArtistDetail.tsx`
- Modify: `app/src/styles/common-panels.css`

- [ ] **Step 1: Stop passing and rendering copy stats**

Remove `ownedCopyAppearances` from the `ArtistDetail` destructuring. Change the stats call to:

```tsx
<ArtistStats
  releases={releaseAppearances.length}
  tracks={trackAppearances.length}
  roles={creditRoles.length}
/>
```

Change the stats props and component:

```ts
type ArtistStatsProps = {
  releases: number
  roles: number
  tracks: number
}

function ArtistStats({ releases, roles, tracks }: ArtistStatsProps) {
  return (
    <dl className="artist-stat-grid">
      <div>
        <dt>Releases</dt>
        <dd>{releases}</dd>
      </div>
      <div>
        <dt>Tracks</dt>
        <dd>{tracks}</dd>
      </div>
      <div>
        <dt>Roles</dt>
        <dd>{roles}</dd>
      </div>
    </dl>
  )
}
```

- [ ] **Step 2: Remove obsolete detail sections**

Delete the entire `Collection copies` section and the entire `Aliases, members and tags` section from `ArtistDetail`.

- [ ] **Step 3: Build relationships from explicit relations only**

Replace `buildArtistRelationshipGroups` so it derives direct memberships from `artist.relations` and group members from reverse lookup in `catalogData.artists`. Change the call site to pass `catalogData`:

```tsx
const relationshipGroups = useMemo(
  () => buildArtistRelationshipGroups(artist, catalogData),
  [artist, catalogData],
)
```

Use this function shape:

```ts
function buildArtistRelationshipGroups(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
): ArtistRelationshipGroup[] {
  const memberships = shouldShowMemberships(artist)
    ? uniqueRelationshipItems(
        artist.relations
          .filter((relation) => normalizeText(relation.type) === 'member of')
          .map((relation) => ({
            key: `membership-${relation.target}`,
            label: relation.target,
            roles: ['Member of'],
            detail: relation.detail,
          })),
      )
    : []

  const members = isGroupArtist(artist)
    ? uniqueRelationshipItems(
        catalogData.artists.flatMap((candidate) =>
          candidate.relations
            .filter(
              (relation) =>
                normalizeText(relation.type) === 'member of' &&
                normalizeText(relation.target) === normalizeText(artist.name),
            )
            .map((relation) => ({
              key: `member-${candidate.id}-${relation.target}`,
              label: candidate.name,
              roles: ['Member'],
              detail: relation.detail,
            })),
        ),
      )
    : []

  const otherRelations = uniqueRelationshipItems(
    artist.relations
      .filter((relation) => normalizeText(relation.type) !== 'member of')
      .map((relation) => ({
        key: `relation-${relation.type}-${relation.target}`,
        label: relation.target,
        roles: [relation.type],
        detail: relation.detail,
      })),
  )

  return [
    { title: 'Member of', items: memberships },
    { title: 'Members', items: members },
    { title: 'Other relations', items: otherRelations },
  ].filter((group) => group.items.length > 0)
}
```

- [ ] **Step 4: Keep relation links out of duplicated `memberOf` rows**

Do not merge `catalogData.relations` into artist relationship groups for this iteration. This prevents raw relation-title rows like `Member of Alan Wilder to Depeche Mode` from appearing in artist detail.

- [ ] **Step 5: Update stat-grid CSS**

Change:

```css
.artist-stat-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm --prefix app test -- App.workspaces-artists.test.tsx
```

Expected: legacy detail sections and copy stats assertions pass; credit appearance tests may still fail until Task 4.

- [ ] **Step 7: Commit Task 3**

```bash
git add app/src/features/artists/ArtistDetail.tsx app/src/styles/common-panels.css app/src/App.workspaces-artists.test.tsx
git commit -m "feat: clean up artist detail relationships"
```

### Task 4: Compact Release And Track Credit Appearance Lists

**Files:**
- Modify: `app/src/features/artists/ArtistDetail.tsx`
- Modify: `app/src/styles/common-panels.css`

- [ ] **Step 1: Remove role-heading index**

Delete `AppearanceRoleIndex` and remove its call from `Credit appearances`.

- [ ] **Step 2: Render Releases and Tracks as compact grouped lists**

Keep `AppearanceGroup`, but make the group heading an accessible heading:

```tsx
function AppearanceGroup({ emptyText, items, title }: AppearanceGroupProps) {
  return (
    <section className="artist-appearance-group" aria-labelledby={`artist-${title.toLowerCase()}-appearances-title`}>
      <div className="artist-appearance-heading">
        <h4 id={`artist-${title.toLowerCase()}-appearances-title`}>{title}</h4>
        <span>{items.length}</span>
      </div>
      <AppearanceList emptyText={emptyText} items={items} />
    </section>
  )
}
```

- [ ] **Step 3: Keep role pills on each row**

Keep `BadgeList values={item.roles}` in each appearance row header. Do not move roles into a separate role index.

- [ ] **Step 4: Preserve release cover thumbnails without bulky cards**

Keep `ReleaseCoverThumbnail` only for release appearances where `thumbnailTitle` exists. Track rows remain text-only compact rows.

- [ ] **Step 5: Adjust appearance CSS**

Use compact row styling:

```css
.artist-appearance-heading h4 {
  margin: 0;
  color: var(--color-heading);
  font-size: 12px;
}

.artist-appearance-card {
  display: grid;
  gap: 6px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 10px;
}
```

Remove unused `.artist-appearance-role-groups` selectors.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm --prefix app test -- App.workspaces-artists.test.tsx
```

Expected: all Artists workspace tests pass.

- [ ] **Step 7: Commit Task 4**

```bash
git add app/src/features/artists/ArtistDetail.tsx app/src/styles/common-panels.css app/src/App.workspaces-artists.test.tsx
git commit -m "feat: compact artist credit appearances"
```

### Task 5: Final Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Run app tests**

Run:

```bash
npm --prefix app test
```

Expected: app test suite passes.

- [ ] **Step 2: Run app typecheck if available**

Run:

```bash
npm --prefix app run typecheck
```

Expected: TypeScript typecheck passes. If the script does not exist, record the missing script in the final report.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean working tree after task commits, or only intentionally uncommitted generated artifacts.
