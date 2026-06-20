# Owned Items Digital And Physical UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Owned Items UI so digital release copies render digital file coverage and physical release copies render storage, condition, and type-specific physical details.

**Architecture:** Keep the existing React master-detail workspace and extend the frontend owned-item view model with type-aware digital and physical detail data. The API already exposes `details.digital` and physical detail branches, so Roadmap 61 should map those fields into UI-specific records, render conditional detail sections, and keep create/update payloads from sending physical fields for digital copies.

**Tech Stack:** React 19, TypeScript 6, Vite, Vitest, Testing Library, ASP.NET Core API contracts already represented by frontend DTOs.

---

## Scope Boundaries

This plan implements GitHub issue `Fredoq/discweave#45` / Roadmap 61.

Implemented here:

- Owned Items table copy and summaries become type-aware.
- Digital detail panels show digital copy overview and release track file coverage.
- Digital detail panels do not render physical detail sections or missing physical storage/condition warnings.
- Physical detail panels keep storage, condition, and type-specific physical fields visible.
- Add/edit owned item form switches visible fields when the selected medium is digital or physical.
- Owned item create/update payloads send `condition: null` and `storageLocation: null` for digital copies.
- Testing Library and mapper tests cover digital and physical rendering paths.

Not implemented here:

- Backend domain redesign.
- New import confirmation behavior.
- Track detail redesign.
- Export/restore changes.
- Review Workbench detector changes.
- Loose file import without release context.
- File deletion, playback, cloud sync, social, marketplace, or recommendation behavior.

## File Structure

Modify:

- `app/src/features/ownedItems/ownedItemsData.ts` - add type-aware owned item view-model fields and summary helpers.
- `app/src/features/catalog/api/ownedItemEntityMappers.ts` - map Roadmap 60 API details into the type-aware view model.
- `app/src/features/catalog/api/ownedRelationsClient.ts` - prevent digital create/update payloads from sending physical fields.
- `app/src/features/ownedItems/OwnedItemDetail.tsx` - render digital or physical detail sections based on owned item type.
- `app/src/features/ownedItems/OwnedItemsWorkspace.tsx` - update local table columns, filters, search copy, and type-aware add/edit form fields.
- `app/src/features/ownedItems/ServerOwnedItemsWorkspace.tsx` - update server-backed table/filter labels and summaries for consistency.
- `app/src/features/releases/releasesData.ts` - remove physical-condition wording from the static digital owned-copy fixture.
- `app/src/features/catalog/catalogApi.inventoryMapping.test.ts` - cover type-aware mapper behavior.
- `app/src/features/catalog/catalogApi.mutations.test.ts` - cover digital owned item payloads with null physical fields.
- `app/src/App.workspaces-owned-relations.test.tsx` - cover local Owned Items UI rendering and form behavior.
- `app/src/App.owned-items-inventory.test.tsx` - cover API-loaded digital owned item rendering.

---

### Task 1: Add Type-Aware Mapper Tests

**Files:**

- Modify: `app/src/features/catalog/catalogApi.inventoryMapping.test.ts`

- [ ] **Step 1: Replace the existing mapper expectations with explicit digital and physical expectations**

Edit `app/src/features/catalog/catalogApi.inventoryMapping.test.ts` so the existing test body includes codec, quality, and missing count data for the digital copy:

```ts
const digitalItem = toOwnedItemRecord(
  {
    id: 'owned-ceremony-file',
    releaseId: 'release-movement',
    release: {
      id: 'release-movement',
      title: 'Movement',
    },
    status: 'owned',
    medium: {
      type: 'digital',
      description: 'Digital',
      discCount: null,
    },
    details: {
      digital: {
        releaseTrackCount: 2,
        linkedFileCount: 1,
        missingFileCount: 1,
        files: [
          {
            digitalTrackFileLinkId: 'link-ceremony-file',
            releaseTrackId: 'release-track-ceremony',
            trackId: 'track-ceremony',
            trackTitle: 'Ceremony',
            position: 1,
            localAudioFileId: 'local-ceremony-file',
            path: '/music/new-order/ceremony.mp3',
            format: 'mp3',
            codec: 'mp3',
            quality: 'lossy',
            sizeBytes: 8192,
            durationSeconds: 263,
            bitrateKbps: 320,
            sampleRateHz: 44100,
            channels: 2,
          },
        ],
      },
    },
    inventorySignals: ['lossyWithoutLossless', 'owned'],
  },
  new Map(),
  [],
  defaultCatalogDictionaries,
)
```

Replace the final digital expectation with:

```ts
expect(digitalItem).toMatchObject({
  title: 'Movement',
  targetType: 'Release',
  targetId: 'release-movement',
  releaseId: 'release-movement',
  releaseTitle: 'Movement',
  medium: 'Digital',
  mediumType: 'digital',
  storage: '1 local file linked',
  condition: '1 / 2 files linked',
  fileFormat: 'MP3',
  digitalState: '1 / 2 files linked',
  inventorySignals: ['lossyWithoutLossless', 'owned'],
  digitalDetails: {
    releaseTrackCount: 2,
    linkedFileCount: 1,
    missingFileCount: 1,
    files: [
      {
        digitalTrackFileLinkId: 'link-ceremony-file',
        releaseTrackId: 'release-track-ceremony',
        trackId: 'track-ceremony',
        trackTitle: 'Ceremony',
        position: '1',
        localAudioFileId: 'local-ceremony-file',
        path: '/music/new-order/ceremony.mp3',
        format: 'MP3',
        codec: 'MP3',
        quality: 'Lossy',
        size: '8 KB',
        duration: '4:23',
        bitrate: '320 kbps',
        sampleRate: '44.1 kHz',
        channels: 'Stereo',
      },
    ],
  },
})
expect(digitalItem.storage).not.toBe('No storage recorded')
expect(digitalItem.condition).not.toBe('No condition recorded')
```

