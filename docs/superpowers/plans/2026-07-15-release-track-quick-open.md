# Release Track Quick Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact quick-open action to each eligible Track card in the selected Release panel so a collector can open that Release-linked local audio file in the operating system's default player without navigating to the Track detail.

**Architecture:** Keep file discovery and opening in the existing local-file feature. `ReleaseDetailTracksSection` decides whether a card has a Release-scoped openable file and renders only the visual action. `ReleasesWorkspace` orchestrates direct opening, multi-file panel display, pending state, and failure handoff. `ReleaseDetail` only forwards the typed callback and pending Track identifier. The Electron bridge and `LocalFileOpenPanel` remain the single trusted opening and error/retry paths.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 3, Testing Library, vanilla CSS, Lucide React, Electron 42.

## Global Constraints

- Keep every repository artifact, test name, accessible label, tooltip, and UI string in English.
- Open files through the existing `openLocalFile` model and Electron bridge; do not introduce browser file opening or a new IPC route.
- Use an `ExternalLink` glyph, not a Play triangle, because this action hands the file to the system default player and does not control playback.
- Scope every Track-card action to files whose `digitalFile.releaseId` equals the selected Release ID. Never fall back to another Release appearance of the same Track.
- Hide the action when the Track has no valid Release-scoped file, when its file identity/path is incomplete, or when the desktop bridge is unavailable.
- For exactly one file, open immediately. For more than one file, show `LocalFileOpenPanel` titled `Local files — <track title>`. On a direct-open failure, open the same panel with the failed result pre-populated so the existing message and retry action are preserved.
- Preserve the existing Release-level `Open local files` action and all existing Track navigation/rating behavior.
- Use a compact 28 × 28 px top-right action, a visible keyboard focus ring, a tooltip of `Open in default player`, and a dynamic accessible name of `Open <track title> in default player`.
- Disable the action and show a spinner while its direct-open promise is pending. Do not navigate or alter the selected Release when the action is used.
- Follow test-driven development: add a failing test, confirm the intended failure, implement the minimum behavior, rerun the focused test, then run the broader regression gates.

---

### Task 1: Render the Release-scoped quick-open control

**Files:**

- Create: `app/src/features/releases/ReleaseDetailTracksSection.test.tsx`
- Modify: `app/src/features/releases/ReleaseDetailTracksSection.tsx`
- Modify: `app/src/features/releases/release-detail.css`

**Interface produced by this task:**

```ts
export type OpenReleaseTrackLocalFiles = (
  track: TrackRecord,
  release: ReleaseRecord,
) => Promise<void> | void;
```

`ReleaseDetailTracksSection` receives this callback plus `openingTrackId?: string`. It remains unaware of Electron and never calls `openLocalFile` itself.

- [ ] **Step 1: Add focused failing component tests**

