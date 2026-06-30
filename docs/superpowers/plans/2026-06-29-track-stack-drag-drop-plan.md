# Track Stack Drag-and-Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to drag one standalone Track row onto another Track row or expanded stack and create a stack relation through a relation type chooser.

**Architecture:** Keep this as a Tracks workspace workflow. Reuse the existing Track update client to mark standalone targets as original, reuse the existing relation client to create Track relations, and refresh the catalog after the mutation. Do not add backend endpoints unless current relation validation proves insufficient.

**Tech Stack:** React 19, TypeScript, Vite/Vitest, Testing Library, existing DiscWeave catalog API clients.

---

## File Structure

- Modify `app/src/App.track-stacks.test.tsx`: add drag-and-drop workflow tests around the Tracks workspace.
- Modify `app/src/features/tracks/TracksWorkspace.tsx`: add DnD state, stack drop target resolution, chooser state, relation mutation helpers, and guard helpers.
- Modify `app/src/features/tracks/tracks.css`: add drag affordance, drop target, disabled drag, chooser, error, and highlight styles.
- No backend files should change for the first implementation pass.

---

### Task 1: Add Failing Drag-And-Drop Tests

**Files:**
- Modify: `app/src/App.track-stacks.test.tsx`

- [ ] **Step 1: Import `fireEvent`**

Add this import at the top of `app/src/App.track-stacks.test.tsx`:

```ts
import { fireEvent } from '@testing-library/react'
```

- [ ] **Step 2: Add a standalone drop test**

Append this test inside `describe('App track stacks workspace', () => { ... })`:

```ts
it('creates a stack relation by dropping a standalone track on another standalone track', async () => {
  window.history.pushState({}, '', '/tracks')
  h.clearCatalogForTests()
  const fetchMock = h.vi.fn<Window['fetch']>(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    await Promise.resolve()

    if (url.startsWith('/api/tracks/stacks')) {
      return listResponse([])
    }

    if (url.startsWith('/api/settings/track-stack')) {
      return h.jsonResponse({ relationTypeCodes: ['remixOf', 'versionOf'] })
    }

    if (url.startsWith('/api/tracks?')) {
      return listResponse([
        trackResponse('track-original', 'Show Me Love (New York Mix)', false),
        trackResponse('track-dub', 'Show Me Love (Dub Mix)', false),
      ])
    }

    if (url.startsWith('/api/track-relations?')) {
      return listResponse([])
    }

    if (url === '/api/tracks/track-original' && init?.method === 'PUT') {
      return h.jsonResponse({})
    }

    if (url === '/api/track-relations' && init?.method === 'POST') {
      return h.jsonResponse({}, 201)
    }

    if (url.startsWith('/api/settings/dictionaries?')) {
      return h.defaultDictionaryListResponse()
    }

    if (url.startsWith('/api/rating-criteria?')) {
      return h.defaultRatingCriteriaListResponse()
    }

    return h.emptyCatalogListResponse()
  })
  h.vi.stubGlobal('fetch', fetchMock)
  const user = h.userEvent.setup()

  h.render(<h.App />)

  const source = await h.screen.findByRole('button', {
    name: /Show Me Love \(Dub Mix\)/,
  })
  const target = await h.screen.findByRole('button', {
    name: /Show Me Love \(New York Mix\)/,
  })

  fireEvent.dragStart(source)
  fireEvent.dragOver(target)
  fireEvent.drop(target)

  expect(
    await h.screen.findByRole('dialog', { name: 'Add to stack as' }),
  ).toBeInTheDocument()

  await user.click(h.screen.getByRole('button', { name: 'Version' }))

  await h.waitFor(() => {
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          input === '/api/track-relations' &&
          init?.method === 'POST' &&
          String(init.body).includes('"sourceTrackId":"track-dub"') &&
          String(init.body).includes('"targetTrackId":"track-original"') &&
          String(init.body).includes('"type":"versionOf"'),
      ),
    ).toBe(true)
  })

  expect(
    fetchMock.mock.calls.some(
      ([input, init]) =>
        input === '/api/tracks/track-original' &&
        init?.method === 'PUT' &&
        String(init.body).includes('"isOriginal":true'),
    ),
  ).toBe(true)
})
```

