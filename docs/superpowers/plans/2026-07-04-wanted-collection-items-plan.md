# Wanted Collection Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved A1 `Collection items` release-entry workflow so wanted digital targets can be saved, filtered, and viewed without being presented as owned physical copies.

**Architecture:** Keep the existing `OwnedItem`/`OwnedCopy` domain model, but change release-entry and release-detail language to `Collection items`. Extend release creation to accept an `ownedCopies` array while retaining legacy `ownedCopy` compatibility. Share the digital payload rule so digital collection items never send physical condition or storage fields.

**Tech Stack:** React 19, TypeScript, Vite/Vitest, ASP.NET Core minimal APIs, xUnit, EF Core/SQLite test host.

---

## File Structure

- Modify `api/src/DiscWeave.Api/Features/Releases/ReleaseRequest.cs`
  - Add `OwnedCopies` to the release create/update request contract.
- Modify `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Entry.cs`
  - Call the plural owned-copy creation helper after creating the release.
- Modify `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.OwnedCopies.cs`
  - Iterate plural collection items and fall back to legacy `OwnedCopy`.
- Modify `api/tests/DiscWeave.Api.Tests/ReleaseEntryWorkflowE2ETests.cs`
  - Add the server contract regression test for `Wanted + Digital` and multiple collection items.
- Modify `app/src/features/catalog/api/releaseClient.ts`
  - Map release collection items to `ownedCopies` and null physical fields for digital media.
- Modify `app/src/features/catalog/catalogApiTestHarness.ts`
  - Extend the release request test payload type with `ownedCopy` and `ownedCopies`.
- Modify `app/src/features/catalog/catalogApi.mutations.test.ts`
  - Add client payload tests for digital and physical collection items.
- Modify `app/src/features/releases/ReleaseEntryFormTypes.ts`
  - Add `CollectionItemDraft`.
- Create `app/src/features/releases/ReleaseCollectionItemsSection.tsx`
  - Render the A1 table editor for collection items.
- Delete `app/src/features/releases/ReleaseOwnedCopySection.tsx`
  - Remove the obsolete release-entry wording.
- Modify `app/src/features/releases/ReleaseEntryForm.tsx`
  - Replace single owned-copy state with collection item draft rows.
- Modify `app/src/features/releases/releaseSubmit.ts`
  - Build `ReleaseRecord.ownedCopies` from collection item drafts.
- Modify `app/src/features/releases/release-form.css`
  - Add compact table styling for the collection item editor.
- Modify `app/src/features/releases/ReleasesWorkspace.tsx`
  - Add the `Ownership status` filter and combine it with medium.
- Modify `app/src/features/releases/ReleaseDetail.tsx`
  - Rename owned-copy detail language to `Collection items` and hide irrelevant physical fields.
- Modify `app/src/App.release-entry-tracklist.test.tsx`
  - Add the release-entry integration test for UI wording, wanted digital creation, detail view, and filters.

## Task 1: Backend Release Create Contract

**Files:**
- Modify: `api/tests/DiscWeave.Api.Tests/ReleaseEntryWorkflowE2ETests.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleaseRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Entry.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.OwnedCopies.cs`

- [ ] **Step 1: Write the failing backend test**

Add this test to `ReleaseEntryWorkflowE2ETests`:

```csharp
[Fact(DisplayName = "Release entry create persists multiple collection items including wanted digital")]
public async Task Release_entry_create_persists_multiple_collection_items_including_wanted_digital()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    Guid artistId = await CreateArtistAsync(client, "Collection Target Artist");

    using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
        "/api/releases",
        new
        {
            title = "Wanted Digital Target",
            type = "maxiSingle",
            isVariousArtists = false,
            artistCredits = new object[] { new { artistId, role = "mainArtist" } },
            labels = Array.Empty<object>(),
            notOnLabel = true,
            year = 1996,
            genres = new[] { "Electronic" },
            tags = Array.Empty<string>(),
            tracklist = new object[]
            {
                new
                {
                    title = "Wanted Mix",
                    position = 1,
                    durationSeconds = 357,
                    artistCredits = Array.Empty<object>()
                }
            },
            ownedCopies = new object[]
            {
                new
                {
                    status = "wanted",
                    medium = new { type = "digital" },
                    condition = (string?)null,
                    storageLocation = (string?)null
                },
                new
                {
                    status = "owned",
                    medium = new { type = "vinyl", description = "12-inch vinyl" },
                    condition = "veryGood",
                    storageLocation = "Shelf A3"
                }
            }
        });
    using JsonDocument createDocument = await ReadJsonAsync(createResponse);

    Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
    Guid releaseId = createDocument.RootElement.GetProperty("id").GetGuid();

    using HttpResponseMessage ownedItemsResponse = await client.GetAsync("/api/owned-items?limit=10&offset=0");
    using JsonDocument ownedItemsDocument = await ReadJsonAsync(ownedItemsResponse);
    JsonElement[] items = [.. ownedItemsDocument.RootElement.GetProperty("items").EnumerateArray()
        .Where(item => item.GetProperty("releaseId").GetGuid() == releaseId)];

    Assert.Equal(2, items.Length);
    JsonElement wantedDigital = Assert.Single(items, item => item.GetProperty("status").GetString() == "wanted");
    Assert.Equal("digital", wantedDigital.GetProperty("medium").GetProperty("type").GetString());
    Assert.Equal(JsonValueKind.Null, wantedDigital.GetProperty("details").GetProperty("digital").GetProperty("files").ValueKind == JsonValueKind.Undefined
        ? JsonValueKind.Null
        : JsonValueKind.Null);
    JsonElement ownedVinyl = Assert.Single(items, item => item.GetProperty("status").GetString() == "owned");
    Assert.Equal("vinyl", ownedVinyl.GetProperty("medium").GetProperty("type").GetString());
    Assert.Equal("Shelf A3", ownedVinyl.GetProperty("details").GetProperty("vinyl").GetProperty("storageLocation").GetString());
}
```

Before implementing, simplify the awkward digital details assertion to:

```csharp
Assert.Equal("digital", wantedDigital.GetProperty("medium").GetProperty("type").GetString());
Assert.Equal(JsonValueKind.Object, wantedDigital.GetProperty("details").GetProperty("digital").ValueKind);
Assert.Equal(JsonValueKind.Null, wantedDigital.GetProperty("details").GetProperty("vinyl").ValueKind);
```

- [ ] **Step 2: Run the backend test to verify RED**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "DisplayName~Release entry create persists multiple collection items including wanted digital"
```

Expected: FAIL because `ownedCopies` is ignored and zero owned items are created.

- [ ] **Step 3: Add plural request contract**

In `ReleaseRequest.cs`, add:

```csharp
public IReadOnlyList<ReleaseOwnedCopyRequest>? OwnedCopies { get; init; }
```

Keep the existing `OwnedCopy` property for legacy clients.

- [ ] **Step 4: Create plural owned-copy helper**

In `ReleasesEndpointRouteBuilderExtensions.OwnedCopies.cs`, replace the single-item helper with a plural helper:

```csharp
private static async Task CreateOwnedCopiesAsync(
    ReleaseRequest request,
    Release release,
    DiscWeaveDbContext context,
    CollectionId collectionId,
    CancellationToken cancellationToken)
{
    foreach (ReleaseOwnedCopyRequest ownedCopy in ReleaseOwnedCopyRequests(request))
    {
        _ = await DictionaryValidation.RequireActiveEntryAsync(
            context,
            collectionId,
            DictionaryKind.MediaType,
            ownedCopy.Medium.Type ?? string.Empty,
            "medium.type_invalid",
            "Medium type is invalid",
            cancellationToken);
        IMedium medium = OwnedItemMapper.CreateMedium(ownedCopy.Medium);
        var item = OwnedItem.Create(
            collectionId,
            OwnedItemId.New(),
            release.Id,
            OwnedItemMapper.ParseOwnershipStatus(ownedCopy.Status),
            medium);
        item.UpdateHolding(OwnedItemMapper.CreateHolding(item.Holding.Medium, ownedCopy.Status, ownedCopy.Condition, ownedCopy.StorageLocation));
        _ = context.OwnedItems.Add(item);
    }
}

private static IReadOnlyList<ReleaseOwnedCopyRequest> ReleaseOwnedCopyRequests(ReleaseRequest request)
{
    if (request.OwnedCopies is { Count: > 0 })
    {
        return request.OwnedCopies;
    }

    return request.OwnedCopy is { } ownedCopy ? [ownedCopy] : [];
}
```

- [ ] **Step 5: Wire the plural helper**

In `ReleasesEndpointRouteBuilderExtensions.Entry.cs`, replace:

```csharp
await CreateOwnedCopyAsync(request, release, context, collectionId, cancellationToken);
```

with:

```csharp
await CreateOwnedCopiesAsync(request, release, context, collectionId, cancellationToken);
```

- [ ] **Step 6: Run the backend test to verify GREEN**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "DisplayName~Release entry create persists multiple collection items including wanted digital"
```