Create `app/src/features/releases/ReleaseDetailTracksSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { trackRecords } from "../tracks/tracksData";
import { releaseRecords } from "./releasesData";
import { ReleaseDetailTracksSection } from "./ReleaseDetailTracksSection";

const release = releaseRecords[0];
const track = trackRecords[0];

describe("ReleaseDetailTracksSection quick open", () => {
  it("keeps Track navigation and invokes the quick-open callback", async () => {
    const user = userEvent.setup();
    const onOpenTrackLocalFiles = vi.fn();

    render(
      <ReleaseDetailTracksSection
        onOpenTrackLocalFiles={onOpenTrackLocalFiles}
        ratingCriteria={[]}
        release={release}
        tracks={[track]}
      />,
    );

    expect(screen.getByRole("link", { name: "Polynomial-C" })).toHaveAttribute(
      "href",
      "/tracks?track=polynomial-c",
    );

    const button = screen.getByRole("button", {
      name: "Open Polynomial-C in default player",
    });
    expect(button).toHaveAttribute("title", "Open in default player");

    await user.click(button);

    expect(onOpenTrackLocalFiles).toHaveBeenCalledWith(track, release);
  });

  it("hides the action when no file belongs to the selected Release", () => {
    const otherReleaseTrack = {
      ...track,
      digitalFiles: track.digitalFiles.map((file) => ({
        ...file,
        releaseId: "selected-ambient-works-reissue",
      })),
    };

    render(
      <ReleaseDetailTracksSection
        onOpenTrackLocalFiles={vi.fn()}
        ratingCriteria={[]}
        release={release}
        tracks={[otherReleaseTrack]}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Open Polynomial-C in default player",
      }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["a blank path", { path: " " }],
    ["a blank local audio file ID", { localAudioFileId: " " }],
  ])("hides the action for %s", (_caseName, digitalFileOverrides) => {
    const invalidFileTrack = {
      ...track,
      digitalFiles: track.digitalFiles.map((file) => ({
        ...file,
        ...digitalFileOverrides,
      })),
    };

    render(
      <ReleaseDetailTracksSection
        onOpenTrackLocalFiles={vi.fn()}
        ratingCriteria={[]}
        release={release}
        tracks={[invalidFileTrack]}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Open Polynomial-C in default player",
      }),
    ).not.toBeInTheDocument();
  });

  it("hides the action without a callback and exposes pending state", () => {
    const { rerender } = render(
      <ReleaseDetailTracksSection
        ratingCriteria={[]}
        release={release}
        tracks={[track]}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Open Polynomial-C in default player",
      }),
    ).not.toBeInTheDocument();

    rerender(
      <ReleaseDetailTracksSection
        openingTrackId={track.id}
        onOpenTrackLocalFiles={vi.fn()}
        ratingCriteria={[]}
        release={release}
        tracks={[track]}
      />,
    );

    const pendingButton = screen.getByRole("button", {
      name: "Open Polynomial-C in default player",
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
  });
});
```

- [ ] **Step 2: Run the new test and confirm the intended failure**

Run:

```bash
npm --prefix app test -- ReleaseDetailTracksSection.test.tsx
```

Expected: FAIL with TypeScript/rendering errors showing that `onOpenTrackLocalFiles` and `openingTrackId` do not exist and the accessible quick-open button cannot be found. Do not change production code until this failure is observed.

- [ ] **Step 3: Add the typed callback and Release-scoped availability check**

In `app/src/features/releases/ReleaseDetailTracksSection.tsx`, add these imports:

```tsx
import { ExternalLink, LoaderCircle } from "lucide-react";
import { openableFilesFromReleaseTracks } from "../localFiles/localFileOpenModel";
```

Add the shared callback type and extend the section props:

```tsx
export type OpenReleaseTrackLocalFiles = (
  track: TrackRecord,
  release: ReleaseRecord,
) => Promise<void> | void;

type ReleaseDetailTracksSectionProps = Readonly<{
  openingTrackId?: string;
  onOpenTrackLocalFiles?: OpenReleaseTrackLocalFiles;
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
  ) => void;
  ratingCriteria: RatingCriterion[];
  release: ReleaseRecord;
  tracks: TrackRecord[];
}>;
```

Destructure the two new props. Change the `tracks.map` body so availability is derived with the existing Release-scoped selector and passed to the card:

```tsx
{
  tracks.map((track) => {
    const canOpenLocalFile = Boolean(
      onOpenTrackLocalFiles &&
      openableFilesFromReleaseTracks([track], release.id).length > 0,
    );

    return (
      <ReleaseDetailTrackCard
        canOpenLocalFile={canOpenLocalFile}
        isOpening={openingTrackId === track.id}
        key={track.id}
        onOpenTrackLocalFiles={onOpenTrackLocalFiles}
        onRateTarget={onRateTarget}
        ratingCriteria={trackRatingCriteria}
        release={release}
        track={track}
      />
    );
  });
}
```

Extend `ReleaseDetailTrackCard` with these exact prop types:

```tsx
canOpenLocalFile: boolean
isOpening: boolean
onOpenTrackLocalFiles?: OpenReleaseTrackLocalFiles
```

Destructure them and replace the opening of the card body with:

```tsx
<article className="release-track-card">
  <div
    className={`release-track-card-main${
      canOpenLocalFile ? ' has-open-action' : ''
    }`}
  >
    <a className="detail-link" href={trackHref(track.id)}>
      {track.title}
    </a>
    <p>
      {positionLabel} · {track.artist} · {track.duration}
    </p>
    {canOpenLocalFile ? (
      <button
        aria-busy={isOpening || undefined}
        aria-label={`Open ${track.title} in default player`}
        className="release-track-open-button"
        disabled={isOpening}
        title="Open in default player"
        type="button"
        onClick={() => {
          void onOpenTrackLocalFiles?.(track, release)
        }}
      >
        {isOpening ? (
          <LoaderCircle
            aria-hidden="true"
            className="release-track-open-spinner"
            size={14}
          />
        ) : (
          <ExternalLink aria-hidden="true" size={14} />
        )}
      </button>
    ) : null}
  </div>
```

Leave the rating block and closing tags unchanged. The action is a sibling of the title and metadata inside the card's positioned main area, so clicking it cannot trigger the Track anchor.

- [ ] **Step 4: Add the compact visual treatment and interaction states**

Update `app/src/features/releases/release-detail.css` around the existing `.release-track-card` styles:

```css
.release-track-card {
  gap: 8px;
}

.release-track-card-main {
  position: relative;
  display: grid;
  gap: 4px;
  min-width: 0;
}

.release-track-card-main.has-open-action .detail-link {
  padding-inline-end: 36px;
}

.release-track-open-button {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  display: inline-grid;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-muted);
  cursor: pointer;
  place-items: center;
}

.release-track-open-button:hover:not(:disabled) {
  border-color: #7f9480;
  color: var(--color-heading);
}

.release-track-open-button:focus-visible {
  border-color: #7f9480;
  outline: 3px solid rgba(81, 111, 82, 0.18);
  outline-offset: 1px;
}

.release-track-open-button:disabled {
  cursor: wait;
  opacity: 0.64;
}

.release-track-open-spinner {
  animation: release-track-open-spin 0.8s linear infinite;
}

@keyframes release-track-open-spin {
  to {
    transform: rotate(360deg);
  }
}
```

This reserves title space only when the action exists, keeps the card dimensions stable during pending state, and reuses the current green-gray visual language.

- [ ] **Step 5: Run the focused test and formatting check**

Run:

```bash
npm --prefix app test -- ReleaseDetailTracksSection.test.tsx
npm --prefix app run format:check
```

Expected: all focused cases PASS and Prettier reports all app files use the expected style. If formatting fails, run the repository formatter only on the three files changed in this task, then rerun both commands.

- [ ] **Step 6: Commit the visual component slice**

```bash
git add app/src/features/releases/ReleaseDetailTracksSection.tsx app/src/features/releases/ReleaseDetailTracksSection.test.tsx app/src/features/releases/release-detail.css
git commit -m "Add release track quick-open control"
```

Expected: one commit containing the typed UI contract, scoped visibility rule, pending presentation, and focused tests; no workspace orchestration yet.

---

### Task 2: Orchestrate direct open, chooser, pending state, and failure recovery

**Files:**

- Create: `app/src/App.release-track-quick-open.test.tsx`
- Modify: `app/src/features/releases/ReleaseDetail.tsx`
- Modify: `app/src/features/releases/ReleasesWorkspace.tsx`

**Interfaces consumed by this task:**

- `OpenReleaseTrackLocalFiles` from `ReleaseDetailTracksSection.tsx`
- `openableFilesFromReleaseTracks`, `openLocalFile`, `LocalOpenableFile`, and `LocalFileOpenResult` from `localFileOpenModel.ts`
- `initialResults` on the existing `LocalFileOpenPanel`

- [ ] **Step 1: Add failing application-level behavior tests**