- [ ] **Step 3: Add an expanded stack target test**

Append this test inside the same `describe` block:

```ts
it('drops on an expanded stack member area but creates the relation to the stack root', async () => {
  window.history.pushState({}, '', '/tracks')
  h.clearCatalogForTests()
  const fetchMock = h.vi.fn<Window['fetch']>(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    await Promise.resolve()

    if (url.startsWith('/api/tracks/stacks')) {
      return listResponse([
        {
          originalTrackId: 'track-original',
          originalTitle: 'Show Me Love (New York Mix)',
          originalVersionYear: 1990,
          memberCount: 1,
          hasCycleIssue: false,
          members: [
            {
              trackId: 'track-existing-version',
              title: 'Show Me Love (Montego Mix)',
              versionYear: 1990,
              relationType: 'versionOf',
              depth: 1,
              isDirect: true,
            },
          ],
          issues: [],
        },
      ])
    }

    if (url.startsWith('/api/settings/track-stack')) {
      return h.jsonResponse({ relationTypeCodes: ['remixOf', 'versionOf'] })
    }

    if (url.startsWith('/api/tracks?')) {
      return listResponse([
        trackResponse('track-original', 'Show Me Love (New York Mix)', true),
        trackResponse('track-existing-version', 'Show Me Love (Montego Mix)'),
        trackResponse('track-dub', 'Show Me Love (Dub Mix)'),
      ])
    }

    if (url.startsWith('/api/track-relations?')) {
      return listResponse([
        trackRelationResponse(
          'relation-existing-version',
          'track-existing-version',
          'track-original',
          'versionOf',
        ),
      ])
    }

    if (url === '/api/track-relations' && init?.method === 'POST') {
      return h.jsonResponse({}, 201)
    }

    if (url.startsWith('/api/settings/dictionaries?')) {
      return h.defaultDictionaryListResponse()
    }

    if (url.startsWith('/api/rating-criteria?')) {
      return h.defaultRatingCriteriaListResponse()
    }

    return h.emptyCatalogListResponse()
  })
  h.vi.stubGlobal('fetch', fetchMock)
  const user = h.userEvent.setup()

  h.render(<h.App />)

  await h.screen.findByRole('heading', { name: 'Track records' })
  await user.click(h.screen.getAllByRole('button', { name: 'Expand stack' })[0])

  const source = await h.screen.findByRole('button', {
    name: /Show Me Love \(Dub Mix\)/,
  })
  const visibleMember = await h.screen.findByRole('button', {
    name: /Show Me Love \(Montego Mix\)/,
  })

  fireEvent.dragStart(source)
  fireEvent.dragOver(visibleMember)
  fireEvent.drop(visibleMember)

  await user.click(
    await h.screen.findByRole('button', { name: 'Remix' }),
  )

  await h.waitFor(() => {
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          input === '/api/track-relations' &&
          init?.method === 'POST' &&
          String(init.body).includes('"sourceTrackId":"track-dub"') &&
          String(init.body).includes('"targetTrackId":"track-original"') &&
          String(init.body).includes('"type":"remixOf"'),
      ),
    ).toBe(true)
  })
})
```

- [ ] **Step 4: Add a guard test for existing stack members and stack roots**

Append this test inside the same `describe` block:

```ts
it('does not let existing stack roots or stack members start a stack drag', async () => {
  window.history.pushState({}, '', '/tracks')
  h.clearCatalogForTests()
  const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    await Promise.resolve()

    if (url.startsWith('/api/tracks/stacks')) {
      return listResponse([
        {
          originalTrackId: 'track-original',
          originalTitle: 'Show Me Love (New York Mix)',
          originalVersionYear: 1990,
          memberCount: 1,
          hasCycleIssue: false,
          members: [
            {
              trackId: 'track-dub',
              title: 'Show Me Love (Dub Mix)',
              versionYear: 1990,
              relationType: 'versionOf',
              depth: 1,
              isDirect: true,
            },
          ],
          issues: [],
        },
      ])
    }

    if (url.startsWith('/api/settings/track-stack')) {
      return h.jsonResponse({ relationTypeCodes: ['remixOf', 'versionOf'] })
    }

    if (url.startsWith('/api/tracks?')) {
      return listResponse([
        trackResponse('track-original', 'Show Me Love (New York Mix)', true),
        trackResponse('track-dub', 'Show Me Love (Dub Mix)'),
        trackResponse('track-free', 'Show Me Love (Mauritius Mix)'),
      ])
    }

    if (url.startsWith('/api/track-relations?')) {
      return listResponse([
        trackRelationResponse(
          'relation-dub',
          'track-dub',
          'track-original',
          'versionOf',
        ),
      ])
    }

    if (url.startsWith('/api/settings/dictionaries?')) {
      return h.defaultDictionaryListResponse()
    }

    if (url.startsWith('/api/rating-criteria?')) {
      return h.defaultRatingCriteriaListResponse()
    }

    return h.emptyCatalogListResponse()
  })
  h.vi.stubGlobal('fetch', fetchMock)
  const user = h.userEvent.setup()

  h.render(<h.App />)

  await h.screen.findByRole('heading', { name: 'Track records' })
  await user.click(h.screen.getAllByRole('button', { name: 'Expand stack' })[0])

  const stackRoot = h.screen.getByRole('button', {
    name: /Show Me Love \(New York Mix\)/,
  })
  const stackMember = h.screen.getByRole('button', {
    name: /Show Me Love \(Dub Mix\)/,
  })
  const freeTrack = h.screen.getByRole('button', {
    name: /Show Me Love \(Mauritius Mix\)/,
  })

  expect(stackRoot).toHaveAttribute('draggable', 'false')
  expect(stackMember).toHaveAttribute('draggable', 'false')
  expect(freeTrack).toHaveAttribute('draggable', 'true')

  fireEvent.dragStart(stackRoot)
  fireEvent.drop(freeTrack)

  expect(
    h.screen.queryByRole('dialog', { name: 'Add to stack as' }),
  ).not.toBeInTheDocument()
})
```

- [ ] **Step 5: Run the failing tests**

Run:

```bash
cd /Users/romanosipin/Desktop/personal/discweave/app
npm test -- App.track-stacks.test.tsx
```

Expected: the new tests fail because rows are not draggable and no `Add to stack as` chooser exists.

---

### Task 2: Add Stack Relation Type Loading and Mutation Helpers

**Files:**
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`

- [ ] **Step 1: Add imports**

Update imports near the top of `TracksWorkspace.tsx`:

```ts
import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { createRelation } from '../catalog/api/ownedRelationsClient'
import { loadTrackStackSettings } from '../catalog/api/settingsClient'
import { updateTrack } from '../catalog/api/trackClient'
```

If `useEffect`, `useMemo`, and `useState` are already imported from `react`,
merge `type DragEvent` into that existing import instead of adding a duplicate
React import.

- [ ] **Step 2: Add drag/drop types below `TrackStackMemberGroup`**

Insert these types after `type TrackStackMemberGroup`:

```ts
type StackRelationTypeOption = {
  code: string
  label: string
}

type StackDropDraft = {
  sourceTrack: TrackRecord
  targetRootTrack: TrackRecord
  targetWasStandalone: boolean
}