Expected: PASS.

## Task 2: Frontend API Payload

**Files:**
- Modify: `app/src/features/catalog/catalogApiTestHarness.ts`
- Modify: `app/src/features/catalog/catalogApi.mutations.test.ts`
- Modify: `app/src/features/catalog/api/releaseClient.ts`

- [ ] **Step 1: Write failing client payload tests**

Extend `ReleaseRequestPayload` in `catalogApiTestHarness.ts`:

```ts
export type ReleaseOwnedCopyRequestPayload = {
  status?: string
  medium?: {
    type?: string
    description?: string | null
    discCount?: number | null
  }
  condition?: string | null
  storageLocation?: string | null
}

export type ReleaseRequestPayload = {
  tracklist?: Array<Record<string, unknown>>
  ownedCopy?: ReleaseOwnedCopyRequestPayload | null
  ownedCopies?: ReleaseOwnedCopyRequestPayload[]
}
```

Add this test to `catalogApi.mutations.test.ts`:

```ts
it('sends release collection items with digital physical fields cleared', async () => {
  const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
    h.jsonResponse({ id: 'release-id' }, 201),
  )
  vi.stubGlobal('fetch', fetchMock)
  const release: ReleaseRecord = {
    id: 'release-id',
    title: 'Wanted Digital Target',
    artist: 'Target Artist',
    artistCredits: [{ artist: 'Target Artist', role: 'Main artist' }],
    type: 'Maxisingle',
    year: '1996',
    label: 'Not On Label',
    labels: [],
    notOnLabel: true,
    genres: ['Electronic'],
    tags: [],
    releaseNotes: '',
    ownedCopies: [
      {
        id: 'wanted-digital',
        medium: 'Digital',
        status: 'Wanted',
        storage: 'No storage recorded',
        condition: 'No condition recorded',
        note: 'Find lossless digital version',
      },
      {
        id: 'owned-vinyl',
        medium: '12-inch vinyl',
        status: 'Owned',
        storage: 'Shelf A3',
        condition: 'Very Good',
        note: '',
      },
    ],
  }

  await api.createRelease(release, [])

  const payload = h.releaseRequestPayload(fetchMock.mock.calls[0][1])
  expect(payload.ownedCopies).toEqual([
    {
      status: 'wanted',
      medium: { type: 'digital' },
      condition: null,
      storageLocation: null,
    },
    {
      status: 'owned',
      medium: { type: 'vinyl', description: '12-inch vinyl' },
      condition: 'veryGood',
      storageLocation: 'Shelf A3',
    },
  ])
  expect(payload.ownedCopy).toEqual(payload.ownedCopies?.[0])
})
```

- [ ] **Step 2: Run the client test to verify RED**

Run:

```bash
npm --prefix app test -- app/src/features/catalog/catalogApi.mutations.test.ts -t "sends release collection items with digital physical fields cleared"
```

Expected: FAIL because `ownedCopies` is missing and digital physical fields are not cleared in the release create payload.

- [ ] **Step 3: Implement release collection item payload mapping**

In `releaseClient.ts`, add local helpers near `createRelease`:

```ts
function toReleaseOwnedCopyRequest(copy: ReleaseRecord['ownedCopies'][number]) {
  const medium = toMediumRequest(copy.medium)
  const isDigital = medium.type === 'digital'

  return {
    status: toOwnershipStatusCode(copy.status),
    medium,
    condition: isDigital ? null : toConditionCode(copy.condition),
    storageLocation: isDigital ? null : textOrNull(copy.storage),
  }
}

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''

  return trimmed.length > 0 ? trimmed : null
}
```

Inside `createRelease`, compute:

```ts
const ownedCopies = release.ownedCopies.map(toReleaseOwnedCopyRequest)
```

Then replace the current inline `ownedCopy` mapping with:

```ts
ownedCopy: ownedCopies[0] ?? null,
ownedCopies,
```

- [ ] **Step 4: Run the client test to verify GREEN**

Run:

```bash
npm --prefix app test -- app/src/features/catalog/catalogApi.mutations.test.ts -t "sends release collection items with digital physical fields cleared"
```

Expected: PASS.

## Task 3: Release Entry Collection Items UI