Create `app/src/App.release-track-quick-open.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import * as h from "./test/appTestHarness";

h.setupAppTestHooks();

const releaseUrl = "/releases?release=selected-ambient-works-85-92";
const filePath =
  "/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac";

describe("App release Track quick open", () => {
  it("opens one Release-scoped file directly without navigating", async () => {
    window.history.pushState({}, "", releaseUrl);
    const user = h.userEvent.setup();
    let resolveOpen: ((result: { ok: true; path: string }) => void) | undefined;
    const open = h.vi.fn(
      () =>
        new Promise<{ ok: true; path: string }>((resolve) => {
          resolveOpen = resolve;
        }),
    );
    window.discweaveDesktop = desktopBridge(open);

    h.render(<h.App />);

    const detailPanel = h.screen.getByRole("complementary", {
      name: "Selected Ambient Works 85-92",
    });
    const button = h.within(detailPanel).getByRole("button", {
      name: "Open Polynomial-C in default player",
    });

    await user.click(button);

    await user.click(button);

    expect(open).toHaveBeenCalledWith({
      digitalTrackFileLinkId: "link-polynomial-c-file",
      localAudioFileId: "local-polynomial-c-file",
      path: filePath,
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(window.location.pathname).toBe("/releases");
    expect(window.location.search).toBe(
      "?release=selected-ambient-works-85-92",
    );

    const completeOpen = resolveOpen;
    if (!completeOpen) {
      throw new Error("The quick-open promise was not created");
    }
    await h.act(async () => {
      completeOpen({ ok: true, path: filePath });
    });

    expect(button).toBeEnabled();
    expect(
      h.screen.queryByRole("region", {
        name: "Local files — Polynomial-C",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows a scoped chooser when the selected Release has multiple files", async () => {
    window.history.pushState({}, "", releaseUrl);
    const user = h.userEvent.setup();
    const open = h.vi.fn();
    window.discweaveDesktop = desktopBridge(open);
    const secondPath =
      "/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.aiff";

    seedPolynomialFiles([
      h.trackRecords[0].digitalFiles[0],
      {
        ...h.trackRecords[0].digitalFiles[0],
        digitalTrackFileLinkId: "link-polynomial-c-aiff",
        localAudioFileId: "local-polynomial-c-aiff",
        path: secondPath,
        format: "AIFF",
      },
    ]);

    h.render(<h.App />);

    const detailPanel = h.screen.getByRole("complementary", {
      name: "Selected Ambient Works 85-92",
    });
    await user.click(
      h.within(detailPanel).getByRole("button", {
        name: "Open Polynomial-C in default player",
      }),
    );

    expect(open).not.toHaveBeenCalled();
    const panel = h.screen.getByRole("region", {
      name: "Local files — Polynomial-C",
    });
    expect(h.within(panel).getByText(filePath)).toBeVisible();
    expect(h.within(panel).getByText(secondPath)).toBeVisible();
  });

  it("does not use a file from another Release appearance", () => {
    window.history.pushState({}, "", releaseUrl);
    window.discweaveDesktop = desktopBridge(h.vi.fn());
    seedPolynomialFiles(
      h.trackRecords[0].digitalFiles.map((file) => ({
        ...file,
        releaseId: "selected-ambient-works-reissue",
        releaseTitle: "Selected Ambient Works 85-92 Reissue",
      })),
    );

    h.render(<h.App />);

    const detailPanel = h.screen.getByRole("complementary", {
      name: "Selected Ambient Works 85-92",
    });
    expect(
      h.within(detailPanel).queryByRole("button", {
        name: "Open Polynomial-C in default player",
      }),
    ).not.toBeInTheDocument();
    expect(
      h.within(detailPanel).getByRole("link", { name: "Polynomial-C" }),
    ).toHaveAttribute("href", "/tracks?track=polynomial-c");
  });

  it("hands a direct-open failure to the existing retry panel", async () => {
    window.history.pushState({}, "", releaseUrl);
    const user = h.userEvent.setup();
    const open = h.vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        path: filePath,
        reason: "missing",
        message: "The local file does not exist.",
      })
      .mockResolvedValueOnce({ ok: true, path: filePath });
    window.discweaveDesktop = desktopBridge(open);

    h.render(<h.App />);

    const detailPanel = h.screen.getByRole("complementary", {
      name: "Selected Ambient Works 85-92",
    });
    await user.click(
      h.within(detailPanel).getByRole("button", {
        name: "Open Polynomial-C in default player",
      }),
    );

    const panel = await h.screen.findByRole("region", {
      name: "Local files — Polynomial-C",
    });
    expect(h.within(panel).getByRole("alert")).toHaveTextContent(
      "The local file does not exist.",
    );

    await user.click(
      h.within(panel).getByRole("button", {
        name: "Open local file Polynomial-C Selected Ambient Works 85-92 Track 3",
      }),
    );

    expect(open).toHaveBeenCalledTimes(2);
    expect(await h.within(panel).findByText("Opened")).toBeVisible();
  });

  it("hides the action when the desktop bridge is unavailable", () => {
    window.history.pushState({}, "", releaseUrl);

    h.render(<h.App />);

    const detailPanel = h.screen.getByRole("complementary", {
      name: "Selected Ambient Works 85-92",
    });
    expect(
      h.within(detailPanel).queryByRole("button", {
        name: "Open Polynomial-C in default player",
      }),
    ).not.toBeInTheDocument();
  });
});

function seedPolynomialFiles(
  digitalFiles: (typeof h.trackRecords)[number]["digitalFiles"],
) {
  h.seedCatalogForTests({
    artists: h.artistRecords,
    releases: h.releaseRecords,
    tracks: h.trackRecords.map((track) =>
      track.id === "polynomial-c" ? { ...track, digitalFiles } : track,
    ),
    ownedItems: h.ownedItemRecords,
    relations: h.relationRecords,
    playlists: h.playlistRecords,
  });
}

function desktopBridge(
  open: ReturnType<typeof h.vi.fn>,
): Window["discweaveDesktop"] {
  return {
    isDesktop: true,
    exports: { download: h.vi.fn() },
    imports: { pickAndScan: h.vi.fn() },
    localFiles: { open },
  };
}
```