type StackRelationMutation = {
  sourceTrack: TrackRecord
  targetRootTrack: TrackRecord
  relationTypeCode: string
  targetWasStandalone: boolean
}
```

- [ ] **Step 3: Load stack relation type codes in `TracksWorkspace`**

Add this state beside `expandedStackIds`:

```ts
const [stackRelationTypeCodes, setStackRelationTypeCodes] = useState<string[]>(
  () => [...productStackRelationTypeCodes],
)
```

Add this effect after the existing stack-loading effect:

```ts
useEffect(() => {
  let isActive = true

  if (!serverBackedCatalog) {
    setStackRelationTypeCodes([...productStackRelationTypeCodes])
    return () => {
      isActive = false
    }
  }

  void loadTrackStackSettings()
    .then((settings) => {
      if (isActive) {
        setStackRelationTypeCodes(settings.relationTypeCodes)
      }
    })
    .catch(() => {
      if (isActive) {
        setStackRelationTypeCodes([...productStackRelationTypeCodes])
      }
    })

  return () => {
    isActive = false
  }
}, [serverBackedCatalog])
```

- [ ] **Step 4: Add the mutation handler in `TracksWorkspace`**

Add this function near `handleUpdateTrack`:

```ts
async function handleCreateStackRelation({
  sourceTrack,
  targetRootTrack,
  relationTypeCode,
  targetWasStandalone,
}: StackRelationMutation) {
  if (targetWasStandalone && !targetRootTrack.isOriginal) {
    await updateTrack({ ...targetRootTrack, isOriginal: true })
  }

  await createRelation({
    id: crypto.randomUUID(),
    source: sourceTrack.title,
    sourceLink: { kind: 'track', id: sourceTrack.id },
    sourceType: 'Track',
    target: targetRootTrack.title,
    targetLink: { kind: 'track', id: targetRootTrack.id },
    targetType: 'Track',
    relationType: relationTypeCode,
    role: '',
    context: '',
    evidence: '',
    linkedEntity: '',
    linkedEntityType: 'Track',
    direction: '',
    searchHints: [],
  })

  setExpandedStackIds((current) => new Set(current).add(targetRootTrack.id))
  selectTrack(sourceTrack.id)
  onCatalogChanged?.()
}
```

- [ ] **Step 5: Pass new props into `TrackStacksPanel`**

Extend the `TrackStacksPanel` call with:

```tsx
stackRelationTypeCodes={stackRelationTypeCodes}
onCreateStackRelation={(mutation) => {
  return handleCreateStackRelation(mutation)
}}
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
cd /Users/romanosipin/Desktop/personal/discweave/app
npm run typecheck
```

Expected: fail until `TrackStacksPanelProps` accepts the new props.

---

### Task 3: Implement Drag State, Target Resolution, and Chooser

**Files:**
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`

- [ ] **Step 1: Extend `TrackStacksPanelProps`**

Replace `TrackStacksPanelProps` with:

```ts
type TrackStacksPanelProps = {
  dictionaries: CatalogDictionaries
  expandedStackIds: Set<string>
  ratingCriteria: RatingCriterion[]
  relations: RelationRecord[]
  serverStacks?: TrackStackDto[] | null
  stackRelationTypeCodes: string[]
  tracks: TrackRecord[]
  visibleTracks: TrackRecord[]
  selectedTrackId: string
  onCreateStackRelation: (mutation: StackRelationMutation) => Promise<void>
  onSelectTrack: (trackId: string) => void
  onToggleStack: (stackId: string) => void
}
```

- [ ] **Step 2: Add local drag state inside `TrackStacksPanel`**

Inside `TrackStacksPanel`, after `stacks`, add:

```ts
const [dragSourceTrackId, setDragSourceTrackId] = useState('')
const [dropDraft, setDropDraft] = useState<StackDropDraft | null>(null)
const [dropError, setDropError] = useState('')
const [highlightTrackId, setHighlightTrackId] = useState('')
const stackMemberTrackIds = useMemo(
  () =>
    new Set(
      stacks.flatMap((stack) => stack.members.map((member) => member.track.id)),
    ),
  [stacks],
)
const relationTypeOptions = useMemo(
  () => stackRelationTypeOptions(stackRelationTypeCodes, dictionaries),
  [dictionaries, stackRelationTypeCodes],
)
const dragSourceTrack = dragSourceTrackId
  ? tracks.find((track) => track.id === dragSourceTrackId) ?? null
  : null
```

