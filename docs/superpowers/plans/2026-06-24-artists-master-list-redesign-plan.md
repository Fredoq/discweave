# Artists Master List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Artists table with the selected dense master-list redesign and deduplicate repeated relationship labels.

**Architecture:** Keep all changes in the React presentation layer. `ArtistsWorkspace.tsx` will build row summaries from existing props and render a semantic selectable list; `ArtistDetail.tsx` will group and deduplicate relationship data before rendering. CSS additions stay in `common-panels.css` and reuse existing DiscWeave tokens.

**Tech Stack:** React, TypeScript, vanilla CSS, Vitest, Testing Library.

---

## File Structure

- Modify `app/src/features/artists/ArtistsWorkspace.tsx`: replace `ArtistTable` with `ArtistMasterList`, add row summary helpers, pass catalog data into the list for counts and relation summaries.
- Modify `app/src/features/artists/ArtistDetail.tsx`: add grouped/deduplicated relationship rendering and remove duplicate relation pills from the mixed relation list.
- Modify `app/src/styles/common-panels.css`: add compact master-list row, chip group, and activity counter styles.
- Modify `app/src/App.workspaces-artists.test.tsx`: update table-based tests to list-based tests and add deduplication assertions.

### Task 1: Failing Tests

**Files:**
- Modify: `app/src/App.workspaces-artists.test.tsx`

- [ ] **Step 1: Update the workspace render test**

Replace table row assertions with list row assertions:

```ts
expect(h.screen.getByRole('list', { name: 'Artist master list' })).toBeVisible()
expect(h.screen.getByRole('button', { name: /aphex twin/i })).toBeVisible()
expect(h.screen.queryByText('Aliases and members')).not.toBeInTheDocument()
expect(h.screen.queryByText('Relation hint')).not.toBeInTheDocument()
```

- [ ] **Step 2: Add separate group assertions**

Add assertions that the selected master-list row exposes separate groups:

```ts
const aphexRow = h.screen.getByRole('button', { name: /aphex twin/i })
expect(h.within(aphexRow).getByText('Aliases')).toBeInTheDocument()
expect(h.within(aphexRow).getByText('Richard D. James')).toBeInTheDocument()
expect(h.within(aphexRow).queryByText('Members')).not.toBeInTheDocument()
```

- [ ] **Step 3: Add duplicate `Member of` coverage**

Add a test that renders a duplicated membership relation and expects one visible
membership chip in the list and one relation card in the detail panel:

```ts
h.render(
  <h.App
    initialCatalogState={{
      artists: [
        {
          ...h.artistRecords[0],
          id: 'alan-wilder',
          name: 'Alan Wilder',
          type: 'Person',
          aliases: [],
          members: [],
          relationHint: 'Member of, Member of',
          relations: [
            { type: 'Member of', target: 'Depeche Mode', detail: 'Keyboardist.' },
            { type: 'Member of', target: 'Depeche Mode', detail: 'Keyboardist.' },
          ],
        },
        {
          ...h.artistRecords[2],
          id: 'depeche-mode',
          name: 'Depeche Mode',
          type: 'Band',
          members: ['Alan Wilder'],
          relations: [],
        },
      ],
    }}
  />,
)
const row = h.screen.getByRole('button', { name: /alan wilder/i })
expect(h.within(row).getAllByText('Member of Depeche Mode')).toHaveLength(1)
const detail = h.screen.getByRole('complementary', { name: 'Alan Wilder' })
expect(h.within(detail).getAllByText('Member of Depeche Mode')).toHaveLength(1)
```

- [ ] **Step 4: Run the focused test and verify failure**

Run:

```bash
cd app
npm test -- App.workspaces-artists.test.tsx
```

Expected: FAIL because the implementation still renders the old table and raw relation hint column.

### Task 2: Master-List View Model And Rendering

**Files:**
- Modify: `app/src/features/artists/ArtistsWorkspace.tsx`

- [ ] **Step 1: Pass catalog data into the list**

Change the `ArtistTable` call to `ArtistMasterList`:

```tsx
<ArtistMasterList
  artists={visibleArtists}
  catalogData={catalogData}
  selectedArtistId={selectedArtist?.id ?? ''}
  onSelectArtist={selectArtist}
/>
```

- [ ] **Step 2: Replace table rendering**

Replace `ArtistTable` with `ArtistMasterList`, `ArtistMasterRow`, and helper functions:

```tsx
type ArtistMasterListProps = {
  artists: ArtistRecord[]
  catalogData: CatalogData
  selectedArtistId: string
  onSelectArtist: (artistId: string) => void
}

function ArtistMasterList({
  artists,
  catalogData,
  selectedArtistId,
  onSelectArtist,
}: ArtistMasterListProps) {
  return (
    <section className="panel catalog-panel" aria-labelledby="artist-results-title">
      <div className="panel-heading">
        <div>
          <h2 id="artist-results-title">Artist master list</h2>
          <p>Aliases, memberships and collection activity for graph lookup.</p>
        </div>
      </div>
      <div className="artist-master-list" role="list" aria-label="Artist master list">
        {artists.map((artist) => (
          <ArtistMasterRow
            key={artist.id}
            artist={artist}
            catalogData={catalogData}
            isSelected={artist.id === selectedArtistId}
            onSelect={() => onSelectArtist(artist.id)}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Add row chips and counters**

Render separate chip groups for aliases, members, memberships, other relations,
and activity counts. Use deduped summaries from helpers.

- [ ] **Step 4: Preserve search**

Leave `artistSearchText` unchanged so legacy `relationHint` values remain
searchable even though they are not displayed.

### Task 3: Detail Relationship Groups

**Files:**
- Modify: `app/src/features/artists/ArtistDetail.tsx`

- [ ] **Step 1: Deduplicate relation appearances**

Update relation deduplication so items with the same normalized label and roles merge even if different sources produced duplicates.

- [ ] **Step 2: Add grouped relationship section**

Render groups in `Relations and credits` after stats and credit roles:

```tsx
<ArtistRelationshipGroups
  aliases={artist.aliases}
  members={artist.members}
  relations={relationAppearances}
/>
```

- [ ] **Step 3: Hide duplicate flat relation cards**

Keep `AppearanceList` for other direct relation appearances only after grouped
membership/member/alias data has been deduplicated, so `Member of Depeche Mode`
does not appear twice.

### Task 4: CSS

**Files:**
- Modify: `app/src/styles/common-panels.css`

- [ ] **Step 1: Add master-list styles**

Add token-based styles:

```css
.artist-master-list {
  display: grid;
}

.artist-master-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  color: inherit;
  cursor: pointer;
  padding: 13px 14px;
  text-align: left;
}
```

- [ ] **Step 2: Add selected, chip group, and counter styles**

Use the existing selected background and badge tokens. Ensure long relation text wraps.

### Task 5: Verification And Commit

**Files:**
- Test: `app/src/App.workspaces-artists.test.tsx`
- Verify: `app/src/features/artists/ArtistsWorkspace.tsx`
- Verify: `app/src/features/artists/ArtistDetail.tsx`
- Verify: `app/src/styles/common-panels.css`

- [ ] **Step 1: Run focused Artists tests**

```bash
cd app
npm test -- App.workspaces-artists.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run app typecheck**

```bash
cd app
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

```bash
cd app
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/App.workspaces-artists.test.tsx app/src/features/artists/ArtistsWorkspace.tsx app/src/features/artists/ArtistDetail.tsx app/src/styles/common-panels.css docs/superpowers/plans/2026-06-24-artists-master-list-redesign-plan.md
git commit -m "feat: redesign artists master list"
```

## Self-Review

- Spec coverage: the plan covers master-list layout, right detail panel retention,
  alias/member/membership separation, relation hint removal from visible index,
  deduplication, CSS, and tests.
- Red-flag scan: no unresolved planning markers remain.
- Type consistency: the plan uses existing `ArtistRecord`, catalog data props,
  and current test harness patterns.