- [ ] **Step 2: Run the new application test and confirm the intended failure**

Run:

```bash
npm --prefix app test -- App.release-track-quick-open.test.tsx
```

Expected: FAIL because `ReleaseDetail` does not forward the new callback/pending props and `ReleasesWorkspace` has no Track-card quick-open orchestration. The direct-open button will be absent.

- [ ] **Step 3: Forward the typed contract through `ReleaseDetail`**

In `app/src/features/releases/ReleaseDetail.tsx`, change the Track-section import to:

```tsx
import {
  ReleaseDetailTracksSection,
  type OpenReleaseTrackLocalFiles,
} from "./ReleaseDetailTracksSection";
```

Extend `ReleaseDetailProps`:

```tsx
openingTrackId?: string
onOpenTrackLocalFiles?: OpenReleaseTrackLocalFiles
```

Destructure both values in `ReleaseDetail`, then forward them without adding behavior:

```tsx
<ReleaseDetailTracksSection
  openingTrackId={openingTrackId}
  onOpenTrackLocalFiles={onOpenTrackLocalFiles}
  onRateTarget={onRateTarget}
  ratingCriteria={ratingCriteria}
  release={release}
  tracks={sortedTracks}
/>
```

- [ ] **Step 4: Extend the workspace panel state and implement Track-specific opening**

In `app/src/features/releases/ReleasesWorkspace.tsx`, extend the local-file imports:

```tsx
import {
  isLocalFileOpenAvailable,
  openLocalFile,
  openableFilesFromReleaseTracks,
  type LocalFileOpenResult,
  type LocalOpenableFile,
} from "../localFiles/localFileOpenModel";
```

Add a named state shape above `ReleasesWorkspace` so direct failures can seed `LocalFileOpenPanel`:

```tsx
type LocalOpenPanelState = {
  files: LocalOpenableFile[];
  initialResults?: Record<string, LocalFileOpenResult>;
  title: string;
};
```

Replace the current inline panel state and add the pending Track identifier:

```tsx
const [localOpenPanel, setLocalOpenPanel] =
  useState<LocalOpenPanelState | null>(null);
const [openingTrackId, setOpeningTrackId] = useState("");
```

Keep `handleOpenReleaseLocalFiles` unchanged. Immediately after it, add:

```tsx
async function handleOpenReleaseTrackLocalFiles(
  track: TrackRecord,
  release: ReleaseRecord,
) {
  const files = openableFilesFromReleaseTracks([track], release.id);
  if (files.length === 0 || openingTrackId === track.id) {
    return;
  }

  if (files.length > 1) {
    setLocalOpenPanel({
      files,
      title: `Local files — ${track.title}`,
    });
    return;
  }

  setOpeningTrackId(track.id);
  try {
    const result = await openLocalFile(files[0]);
    if (!result.ok) {
      setLocalOpenPanel({
        files,
        initialResults: { [files[0].id]: result },
        title: `Local files — ${track.title}`,
      });
    }
  } finally {
    setOpeningTrackId((current) => (current === track.id ? "" : current));
  }
}
```