- [ ] **Step 3: Add event helpers inside `TrackStacksPanel`**

Add these functions inside `TrackStacksPanel` before `return`:

```ts
function startTrackDrag(track: TrackRecord, stack: TrackStackRow) {
  if (!canDragStackTrack(track, stack, stackMemberTrackIds)) {
    return
  }

  setDragSourceTrackId(track.id)
  setDropDraft(null)
  setDropError('')
}

function cancelTrackDrag() {
  setDragSourceTrackId('')
}

function dragOverStack(event: DragEvent, stack: TrackStackRow) {
  if (!dragSourceTrack || !canDropOnStack(dragSourceTrack, stack)) {
    return
  }

  event.preventDefault()
}

function dropOnStack(event: DragEvent, stack: TrackStackRow) {
  event.preventDefault()
  if (!dragSourceTrack || !canDropOnStack(dragSourceTrack, stack)) {
    cancelTrackDrag()
    return
  }

  if (
    hasStackPath(
      stack.original.id,
      dragSourceTrack.id,
      relations,
      stackRelationTypeCodes,
      dictionaries,
    )
  ) {
    setDropError('This relation would create a stack cycle.')
    cancelTrackDrag()
    return
  }

  setDropDraft({
    sourceTrack: dragSourceTrack,
    targetRootTrack: stack.original,
    targetWasStandalone: stack.members.length === 0,
  })
  cancelTrackDrag()
}

async function chooseStackRelation(relationTypeCode: string) {
  if (!dropDraft) {
    return
  }

  if (
    hasDuplicateStackRelation(
      dropDraft.sourceTrack.id,
      dropDraft.targetRootTrack.id,
      relationTypeCode,
      relations,
      dictionaries,
    )
  ) {
    setDropError('This stack relation already exists.')
    setDropDraft(null)
    return
  }

  try {
    await onCreateStackRelation({
      sourceTrack: dropDraft.sourceTrack,
      targetRootTrack: dropDraft.targetRootTrack,
      relationTypeCode,
      targetWasStandalone: dropDraft.targetWasStandalone,
    })
    setHighlightTrackId(dropDraft.sourceTrack.id)
    window.setTimeout(() => setHighlightTrackId(''), 1200)
    setDropDraft(null)
  } catch (error) {
    setDropError(
      error instanceof Error
        ? error.message
        : 'Could not create the stack relation.',
    )
  }
}
```

- [ ] **Step 4: Wire DnD handlers onto root rows and member rows**

Update the root `<div className=...>` so it includes drag/drop handlers and state classes:

```tsx
const canDragRoot = canDragStackTrack(
  stack.original,
  stack,
  stackMemberTrackIds,
)
const isDropTarget =
  Boolean(dragSourceTrack) && canDropOnStack(dragSourceTrack, stack)
```

Use these values in the root element:

```tsx
<div
  className={trackStackRootClassName(
    stack.original.id === selectedTrackId,
    isDropTarget,
  )}
  draggable={canDragRoot}
  onDragEnd={cancelTrackDrag}
  onDragOver={(event) => dragOverStack(event, stack)}
  onDragStart={() => startTrackDrag(stack.original, stack)}
  onDrop={(event) => dropOnStack(event, stack)}
>
```

Update member buttons to act as stack drop zones but not drag sources:

```tsx
className={trackStackMemberClassName(
  member.track.id === selectedTrackId,
  isDropTarget,
  member.track.id === highlightTrackId,
)}
draggable={false}
onDragOver={(event) => dragOverStack(event, stack)}
onDrop={(event) => dropOnStack(event, stack)}
```

- [ ] **Step 5: Render chooser and inline error**

Render this block inside `TrackStacksPanel` after the panel heading and before `track-stack-list`:

```tsx
{dropError ? <p className="track-stack-drop-error">{dropError}</p> : null}
{dropDraft ? (
  <div
    aria-label="Add to stack as"
    className="track-stack-drop-chooser"
    role="dialog"
  >
    <div>
      <strong>Add to stack as</strong>
      <span>
        {dropDraft.sourceTrack.title} to {dropDraft.targetRootTrack.title}
      </span>
    </div>
    <div className="track-stack-drop-choice-list">
      {relationTypeOptions.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => chooseStackRelation(option.code)}
        >
          {option.label}
        </button>
      ))}
    </div>
    <button type="button" onClick={() => setDropDraft(null)}>
      Cancel
    </button>
  </div>
) : null}
```

- [ ] **Step 6: Run the focused test**

Run:

```bash
cd /Users/romanosipin/Desktop/personal/discweave/app
npm test -- App.track-stacks.test.tsx
```

Expected: some assertions may still fail until helper functions and CSS class names exist.

---

### Task 4: Add Helper Functions

**Files:**
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`

- [ ] **Step 1: Add class name and DnD guard helpers after `TrackStacksPanel`**

Insert these helpers after `TrackStacksPanel`:

```ts
function trackStackRootClassName(isSelected: boolean, isDropTarget: boolean) {
  return [
    'track-stack-root',
    isSelected ? 'is-selected' : '',
    isDropTarget ? 'is-drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function trackStackMemberClassName(
  isSelected: boolean,
  isDropTarget: boolean,
  isHighlighted: boolean,
) {
  return [
    'track-stack-member',
    isSelected ? 'is-selected' : '',
    isDropTarget ? 'is-drop-target' : '',
    isHighlighted ? 'is-new-stack-member' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function canDragStackTrack(
  track: TrackRecord,
  stack: TrackStackRow,
  stackMemberTrackIds: Set<string>,
) {
  return (
    stack.original.id === track.id &&
    stack.members.length === 0 &&
    !stackMemberTrackIds.has(track.id)
  )
}

function canDropOnStack(sourceTrack: TrackRecord, stack: TrackStackRow) {
  return sourceTrack.id !== stack.original.id
}
```

- [ ] **Step 2: Add relation option helpers**

Insert these helpers near `stackRelationTypeValues`:

```ts
function stackRelationTypeOptions(
  relationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
): StackRelationTypeOption[] {
  return relationTypeCodes.map((code) => ({
    code,
    label: stackRelationTypeChoiceLabel(code, dictionaries),
  }))
}

function stackRelationTypeChoiceLabel(
  relationTypeCode: string,
  dictionaries: CatalogDictionaries,
) {
  if (relationTypeCode === 'remixOf') {
    return 'Remix'
  }
  if (relationTypeCode === 'versionOf') {
    return 'Version'
  }

  return (
    dictionaries.trackRelationType.find(
      (entry) => entry.code === relationTypeCode,
    )?.name ?? relationTypeCode
  )
}
```

- [ ] **Step 3: Add duplicate and cycle helpers**

Insert these helpers near the stack builder helpers:

```ts
function hasDuplicateStackRelation(
  sourceTrackId: string,
  targetTrackId: string,
  relationTypeCode: string,
  relations: RelationRecord[],
  dictionaries: CatalogDictionaries,
) {
  return relations.some(
    (relation) =>
      relation.sourceLink?.kind === 'track' &&
      relation.sourceLink.id === sourceTrackId &&
      relation.targetLink?.kind === 'track' &&
      relation.targetLink.id === targetTrackId &&
      normalizeTrackRelationTypeCode(relation.relationType, dictionaries) ===
        relationTypeCode,
  )
}

function hasStackPath(
  fromTrackId: string,
  toTrackId: string,
  relations: RelationRecord[],
  stackRelationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
) {
  const stackRelationTypeCodeSet = new Set(stackRelationTypeCodes)
  const adjacency = new Map<string, string[]>()
  for (const relation of relations) {
    if (
      relation.sourceLink?.kind !== 'track' ||
      relation.targetLink?.kind !== 'track' ||
      !stackRelationTypeCodeSet.has(
        normalizeTrackRelationTypeCode(relation.relationType, dictionaries),
      )
    ) {
      continue
    }

    const current = adjacency.get(relation.sourceLink.id) ?? []
    current.push(relation.targetLink.id)
    adjacency.set(relation.sourceLink.id, current)
  }

  const visited = new Set<string>()
  const queue = [fromTrackId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) {
      continue
    }
    if (current === toTrackId) {
      return true
    }
    visited.add(current)
    queue.push(...(adjacency.get(current) ?? []))
  }

  return false
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
cd /Users/romanosipin/Desktop/personal/discweave/app
npm run typecheck
```

Expected: PASS after all helper names and prop types match.

---

### Task 5: Add Drag-And-Drop Styling

**Files:**
- Modify: `app/src/features/tracks/tracks.css`

- [ ] **Step 1: Add styles near existing track stack styles**

Insert this CSS near `.track-stack-root` and `.track-stack-member` styles:

```css
.track-stack-root[draggable='true'] {
  cursor: grab;
}

.track-stack-root[draggable='true']:active {
  cursor: grabbing;
}

.track-stack-root[draggable='false'],
.track-stack-member[draggable='false'] {
  cursor: default;
}

.track-stack-root.is-drop-target,
.track-stack-member.is-drop-target {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
  background: var(--surface-accent);
}

.track-stack-member.is-new-stack-member {
  animation: track-stack-member-added 1.2s ease-out;
}

.track-stack-drop-chooser {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-raised);
}

.track-stack-drop-chooser > div:first-child {
  display: grid;
  gap: 2px;
}

.track-stack-drop-chooser span {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.track-stack-drop-choice-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.track-stack-drop-error {
  margin: 0;
  padding: 10px 16px;
  border-bottom: 1px solid var(--danger-border);
  color: var(--danger-text);
  background: var(--danger-surface);
}

@keyframes track-stack-member-added {
  0% {
    background: var(--surface-accent);
  }
  100% {
    background: transparent;
  }
}
```

- [ ] **Step 2: If CSS variables differ, replace names with existing tokens**

Run this command to find the available variable names:

```bash
cd /Users/romanosipin/Desktop/personal/discweave
rg -n "focus-ring|surface-accent|surface-raised|danger-" app/src
```

Expected: existing tokens are found. If any token is absent, replace it with the closest existing token already used in `tracks.css`; do not introduce a new palette.

- [ ] **Step 3: Run the focused test**

Run:

```bash
cd /Users/romanosipin/Desktop/personal/discweave/app
npm test -- App.track-stacks.test.tsx
```

Expected: PASS.

---

### Task 6: Final Verification

**Files:**
- Modify only if a verification failure identifies a specific issue.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
cd /Users/romanosipin/Desktop/personal/discweave/app
npm test -- App.track-stacks.test.tsx App.workspaces-tracks-playlists.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd /Users/romanosipin/Desktop/personal/discweave/app
npm run build
```

Expected: PASS. The existing Vite large chunk warning may remain.

- [ ] **Step 3: Run targeted backend relation tests only if frontend changes expose API assumptions**

Run this command if relation creation request shape changes or backend validation behavior is touched:

```bash
cd /Users/romanosipin/Desktop/personal/discweave
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "RelationEndpointTests|TrackMetadataEndpointTests"
```

Expected: PASS.

- [ ] **Step 4: Commit implementation**

Run:

```bash
cd /Users/romanosipin/Desktop/personal/discweave
git status --short
git add app/src/App.track-stacks.test.tsx app/src/features/tracks/TracksWorkspace.tsx app/src/features/tracks/tracks.css
git commit -m "Add track stack drag and drop relation creation"
```

Expected: commit succeeds with only frontend implementation files staged.