Add this physical detail expectation after the existing `releaseItem` assertion:

```ts
expect(releaseItem).toMatchObject({
  mediumType: 'vinyl',
  physicalDetails: {
    formatDescription: '12-inch vinyl',
    storageLocation: 'Shelf A3',
    condition: 'Very Good',
  },
})
```

- [ ] **Step 2: Run the focused mapper test and verify it fails**

Run:

```bash
cd app
npm test -- --run src/features/catalog/catalogApi.inventoryMapping.test.ts
```

Expected: FAIL because `OwnedItemRecord` does not yet expose `mediumType`, `digitalDetails`, `physicalDetails`, and the mapper still returns physical fallback text for digital storage/condition.

- [ ] **Step 3: Commit the failing tests**

```bash
git add app/src/features/catalog/catalogApi.inventoryMapping.test.ts
git commit -m "test: cover type-aware owned item mapping"
```

---

### Task 2: Implement Type-Aware Owned Item View Model And Mapper

**Files:**

- Modify: `app/src/features/ownedItems/ownedItemsData.ts`
- Modify: `app/src/features/catalog/api/ownedItemEntityMappers.ts`
- Modify: `app/src/features/releases/releasesData.ts`
- Test: `app/src/features/catalog/catalogApi.inventoryMapping.test.ts`

- [ ] **Step 1: Extend the owned item view-model types**

In `app/src/features/ownedItems/ownedItemsData.ts`, add these types above `OwnedItemRecord`:

```ts
export type OwnedItemMediumType =
  | 'digital'
  | 'vinyl'
  | 'cd'
  | 'cassette'
  | 'other'

export type DigitalFileCoverageRecord = {
  digitalTrackFileLinkId: string
  releaseTrackId: string
  trackId: string
  trackTitle: string
  position: string
  disc?: string
  side?: string
  localAudioFileId: string
  path: string
  format: string
  codec: string
  quality: string
  size: string
  modifiedAt: string
  contentHash: string
  duration: string
  bitrate: string
  sampleRate: string
  channels: string
}

export type DigitalCopyDetailsRecord = {
  releaseTrackCount: number
  linkedFileCount: number
  missingFileCount: number
  files: DigitalFileCoverageRecord[]
}

export type PhysicalCopyDetailsRecord = {
  formatDescription?: string
  discCount?: number
  tapeType?: string
  name?: string
  storageLocation: string
  condition: string
}
```

Add these optional fields to `OwnedItemRecord` immediately after `medium: string`:

```ts
  mediumType?: OwnedItemMediumType
  digitalDetails?: DigitalCopyDetailsRecord
  physicalDetails?: PhysicalCopyDetailsRecord
```

- [ ] **Step 2: Add type-aware summary helpers**

In `app/src/features/ownedItems/ownedItemsData.ts`, add these helper functions after `formatCollectorSignal`:

```ts
export function isDigitalOwnedItem(item: OwnedItemRecord) {
  return item.mediumType === 'digital' || isDigitalMediumLabel(item.medium)
}

export function isDigitalMediumLabel(value: string) {
  const normalized = value.trim().toLowerCase()

  return (
    normalized === 'digital' ||
    normalized.includes('digital') ||
    normalized.includes('flac') ||
    normalized.includes('alac') ||
    normalized.includes('mp3')
  )
}

export function ownedItemLocationSummary(item: OwnedItemRecord) {
  if (isDigitalOwnedItem(item)) {
    const linkedFileCount = item.digitalDetails?.linkedFileCount ?? 0
    if (linkedFileCount > 0) {
      return `${linkedFileCount} local file${linkedFileCount === 1 ? '' : 's'} linked`
    }

    return 'Digital copy'
  }

  return item.physicalDetails?.storageLocation || item.storage
}

export function ownedItemStateSummary(item: OwnedItemRecord) {
  if (isDigitalOwnedItem(item)) {
    return item.digitalState
  }

  return item.physicalDetails?.condition || item.condition
}

export function digitalCoverageSummary(
  details: DigitalCopyDetailsRecord | undefined,
) {
  if (!details) {
    return 'Digital copy recorded'
  }

  if (details.releaseTrackCount > 0) {
    return `${details.linkedFileCount} / ${details.releaseTrackCount} files linked`
  }

  if (details.linkedFileCount > 0) {
    return `${details.linkedFileCount} local file${details.linkedFileCount === 1 ? '' : 's'} linked`
  }

  return 'No local files linked'
}
```

- [ ] **Step 3: Update static owned item fixtures**

In `app/src/features/ownedItems/ownedItemsData.ts`, add `mediumType` and type-specific details to each fixture.

For `selected-ambient-works-cd`, add:

```ts
    mediumType: 'cd',
    physicalDetails: {
      discCount: 1,
      storageLocation: 'CD shelf B1',
      condition: 'Very Good',
    },
```

For `blue-monday-vinyl`, add:

```ts
    mediumType: 'vinyl',
    physicalDetails: {
      formatDescription: '12-inch vinyl',
      storageLocation: 'Shelf A3',
      condition: 'Sleeve: Good, Media: Very Good',
    },
```

For `dfa-remix-digital`, change the old physical-ish fields:

```ts
    storage: 'Digital copy',
    condition: '1 / 1 files linked',
```

and add:

```ts
    mediumType: 'digital',
    digitalDetails: {
      releaseTrackCount: 1,
      linkedFileCount: 1,
      missingFileCount: 0,
      files: [
        {
          digitalTrackFileLinkId: 'link-yeah-pretentious-mix-file',
          releaseTrackId: 'release-track-yeah-pretentious-mix',
          trackId: 'yeah-pretentious-mix',
          trackTitle: 'Yeah (Pretentious Mix)',
          position: '8',
          localAudioFileId: 'local-yeah-pretentious-mix-file',
          path: '/archive/lcd-soundsystem/dfa-remix/08-yeah-pretentious-mix.mp3',
          format: 'MP3',
          codec: 'MP3',
          quality: 'Lossy',
          size: 'Not recorded',
          modifiedAt: 'Not recorded',
          contentHash: 'sha256: sample-yeah-pretentious-mix',
          duration: '11:06',
          bitrate: '320 kbps',
          sampleRate: 'Not recorded',
          channels: 'Not recorded',
        },
      ],
    },
```