This mirrors the trusted single/multiple/failure flow already used in `TracksWorkspace`, with the stricter Release selector and a Track-card pending state.

Forward initial results to the existing panel:

```tsx
<LocalFileOpenPanel
  files={localOpenPanel.files}
  initialResults={localOpenPanel.initialResults}
  title={localOpenPanel.title}
  onClose={() => setLocalOpenPanel(null)}
/>
```

Finally, pass the Track-specific state and callback to `ReleaseDetail` next to the existing Release-level `onOpenLocalFiles` prop:

```tsx
openingTrackId={openingTrackId}
onOpenTrackLocalFiles={
  canOpenLocalFiles
    ? (track, release) => handleOpenReleaseTrackLocalFiles(track, release)
    : undefined
}
```

Do not remove or rename `onOpenLocalFiles`; that Release-level action remains available.

- [ ] **Step 5: Run focused component and application tests**

Run:

```bash
npm --prefix app test -- ReleaseDetailTracksSection.test.tsx App.release-track-quick-open.test.tsx App.local-file-open.test.tsx
```

Expected: all focused tests PASS. In particular:

- one file calls the Electron bridge once and does not navigate;
- the direct-open button is disabled and marked busy while pending;
- multiple selected-Release files open the scoped panel without an automatic bridge call;
- another Release's file does not render an action;
- a direct failure appears in the existing panel and retry succeeds;
- the existing Release-level and Track-level local-file tests remain green.

- [ ] **Step 6: Run the complete frontend quality gates**

Run each command from the repository root:

```bash
npm --prefix app test
npm --prefix app run typecheck
npm --prefix app run lint
npm --prefix app run format:check
npm --prefix app run file-size:check
```

Expected:

- Vitest reports the entire app suite passing.
- TypeScript exits with no errors.
- ESLint exits with no warnings or errors.
- Prettier reports all matched files use the expected style.
- The file-size check reports `File-size check passed (600 line limit).`

If a gate fails, fix only issues caused by this feature and rerun the failed gate plus the focused test command from Step 5.

- [ ] **Step 7: Perform the manual desktop acceptance pass**

Run the Electron development app:

```bash
npm --prefix app run desktop:dev
```

In the Releases workspace, select a Release with local files and verify:

1. The eligible Track card has one 28 × 28 px `ExternalLink` action at the top-right; cards without a Release-scoped file have no placeholder.
2. Hover shows `Open in default player`; Tab reveals a visible focus ring; Enter or Space triggers the same behavior as click.
3. A single file opens in the macOS default player while the Release stays selected.
4. A multi-file Track shows `Local files — <track title>` and lists only files attached to the selected Release.
5. Temporarily moving a fixture file produces the existing error and retry UI instead of navigating to the Track.
6. The Track title still opens `/tracks?track=<id>`, compact ratings remain usable, and the Release-level `Open local files` action is unchanged.

Stop the development process after the checks. Record any unrelated pre-existing visual issue separately; do not expand this feature's scope.

- [ ] **Step 8: Commit the orchestration and regression coverage**

```bash
git add app/src/App.release-track-quick-open.test.tsx app/src/features/releases/ReleaseDetail.tsx app/src/features/releases/ReleasesWorkspace.tsx
git commit -m "Open release track files from detail cards"
```

Expected: one commit containing workspace orchestration, prop forwarding, and application-level regression tests. `git status --short` should be empty after the commit.

---

## Final Definition of Done

- Every eligible Track card in the selected Release panel offers the approved icon-only quick-open action.
- Availability is based only on valid local files linked to that selected Release.
- Single, multiple, unavailable, pending, failure, and retry states match the approved design specification.
- The feature adds no embedded playback controls and no new filesystem/IPC path.
- Track navigation, ratings, Release selection, and the existing Release-level action are unchanged.
- Focused tests, the full frontend suite, TypeScript, ESLint, Prettier, and file-size checks all pass.
- The Electron manual acceptance pass confirms the action opens the operating system's default player.