**Files:**
- Modify: `app/src/features/releases/ReleaseEntryFormTypes.ts`
- Create: `app/src/features/releases/ReleaseCollectionItemsSection.tsx`
- Delete: `app/src/features/releases/ReleaseOwnedCopySection.tsx`
- Modify: `app/src/features/releases/ReleaseEntryForm.tsx`
- Modify: `app/src/features/releases/releaseSubmit.ts`
- Modify: `app/src/features/releases/release-form.css`
- Modify: `app/src/App.release-entry-tracklist.test.tsx`

- [ ] **Step 1: Write failing UI integration test**

Add this test to `App.release-entry-tracklist.test.tsx`:

```ts
it('adds a wanted digital collection item and filters releases by status and medium', async () => {
  window.history.pushState({}, '', '/releases')
  const user = h.userEvent.setup()
  h.render(<h.App />)

  await user.click(h.screen.getByRole('button', { name: 'Add release' }))
  const form = h.screen.getByRole('form', { name: 'Add release' })

  expect(h.within(form).getByRole('heading', { name: 'Collection items' })).toBeVisible()
  expect(h.within(form).queryByText('Owned copy')).not.toBeInTheDocument()
  expect(h.within(form).queryByText('Add owned copy')).not.toBeInTheDocument()

  await user.type(h.within(form).getByLabelText('Title'), 'Wanted Digital Target')
  await h.addReleaseArtist(user, form, 'Autechre')
  await user.click(h.within(form).getByLabelText('Not On Label'))
  await h.selectReleaseGenre(user, form, 'Electronic')
  await h.addReleaseTrackRow(user, form, 'Wanted Mix')
  await user.click(h.within(form).getByRole('button', { name: '+ Item' }))
  await user.selectOptions(h.within(form).getByLabelText('Collection item 1 status'), 'Wanted')
  await user.selectOptions(h.within(form).getByLabelText('Collection item 1 medium'), 'Digital')
  await user.type(
    h.within(form).getByLabelText('Collection item 1 note'),
    'Find lossless digital version',
  )

  await user.click(h.screen.getByRole('button', { name: 'Add record' }))
  await user.click(await h.screen.findByRole('button', { name: /wanted digital target/i }))

  const releasePanel = h.screen.getByRole('complementary', {
    name: 'Wanted Digital Target',
  })
  const collectionItems = h.detailSection(releasePanel, 'Collection items')
  expect(collectionItems).toHaveTextContent('Wanted')
  expect(collectionItems).toHaveTextContent('Digital')
  expect(collectionItems).toHaveTextContent('Find lossless digital version')
  expect(
    h.within(releasePanel).queryByRole('heading', { name: 'Owned copies' }),
  ).not.toBeInTheDocument()

  await user.selectOptions(h.screen.getByLabelText('Ownership status'), 'Wanted')
  await user.selectOptions(h.screen.getByLabelText('Medium'), 'Digital')

  expect(
    h.screen.getByRole('button', { name: /wanted digital target/i }),
  ).toBeVisible()
})
```

- [ ] **Step 2: Run the UI test to verify RED**

Run:

```bash
npm --prefix app test -- app/src/App.release-entry-tracklist.test.tsx -t "adds a wanted digital collection item and filters releases by status and medium"
```

Expected: FAIL because the form still renders `Owned copy`, lacks `+ Item`, lacks the status filter, and the detail panel heading is still `Owned copies`.

- [ ] **Step 3: Add collection item draft type**

In `ReleaseEntryFormTypes.ts`, import `OwnedCopy` and add:

```ts
export type CollectionItemDraft = {
  id: string
  status: OwnedCopy['status'] | ''
  medium: string
  note: string
}
```

- [ ] **Step 4: Add the A1 collection item section component**

Create `ReleaseCollectionItemsSection.tsx` with:

```tsx
import type { CollectionItemDraft } from './ReleaseEntryFormTypes'
import type { OwnedCopy } from './releasesData'

type ReleaseCollectionItemsSectionProps = {
  collectionItems: CollectionItemDraft[]
  mediaTypeOptions: string[]
  onAddItem: () => void
  onRemoveItem: (id: string) => void
  onUpdateItem: (
    id: string,
    field: keyof Pick<CollectionItemDraft, 'status' | 'medium' | 'note'>,
    value: string,
  ) => void
}

const statusOptions: OwnedCopy['status'][] = [
  'Owned',
  'Wanted',
  'Sold',
  'Needs digitization',
]

export function ReleaseCollectionItemsSection({
  collectionItems,
  mediaTypeOptions,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}: ReleaseCollectionItemsSectionProps) {
  return (
    <section className="manual-entry-wide release-form-section release-collection-items-section">
      <div className="release-form-section-header">
        <div>
          <h3>Collection items</h3>
          <p>Track owned copies, wanted targets, and other collection statuses for this release.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onAddItem}>
          + Item
        </button>
      </div>
      {collectionItems.length > 0 ? (
        <div className="release-collection-items-grid" role="table" aria-label="Collection items">
          <div className="release-collection-items-heading" role="row">
            <span>Status</span>
            <span>Medium</span>
            <span>Note</span>
            <span className="visually-hidden">Actions</span>
          </div>
          {collectionItems.map((item, index) => (
            <div className="release-collection-items-row" role="row" key={item.id}>
              <label>
                <span className="visually-hidden">Collection item {index + 1} status</span>
                <select
                  aria-label={`Collection item ${index + 1} status`}
                  value={item.status}
                  onChange={(event) => onUpdateItem(item.id, 'status', event.target.value)}
                >
                  <option value="">Not recorded</option>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="visually-hidden">Collection item {index + 1} medium</span>
                <select
                  aria-label={`Collection item ${index + 1} medium`}
                  value={item.medium}
                  onChange={(event) => onUpdateItem(item.id, 'medium', event.target.value)}
                >
                  <option value="">Not recorded</option>
                  {mediaTypeOptions.map((mediaType) => (
                    <option key={mediaType}>{mediaType}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="visually-hidden">Collection item {index + 1} note</span>
                <input
                  aria-label={`Collection item ${index + 1} note`}
                  value={item.note}
                  onChange={(event) => onUpdateItem(item.id, 'note', event.target.value)}
                />
              </label>
              <button
                className="button button-secondary"
                type="button"
                aria-label={`Remove collection item ${index + 1}`}
                onClick={() => onRemoveItem(item.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No collection items added.</p>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Replace release form state and submit input**

In `ReleaseEntryForm.tsx`, replace the `ReleaseOwnedCopySection` import with `ReleaseCollectionItemsSection`.

Replace `includeOwnedCopy`, `medium`, and `status` state with:

```ts
const [collectionItems, setCollectionItems] = useState<CollectionItemDraft[]>(
  () =>
    initialRelease?.ownedCopies.map((copy, index) => ({
      id: copy.id || createManualRecordId('collection-item', `${index + 1}`),
      status: copy.status,
      medium: copy.medium,
      note: copy.note,
    })) ?? [],
)
```

Add handlers:

```ts
function addCollectionItem() {
  setCollectionItems((items) => [
    ...items,
    {
      id: createManualRecordId('collection-item', `${items.length + 1}`),
      status: '',
      medium: '',
      note: '',
    },
  ])
}

function removeCollectionItem(itemId: string) {
  setCollectionItems((items) => items.filter((item) => item.id !== itemId))
}

function updateCollectionItem(
  itemId: string,
  field: keyof Pick<CollectionItemDraft, 'status' | 'medium' | 'note'>,
  value: string,
) {
  setCollectionItems((items) =>
    items.map((item) =>
      item.id === itemId ? { ...item, [field]: value } : item,
    ),
  )
}
```

Pass `collectionItems` into `buildReleaseSubmission` and render:

```tsx
<ReleaseCollectionItemsSection
  collectionItems={collectionItems}
  mediaTypeOptions={mediaTypeOptions}
  onAddItem={addCollectionItem}
  onRemoveItem={removeCollectionItem}
  onUpdateItem={updateCollectionItem}
/>
```

- [ ] **Step 6: Build release owned copies from draft rows**

In `releaseSubmit.ts`, replace `firstCopy`, `includeOwnedCopy`, `medium`, and `status` input fields with:

```ts
collectionItems: CollectionItemDraft[]
```

Build `ownedCopies` like this:

```ts
const ownedCopies: OwnedCopy[] = collectionItems
  .map((item, index) => ({
    id: item.id || createManualRecordId('release-copy', `${releaseTitle}-${index + 1}`),
    medium: textOrFallback(item.medium.trim(), 'Other'),
    status: item.status || 'Owned',
    storage: '',
    condition: '',
    note: item.note.trim(),
  }))
  .filter((item) => item.medium.trim().length > 0 || item.status)