Also change the same digital fixture's `digitalState` to:

```ts
    digitalState: '1 / 1 files linked',
```

- [ ] **Step 4: Remove physical-condition wording from the static release backlink fixture**

In `app/src/features/releases/releasesData.ts`, update the `the-dfa-remix` owned copy:

```ts
    ownedCopies: [
      {
        id: 'dfa-digital',
        medium: 'Digital',
        status: 'Owned',
        storage: '1 local file linked',
        condition: '1 / 1 files linked',
        note: 'Mock digital release copy used to show release-to-owned-copy separation.',
      },
    ],
```

- [ ] **Step 5: Map API details into type-aware records**

In `app/src/features/catalog/api/ownedItemEntityMappers.ts`, update the imports:

```ts
import type {
  DigitalCopyDetailsRecord,
  DigitalFileCoverageRecord,
  OwnedItemMediumType,
  OwnedItemRecord,
  OwnedItemTargetRecord,
  PhysicalCopyDetailsRecord,
} from '../../ownedItems/ownedItemsData'
import { digitalCoverageSummary } from '../../ownedItems/ownedItemsData'
```

Also import `DigitalFileCoverageDto` from `catalogTypes` and `formatDuration`
from `catalogValueMappers`:

```ts
  DigitalFileCoverageDto,
```

```ts
  formatDuration,
```

Then replace the local mapping variables from `const status = ...` through `const fileFormats = ...` with:

```ts
  const status = ownershipStatusLabel(item.status)
  const condition = ownedItemCondition(item)
  const storageLocation = ownedItemStorageLocation(item)
  const mediumType = ownedItemMediumType(item.medium.type)
  const digitalDetails = toDigitalCopyDetails(item)
  const physicalDetails = toPhysicalCopyDetails(item, mediumType)
  const digitalState =
    mediumType === 'digital'
      ? digitalCoverageSummary(digitalDetails)
      : 'No digital file recorded'
  const fileFormats = [
    ...new Set(
      (digitalDetails?.files ?? [])
        .map((file) => file.format)
        .filter((format) => format !== 'Not recorded'),
    ),
  ]
```

In the returned object, add:

```ts
    mediumType,
    digitalDetails,
    physicalDetails,
```

and replace `storage`, `condition`, and `digitalState` with:

```ts
    storage:
      mediumType === 'digital'
        ? digitalOwnedItemStorage(digitalDetails)
        : (storageLocation ?? 'No storage recorded'),
    condition:
      mediumType === 'digital' ? digitalState : conditionLabel(condition),
    digitalState,
```

- [ ] **Step 6: Add mapper helper functions**

In `app/src/features/catalog/api/ownedItemEntityMappers.ts`, replace the current `digitalOwnedItemStorage(item: OwnedItemDto)` helper with these helpers:

```ts
function ownedItemMediumType(value: string): OwnedItemMediumType {
  switch (value) {
    case 'digital':
    case 'vinyl':
    case 'cd':
    case 'cassette':
      return value
    default:
      return 'other'
  }
}

function toDigitalCopyDetails(
  item: OwnedItemDto,
): DigitalCopyDetailsRecord | undefined {
  const details = item.details.digital
  if (!details) {
    return undefined
  }

  return {
    releaseTrackCount: details.releaseTrackCount,
    linkedFileCount: details.linkedFileCount,
    missingFileCount: details.missingFileCount,
    files: details.files.map(toDigitalFileCoverageRecord),
  }
}

function toDigitalFileCoverageRecord(
  file: DigitalFileCoverageDto,
): DigitalFileCoverageRecord {
  return {
    digitalTrackFileLinkId: file.digitalTrackFileLinkId,
    releaseTrackId: file.releaseTrackId,
    trackId: file.trackId,
    trackTitle: file.trackTitle,
    position: file.position.toString(),
    disc: file.disc ?? undefined,
    side: file.side ?? undefined,
    localAudioFileId: file.localAudioFileId,
    path: file.path,
    format: audioText(file.format, { uppercase: true }),
    codec: audioText(file.codec, { uppercase: true }),
    quality: audioText(file.quality),
    size: formatFileSize(file.sizeBytes),
    modifiedAt: file.modifiedAt ?? 'Not recorded',
    contentHash: file.contentHash ?? 'Not recorded',
    duration: formatDuration(file.durationSeconds),
    bitrate: file.bitrateKbps ? `${file.bitrateKbps} kbps` : 'Not recorded',
    sampleRate: file.sampleRateHz
      ? `${formatSampleRate(file.sampleRateHz)} kHz`
      : 'Not recorded',
    channels: formatChannelCount(file.channels),
  }
}

function toPhysicalCopyDetails(
  item: OwnedItemDto,
  mediumType: OwnedItemMediumType,
): PhysicalCopyDetailsRecord | undefined {
  switch (mediumType) {
    case 'vinyl':
      return {
        formatDescription:
          item.details.vinyl?.formatDescription || item.medium.description || 'Vinyl',
        storageLocation:
          item.details.vinyl?.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.details.vinyl?.condition),
      }
    case 'cd':
      return {
        discCount: item.details.cd?.discCount ?? item.medium.discCount ?? 1,
        storageLocation:
          item.details.cd?.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.details.cd?.condition),
      }
    case 'cassette':
      return {
        tapeType: item.details.cassette?.tapeType || 'Cassette',
        storageLocation:
          item.details.cassette?.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.details.cassette?.condition),
      }
    case 'other':
      return {
        name: item.details.other?.name || item.medium.description || 'Other',
        storageLocation:
          item.details.other?.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.details.other?.condition),
      }
    default:
      return undefined
  }
}

function digitalOwnedItemStorage(
  details: DigitalCopyDetailsRecord | undefined,
) {
  const linkedFileCount = details?.linkedFileCount ?? 0
  if (linkedFileCount > 0) {
    return `${linkedFileCount} local file${linkedFileCount === 1 ? '' : 's'} linked`
  }

  return 'Digital copy'
}

function audioText(
  value: string | null | undefined,
  options: { uppercase?: boolean } = {},
) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return 'Not recorded'
  }

  return options.uppercase
    ? trimmed.toUpperCase()
    : trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function formatFileSize(sizeBytes: number | null | undefined) {
  if (!sizeBytes || sizeBytes <= 0) {
    return 'Not recorded'
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

function formatSampleRate(sampleRateHz: number) {
  return Number.isInteger(sampleRateHz / 1000)
    ? `${sampleRateHz / 1000}`
    : (sampleRateHz / 1000).toFixed(1)
}

function formatChannelCount(channels: number | null | undefined) {
  switch (channels) {
    case 1:
      return 'Mono'
    case 2:
      return 'Stereo'
    default:
      return channels ? `${channels} channels` : 'Not recorded'
  }
}
```

- [ ] **Step 7: Run the focused mapper test and verify it passes**

Run:

```bash
cd app
npm test -- --run src/features/catalog/catalogApi.inventoryMapping.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the mapper implementation**

```bash
git add app/src/features/ownedItems/ownedItemsData.ts app/src/features/catalog/api/ownedItemEntityMappers.ts app/src/features/releases/releasesData.ts
git commit -m "feat: map owned items into type-aware records"
```

---

### Task 3: Add UI Tests For Type-Aware Detail, Tables, And Form Fields

**Files:**

- Modify: `app/src/App.workspaces-owned-relations.test.tsx`
- Modify: `app/src/App.owned-items-inventory.test.tsx`

- [ ] **Step 1: Replace the old mixed detail section test**

In `app/src/App.workspaces-owned-relations.test.tsx`, replace the test named
`shows release link, ownership, physical details and digitization metadata as separate owned item detail sections`
with:

```ts
it('renders physical owned item details with storage and condition', async () => {
  window.history.pushState({}, '', '/owned-items')
  const user = h.userEvent.setup()

  h.render(<h.App />)

  await user.click(
    h.screen.getByRole('button', { name: /blue monday vinyl/i }),
  )

  const detailPanel = h.screen.getByRole('complementary', {
    name: 'Blue Monday vinyl',
  })

  expect(
    h
      .within(detailPanel)
      .getByRole('heading', { name: 'Linked catalog item' }),
  ).toBeInTheDocument()
  expect(
    h.within(detailPanel).getByRole('heading', {
      name: 'Physical copy overview',
    }),
  ).toBeInTheDocument()
  expect(
    h.within(detailPanel).getByRole('heading', {
      name: 'Physical details',
    }),
  ).toBeInTheDocument()
  expect(h.within(detailPanel).getByText('Shelf A3')).toBeInTheDocument()
  expect(
    h.within(detailPanel).getByText('Sleeve: Good, Media: Very Good'),
  ).toBeInTheDocument()
  expect(
    h.within(detailPanel).queryByRole('heading', {
      name: 'Digital copy overview',
    }),
  ).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Add a digital detail rendering test**

Add this test after the physical detail test:

```ts
it('renders digital owned item details without physical copy warnings', async () => {
  window.history.pushState({}, '', '/owned-items')
  const user = h.userEvent.setup()

  h.render(<h.App />)

  await user.click(
    h.screen.getByRole('button', { name: /the dfa remix digital folder/i }),
  )

  const detailPanel = h.screen.getByRole('complementary', {
    name: 'The DFA Remix digital folder',
  })

  expect(
    h.within(detailPanel).getByRole('heading', {
      name: 'Digital copy overview',
    }),
  ).toBeInTheDocument()
  expect(
    h.within(detailPanel).getByRole('heading', {
      name: 'Track file coverage',
    }),
  ).toBeInTheDocument()
  expect(h.within(detailPanel).getByText('1 / 1 files linked')).toBeVisible()
  expect(
    h.within(detailPanel).getByText(
      '/archive/lcd-soundsystem/dfa-remix/08-yeah-pretentious-mix.mp3',
    ),
  ).toBeVisible()
  expect(
    h.within(detailPanel).queryByRole('heading', {
      name: 'Physical details',
    }),
  ).not.toBeInTheDocument()
  expect(
    h.within(detailPanel).queryByText('No storage recorded'),
  ).not.toBeInTheDocument()
  expect(
    h.within(detailPanel).queryByText('No condition recorded'),
  ).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Add a type-aware table summary test**

Add this test after the digital detail test:

```ts
it('shows type-aware owned item table columns and digital state summaries', () => {
  window.history.pushState({}, '', '/owned-items')

  h.render(<h.App />)

  expect(
    h.screen.getByRole('columnheader', { name: 'Location / Storage' }),
  ).toBeInTheDocument()
  expect(
    h.screen.getByRole('columnheader', {
      name: 'Condition / Digital state',
    }),
  ).toBeInTheDocument()

  const digitalRow = h.screen.getByRole('row', {
    name: /the dfa remix digital folder/i,
  })

  expect(h.within(digitalRow).getByText('Digital copy')).toBeInTheDocument()
  expect(
    h.within(digitalRow).getByText('1 / 1 files linked'),
  ).toBeInTheDocument()
  expect(
    h.within(digitalRow).queryByText('Metadata incomplete'),
  ).not.toBeInTheDocument()
})
```

- [ ] **Step 4: Add a type-aware add/edit form test**

Add this test near the existing manual owned item tests:

```ts
it('switches owned item entry fields between digital and physical copies', async () => {
  window.history.pushState({}, '', '/owned-items')
  const user = h.userEvent.setup()

  h.render(<h.App />)

  await user.click(h.screen.getByRole('button', { name: 'Add owned item' }))
  const form = h.screen.getByRole('form', { name: 'Add owned item' })

  await user.selectOptions(h.within(form).getByLabelText('Medium'), 'Digital')

  expect(
    h.within(form).queryByLabelText('Storage location'),
  ).not.toBeInTheDocument()
  expect(h.within(form).queryByLabelText('Condition')).not.toBeInTheDocument()
  expect(h.within(form).getByLabelText('Digital copy note')).toBeVisible()

  await user.selectOptions(
    h.within(form).getByLabelText('Medium'),
    '12-inch vinyl',
  )

  expect(h.within(form).getByLabelText('Storage location')).toBeVisible()
  expect(h.within(form).getByLabelText('Condition')).toBeVisible()
  expect(h.within(form).getByLabelText('Digitization note')).toBeVisible()
})
```

- [ ] **Step 5: Add an API-loaded digital detail test**

In `app/src/App.owned-items-inventory.test.tsx`, add this test after
`loads owned items into the editable workspace by default`:

```ts
it('renders API-loaded digital owned item coverage without physical warnings', async () => {
  window.history.pushState({}, '', '/owned-items')
  h.clearCatalogForTests()
  const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    await Promise.resolve()

    if (url.startsWith('/api/releases?')) {
      return h.jsonResponse({
        items: [
          {
            id: 'release-movement',
            title: 'Movement',
            type: 'album',
            year: 1981,
            releaseDate: null,
            genres: [],
            tags: [],
            artistCredits: [],
            labels: [],
            tracklist: [
              {
                releaseTrackId: 'release-track-ceremony',
                trackId: 'track-ceremony',
                title: 'Ceremony',
                position: 1,
                disc: null,
                side: null,
                durationSeconds: 263,
              },
            ],
          },
        ],
        limit: 100,
        offset: 0,
        total: 1,
      })
    }
    if (url.startsWith('/api/tracks?')) {
      return h.jsonResponse({
        items: [
          {
            id: 'track-ceremony',
            title: 'Ceremony',
            durationSeconds: 263,
            genres: [],
            tags: [],
            externalSources: [],
            releaseAppearances: [
              {
                releaseId: 'release-movement',
                releaseTitle: 'Movement',
                releaseArtist: 'New Order',
                year: 1981,
                label: 'Factory',
                position: 1,
                disc: null,
                side: null,
                durationSeconds: 263,
              },
            ],
            digitalFiles: [],
          },
        ],
        limit: 100,
        offset: 0,
        total: 1,
      })
    }
    if (url.startsWith('/api/owned-items?')) {
      return h.jsonResponse({
        items: [
          {
            id: 'owned-movement-digital',
            releaseId: 'release-movement',
            release: {
              id: 'release-movement',
              title: 'Movement',
            },
            status: 'owned',
            medium: {
              type: 'digital',
              description: 'Digital',
              discCount: null,
            },
            details: {
              digital: {
                releaseTrackCount: 1,
                linkedFileCount: 1,
                missingFileCount: 0,
                files: [
                  {
                    digitalTrackFileLinkId: 'link-ceremony-file',
                    releaseTrackId: 'release-track-ceremony',
                    trackId: 'track-ceremony',
                    trackTitle: 'Ceremony',
                    position: 1,
                    localAudioFileId: 'local-ceremony-file',
                    path: '/music/new-order/movement/01-ceremony.flac',
                    format: 'flac',
                    codec: 'flac',
                    quality: 'lossless',
                  },
                ],
              },
            },
            inventorySignals: ['owned'],
          },
        ],
        limit: 100,
        offset: 0,
        total: 1,
      })
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

  h.render(<h.App />)

  const detailPanel = await h.screen.findByRole('complementary', {
    name: 'Movement',
  })

  expect(
    h.within(detailPanel).getByRole('heading', {
      name: 'Digital copy overview',
    }),
  ).toBeInTheDocument()
  expect(
    h.within(detailPanel).getByText(
      '/music/new-order/movement/01-ceremony.flac',
    ),
  ).toBeVisible()
  expect(
    h.within(detailPanel).queryByRole('heading', {
      name: 'Physical details',
    }),
  ).not.toBeInTheDocument()
  expect(
    h.within(detailPanel).queryByText('No storage recorded'),
  ).not.toBeInTheDocument()
  expect(
    h.within(detailPanel).queryByText('No condition recorded'),
  ).not.toBeInTheDocument()
})
```

- [ ] **Step 6: Run the focused UI tests and verify they fail**

Run:

```bash
cd app
npm test -- --run src/App.workspaces-owned-relations.test.tsx src/App.owned-items-inventory.test.tsx
```

Expected: FAIL because the UI still renders shared physical/digital sections, table headers still say `Storage` and `Condition`, and the form still always shows storage and condition inputs.

- [ ] **Step 7: Commit the failing UI tests**

```bash
git add app/src/App.workspaces-owned-relations.test.tsx app/src/App.owned-items-inventory.test.tsx
git commit -m "test: cover type-aware owned item UI"
```

---

### Task 4: Implement Type-Aware Owned Item Detail Panel

**Files:**

- Modify: `app/src/features/ownedItems/OwnedItemDetail.tsx`
- Test: `app/src/App.workspaces-owned-relations.test.tsx`
- Test: `app/src/App.owned-items-inventory.test.tsx`

- [ ] **Step 1: Import the type-aware helpers**

In `app/src/features/ownedItems/OwnedItemDetail.tsx`, replace the current owned item data import with:

```ts
import {
  digitalCoverageSummary,
  formatCollectorSignal,
  isDigitalOwnedItem,
  type DigitalFileCoverageRecord,
  type OwnedItemRecord,
} from './ownedItemsData'
```

- [ ] **Step 2: Compute digital and missing coverage rows**

Inside `OwnedItemDetail`, after `const relatedTracks = ...`, add:

```ts
  const isDigitalCopy = isDigitalOwnedItem(item)
  const linkedDigitalTrackIds = new Set(
    item.digitalDetails?.files.map((file) => file.trackId) ?? [],
  )
  const missingDigitalTracks = isDigitalCopy
    ? relatedTracks.filter((track) => !linkedDigitalTrackIds.has(track.id))
    : []
```

- [ ] **Step 3: Replace the shared physical and digital sections with conditional rendering**

In `OwnedItemDetail`, remove the current `Physical details` section and the
current `Digital and digitization metadata` section. Replace them with:

```tsx
      {isDigitalCopy ? (
        <DigitalCopyDetails
          item={item}
          missingTracks={missingDigitalTracks}
        />
      ) : (
        <PhysicalCopyDetails item={item} />
      )}
```

- [ ] **Step 4: Add the digital detail components**

Add these components above `type StatusBadgeProps`:

```tsx
function DigitalCopyDetails({
  item,
  missingTracks,
}: {
  item: OwnedItemRecord
  missingTracks: TrackRecord[]
}) {
  const details = item.digitalDetails
  const files = details?.files ?? []

  return (
    <>
      <section
        className="detail-section"
        aria-labelledby="owned-digital-overview-title"
      >
        <h3 id="owned-digital-overview-title">Digital copy overview</h3>
        <dl className="detail-list">
          <div>
            <dt>Medium</dt>
            <dd>{item.medium}</dd>
          </div>
          <div>
            <dt>File coverage</dt>
            <dd>{digitalCoverageSummary(details)}</dd>
          </div>
          <div>
            <dt>File formats</dt>
            <dd>{item.fileFormat}</dd>
          </div>
          <div>
            <dt>Digital state</dt>
            <dd>{item.digitalState}</dd>
          </div>
        </dl>
      </section>

      <section
        className="detail-section"
        aria-labelledby="owned-track-coverage-title"
      >
        <h3 id="owned-track-coverage-title">Track file coverage</h3>
        {files.length > 0 || missingTracks.length > 0 ? (
          <div className="relation-list">
            {files.map((file) => (
              <DigitalFileCoverageRow key={file.digitalTrackFileLinkId} file={file} />
            ))}
            {missingTracks.map((track) => (
              <article key={track.id}>
                <span className="badge badge-tag">Missing file</span>
                <a
                  className="detail-link"
                  href={`/tracks?track=${encodeURIComponent(track.id)}`}
                >
                  {track.title}
                </a>
                <p>
                  {track.trackNumber} · No local file linked to this digital copy.
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p>No local files linked to this digital copy yet.</p>
        )}
        {details && details.missingFileCount > missingTracks.length ? (
          <p>
            {details.missingFileCount} release track
            {details.missingFileCount === 1 ? '' : 's'} missing local files.
          </p>
        ) : null}
      </section>
    </>
  )
}

function DigitalFileCoverageRow({
  file,
}: {
  file: DigitalFileCoverageRecord
}) {
  const positionParts = [file.disc, file.side, file.position].filter(Boolean)

  return (
    <article>
      <span className="badge badge-tag">Linked file</span>
      <a
        className="detail-link"
        href={`/tracks?track=${encodeURIComponent(file.trackId)}`}
      >
        {file.trackTitle}
      </a>
      <p>
        {positionParts.join(' · ') || 'Unnumbered'} · {file.format} ·{' '}
        {file.codec} · {file.quality}
      </p>
      <p>{file.path}</p>
      <p>
        {file.duration} · {file.bitrate} · {file.sampleRate} · {file.channels}
      </p>
    </article>
  )
}
```

- [ ] **Step 5: Add the physical detail component**

Add this component below `DigitalFileCoverageRow`:

```tsx
function PhysicalCopyDetails({ item }: { item: OwnedItemRecord }) {
  const details = item.physicalDetails

  return (
    <>
      <section
        className="detail-section"
        aria-labelledby="owned-physical-overview-title"
      >
        <h3 id="owned-physical-overview-title">Physical copy overview</h3>
        <dl className="detail-list">
          <div>
            <dt>Medium</dt>
            <dd>{item.medium}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </div>
          <div>
            <dt>Digitization state</dt>
            <dd>{item.digitizationState}</dd>
          </div>
        </dl>
      </section>

      <section
        className="detail-section"
        aria-labelledby="owned-physical-title"
      >
        <h3 id="owned-physical-title">Physical details</h3>
        <dl className="detail-list">
          <div>
            <dt>Storage</dt>
            <dd>{details?.storageLocation ?? item.storage}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{details?.condition ?? item.condition}</dd>
          </div>
          {details?.formatDescription ? (
            <div>
              <dt>Format</dt>
              <dd>{details.formatDescription}</dd>
            </div>
          ) : null}
          {details?.discCount ? (
            <div>
              <dt>Disc count</dt>
              <dd>{details.discCount}</dd>
            </div>
          ) : null}
          {details?.tapeType ? (
            <div>
              <dt>Tape type</dt>
              <dd>{details.tapeType}</dd>
            </div>
          ) : null}
          {details?.name ? (
            <div>
              <dt>Description</dt>
              <dd>{details.name}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </>
  )
}
```

- [ ] **Step 6: Update the stale selected-item test assertion**

In `App.workspaces-owned-relations.test.tsx`, in
`updates owned item detail when an owned item row is selected`, replace the
assertion that searches inside `Digital and digitization metadata` with:

```ts
    expect(
      h
        .within(h.detailSection(detailPanel, 'Physical copy overview'))
        .getByText('Needs digitization'),
    ).toBeInTheDocument()
```

- [ ] **Step 7: Run focused detail tests and verify they pass**

Run:

```bash
cd app
npm test -- --run src/App.workspaces-owned-relations.test.tsx src/App.owned-items-inventory.test.tsx
```

Expected: the detail-panel assertions for digital and physical sections PASS. Table/form assertions may still fail until Task 5.

- [ ] **Step 8: Commit the detail panel implementation**

```bash
git add app/src/features/ownedItems/OwnedItemDetail.tsx app/src/App.workspaces-owned-relations.test.tsx
git commit -m "feat: render type-aware owned item details"
```

---

### Task 5: Implement Type-Aware Tables, Filters, Form Fields, And Digital Payloads

**Files:**

- Modify: `app/src/features/ownedItems/OwnedItemsWorkspace.tsx`
- Modify: `app/src/features/ownedItems/ServerOwnedItemsWorkspace.tsx`
- Modify: `app/src/features/catalog/api/ownedRelationsClient.ts`
- Modify: `app/src/features/catalog/catalogApi.mutations.test.ts`
- Test: `app/src/App.workspaces-owned-relations.test.tsx`

- [ ] **Step 1: Add payload tests for digital owned items**

In `app/src/features/catalog/catalogApi.mutations.test.ts`, update the digital create test expectation from:

```ts
      condition: null,
      storageLocation: 'Digital library',
```

to:

```ts
      condition: null,
      storageLocation: null,
```

Then add this test after the existing update test:

```ts
  it('updates digital owned items without physical condition or storage payload fields', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'owned-item-id' }))
    vi.stubGlobal('fetch', fetchMock)

    await api.updateOwnedItem({
      id: 'owned-item-id',
      title: 'Digital copy reference',
      targetType: 'Release',
      targetId: '00000000-0000-7000-8000-000000000010',
      releaseId: '00000000-0000-7000-8000-000000000010',
      releaseTitle: 'Blue Monday',
      artist: 'New Order',
      medium: 'Digital',
      mediumType: 'digital',
      status: 'Owned',
      statusTone: 'green',
      storage: 'Digital copy',
      condition: '1 / 1 files linked',
      acquisition: 'Manual entry',
      copyNotes: '',
      linkedType: 'Release',
      fileFormat: 'FLAC',
      digitalState: '1 / 1 files linked',
      digitizationState: 'Digital source only',
      tags: [],
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/owned-items/owned-item-id')
    expect(
      h.requestPayload<h.OwnedItemRequestPayload>(fetchMock.mock.calls[0][1]),
    ).toMatchObject({
      releaseId: '00000000-0000-7000-8000-000000000010',
      status: 'owned',
      medium: { type: 'digital' },
      condition: null,
      storageLocation: null,
    })
  })
```

- [ ] **Step 2: Run the payload test and verify it fails**

Run:

```bash
cd app
npm test -- --run src/features/catalog/catalogApi.mutations.test.ts
```

Expected: FAIL because `ownedItemRequestPayload` still sends `storageLocation: item.storage` for digital items.

- [ ] **Step 3: Import type-aware helpers in the local workspace**

In `app/src/features/ownedItems/OwnedItemsWorkspace.tsx`, update the owned item import to:

```ts
import {
  digitalCoverageSummary,
  isDigitalMediumLabel,
  isDigitalOwnedItem,
  ownedItemLocationSummary,
  ownedItemStateSummary,
  type OwnedItemRecord,
  type OwnedItemStatus,
} from './ownedItemsData'
```

- [ ] **Step 4: Update local filter state and filtering**

In `OwnedItemsWorkspace`, rename the filter state keys:

```ts
  const [filters, setFilters] = useState({
    status: '',
    medium: '',
    state: '',
    location: '',
  })
```

Update `visibleItems` filtering:

```ts
        terms.every((term) => ownedItemSearchText(item).includes(term)) &&
        (!filters.status || item.status === filters.status) &&
        (!filters.medium || item.medium === filters.medium) &&
        (!filters.state || ownedItemStateSummary(item) === filters.state) &&
        (!filters.location ||
          ownedItemLocationSummary(item) === filters.location),
```

Update the search placeholder:

```tsx
          placeholder="Release, artist, medium, status, location, storage, condition, format or digital state"
```

Replace the old `Condition` and `Storage location` filters with:

```tsx
          <FilterSelect
            label="Condition / digital state"
            value={filters.state}
            values={uniqueValues(items.map(ownedItemStateSummary))}
            onChange={(state) =>
              setFilters((current) => ({ ...current, state }))
            }
          />
          <FilterSelect
            label="Location / storage"
            value={filters.location}
            values={uniqueValues(items.map(ownedItemLocationSummary))}
            onChange={(location) =>
              setFilters((current) => ({ ...current, location }))
            }
          />
```

- [ ] **Step 5: Update local table headers and cells**

In `OwnedItemsTable`, replace the table headers:

```tsx
              <th scope="col">Location / Storage</th>
              <th scope="col">Condition / Digital state</th>
```

Remove the separate `Digital state` header and cell.

Replace the old storage and condition cells with:

```tsx
                <td data-label="Location / Storage">
                  {ownedItemLocationSummary(item)}
                </td>
                <td data-label="Condition / Digital state">
                  {ownedItemStateSummary(item)}
                </td>
```

- [ ] **Step 6: Make the add/edit form type-aware**

Inside `OwnedItemEntryForm`, after `const [digitizationNote, setDigitizationNote] = ...`, add:

```ts
  const isDigitalMedium = isDigitalMediumLabel(medium)
  const noteLabel = isDigitalMedium ? 'Digital copy note' : 'Digitization note'
```

In `handleSubmit`, replace the `storage`, `condition`, `fileFormat`,
`digitalState`, and `digitizationState` fields with:

```ts
      medium: textOrFallback(medium, 'Unspecified medium'),
      mediumType: isDigitalMedium ? 'digital' : undefined,
      status: itemStatus,
      statusTone: statusToneFor(itemStatus),
      storage: isDigitalMedium
        ? 'Digital copy'
        : textOrFallback(storage, 'No storage recorded'),
      condition: isDigitalMedium
        ? 'Digital copy recorded'
        : textOrFallback(condition, 'No condition recorded'),
      acquisition: 'Manual entry',
      copyNotes: note,
      linkedType: 'Release',
      fileFormat: isDigitalMedium ? 'None recorded' : 'None recorded',
      digitalState: isDigitalMedium
        ? 'Digital copy recorded'
        : 'No digital file recorded',
      digitizationState: isDigitalMedium ? 'Digital source only' : note,
```

Keep the existing fields before and after this block unchanged.

Replace the always-visible storage and condition labels with conditional
physical fields:

```tsx
      {!isDigitalMedium ? (
        <>
          <label>
            <span>Storage location</span>
            <input
              value={storage}
              onChange={(event) => setStorage(event.target.value)}
            />
          </label>
          <label>
            <span>Condition</span>
            <input
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
            />
          </label>
        </>
      ) : null}
```

Change the textarea label:

```tsx
        <span>{noteLabel}</span>
```

- [ ] **Step 7: Update search text to include type-aware summaries**

In `ownedItemSearchText`, add these two entries after `item.status`:

```ts
    ownedItemLocationSummary(item),
    ownedItemStateSummary(item),
```

- [ ] **Step 8: Update the server-backed workspace copy and table summaries**

In `app/src/features/ownedItems/ServerOwnedItemsWorkspace.tsx`, update the import from `ownedItemsData`:

```ts
  ownedItemLocationSummary,
  ownedItemStateSummary,
```

Change filter labels:

```tsx
        <CodeFilterSelect
          label="Physical condition"
          value={filters.condition}
          options={conditionOptions}
          onChange={(value) => onFilterChange('condition', value)}
        />
        <label className="filter-control">
          <span>Physical storage</span>
```

Change table headers:

```tsx
              <th scope="col">Location / Storage</th>
              <th scope="col">Condition / Digital state</th>
```

Replace table cells:

```tsx
                <td data-label="Location / Storage">
                  {ownedItemLocationSummary(item)}
                </td>
                <td data-label="Condition / Digital state">
                  {ownedItemStateSummary(item)}
                </td>
```

- [ ] **Step 9: Prevent digital create/update payloads from sending physical fields**

In `app/src/features/catalog/api/ownedRelationsClient.ts`, update imports:

```ts
import {
  isDigitalOwnedItem,
  type OwnedItemRecord,
} from '../../ownedItems/ownedItemsData'
```

Replace `ownedItemRequestPayload` with:

```ts
function ownedItemRequestPayload(item: OwnedItemRecord) {
  const releaseId = ownedItemReleaseId(item)
  const medium = toMediumRequest(item.medium)
  const isDigital = medium.type === 'digital' || isDigitalOwnedItem(item)

  return {
    releaseId,
    status: toOwnershipStatusCode(item.status),
    medium,
    condition: isDigital ? null : toConditionCode(item.condition),
    storageLocation: isDigital ? null : textOrNull(item.storage),
  }
}

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''

  return trimmed.length > 0 ? trimmed : null
}
```

- [ ] **Step 10: Run focused UI and payload tests**

Run:

```bash
cd app
npm test -- --run src/App.workspaces-owned-relations.test.tsx src/App.owned-items-inventory.test.tsx src/features/catalog/catalogApi.mutations.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit table, form, and payload implementation**

```bash
git add app/src/features/ownedItems/OwnedItemsWorkspace.tsx app/src/features/ownedItems/ServerOwnedItemsWorkspace.tsx app/src/features/catalog/api/ownedRelationsClient.ts app/src/features/catalog/catalogApi.mutations.test.ts
git commit -m "feat: make owned item tables and forms type-aware"
```

---

### Task 6: Final Verification And Cleanup

**Files:**

- Verify: `app/src/features/ownedItems/OwnedItemDetail.tsx`
- Verify: `app/src/features/ownedItems/OwnedItemsWorkspace.tsx`
- Verify: `app/src/features/ownedItems/ServerOwnedItemsWorkspace.tsx`
- Verify: `app/src/features/catalog/api/ownedItemEntityMappers.ts`
- Verify: `app/src/features/catalog/api/ownedRelationsClient.ts`
- Verify: `app/src/App.workspaces-owned-relations.test.tsx`
- Verify: `app/src/App.owned-items-inventory.test.tsx`
- Verify: `app/src/features/catalog/catalogApi.inventoryMapping.test.ts`
- Verify: `app/src/features/catalog/catalogApi.mutations.test.ts`

- [ ] **Step 1: Search for stale physical-first copy in Owned Items UI**

Run:

```bash
rg -n "Digital and digitization metadata|No storage recorded|No condition recorded|Storage location|Condition|Physical details" app/src/features/ownedItems app/src/App.workspaces-owned-relations.test.tsx app/src/App.owned-items-inventory.test.tsx
```

Expected:

- no `Digital and digitization metadata`;
- `Physical details` appears only in physical detail rendering and physical assertions;
- `No storage recorded` and `No condition recorded` appear only in physical fallback code or assertions that ensure digital detail does not render them;
- `Storage location` and `Condition` remain only physical form/detail labels.

- [ ] **Step 2: Run the full frontend test suite**

Run:

```bash
cd app
npm test
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript and lint checks**

Run:

```bash
cd app
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Build the frontend**

Run:

```bash
cd app
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit final cleanup if verification required edits**

If Step 1 through Step 4 required any cleanup edits, commit them:

```bash
git add app/src
git commit -m "chore: verify owned item type-aware UI"
```

If no cleanup edits were needed, do not create an empty commit.

- [ ] **Step 6: Record final status**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: clean working tree and recent commits for mapper tests, mapper implementation, UI tests, UI implementation, plus optional cleanup.