```

If editing existing physical copies needs preservation, use the existing `id` to preserve previous `storage` and `condition`; otherwise blank fields are acceptable for release entry because physical details belong in the owned-item workspace.

- [ ] **Step 7: Add collection item CSS**

In `release-form.css`, add compact grid styles:

```css
.release-collection-items-section .empty-state {
  margin: 0;
  color: var(--color-muted);
}

.release-collection-items-grid {
  display: grid;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.release-collection-items-heading,
.release-collection-items-row {
  display: grid;
  grid-template-columns: minmax(10rem, 0.8fr) minmax(10rem, 0.8fr) minmax(14rem, 1.4fr) auto;
  gap: 0.75rem;
  align-items: end;
  padding: 0.75rem;
}

.release-collection-items-heading {
  align-items: center;
  background: var(--color-surface-muted);
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.release-collection-items-row + .release-collection-items-row {
  border-top: 1px solid var(--color-border);
}

.release-collection-items-row label {
  display: grid;
  gap: 0.35rem;
}

@media (max-width: 900px) {
  .release-collection-items-heading {
    display: none;
  }

  .release-collection-items-row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 8: Remove obsolete component**

Delete `ReleaseOwnedCopySection.tsx` after the import is removed.

- [ ] **Step 9: Run the UI test to verify GREEN**

Run:

```bash
npm --prefix app test -- app/src/App.release-entry-tracklist.test.tsx -t "adds a wanted digital collection item and filters releases by status and medium"
```

Expected: PASS after Tasks 4 changes are complete.

## Task 4: Release Filters And Detail Wording

**Files:**
- Modify: `app/src/features/releases/ReleasesWorkspace.tsx`
- Modify: `app/src/features/releases/ReleaseDetail.tsx`

- [ ] **Step 1: Add ownership status filter**

In `ReleasesWorkspace.tsx`, extend filter state:

```ts
const [filters, setFilters] = useState({
  medium: '',
  ownershipStatus: '',
  label: '',
  year: '',
  tag: '',
})
```

Extend `visibleReleases`:

```ts
(!filters.ownershipStatus ||
  release.ownedCopies.some((copy) => copy.status === filters.ownershipStatus)) &&
```

Add a `FilterSelect` after `Medium`:

```tsx
<FilterSelect
  label="Ownership status"
  value={filters.ownershipStatus}
  values={uniqueValues(
    releases.flatMap((release) =>
      release.ownedCopies.map((copy) => copy.status),
    ),
  )}
  onChange={(ownershipStatus) =>
    setFilters((current) => ({ ...current, ownershipStatus }))
  }
/>
```

- [ ] **Step 2: Rename release detail collection section**

In `ReleaseDetail.tsx`, change:

```tsx
<h3 id="release-owned-title">Owned copies</h3>
```

to:

```tsx
<h3 id="release-owned-title">Collection items</h3>
```

Rename `OwnedCopyCard` to `CollectionItemCard`. Render storage and condition only when they are meaningful:

```tsx
const hasStorage = copy.storage.trim().length > 0 && copy.storage !== 'No storage recorded'
const hasCondition = copy.condition.trim().length > 0 && copy.condition !== 'No condition recorded'
```

Only render the `<dl>` when either flag is true.

Change `Owned item backlinks` to `Collection item backlinks`, and empty copy to:

```tsx
<p>No collection items point back to this release yet.</p>
```

- [ ] **Step 3: Re-run the UI test**

Run:

```bash
npm --prefix app test -- app/src/App.release-entry-tracklist.test.tsx -t "adds a wanted digital collection item and filters releases by status and medium"
```

Expected: PASS.

## Task 5: Verification

**Files:**
- No new implementation files.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
npm --prefix app test -- app/src/features/catalog/catalogApi.mutations.test.ts app/src/App.release-entry-tracklist.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run focused backend tests**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~ReleaseEntryWorkflowE2ETests"
```

Expected: PASS.

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 4: Build desktop app if checks pass**

Run:

```bash
npm --prefix app run desktop:build:mac
```

Expected: PASS, producing the macOS desktop build under `app/release`.

## Self Review

- Spec coverage: The plan implements `Collection items` wording, A1 table UI, wanted digital save, plural collection item persistence, release status filtering, and detail wording. Marketplace, price tracking, and global Owned Items navigation rename remain out of scope as specified.
- Placeholder scan: No task relies on `TODO` or vague "add tests" instructions; each task names concrete files, commands, and expected outcomes.
- Type consistency: The plan consistently uses `CollectionItemDraft` in the release form, `OwnedCopy` for existing frontend release state, and `ownedCopies`/`OwnedCopies` for the API contract.
