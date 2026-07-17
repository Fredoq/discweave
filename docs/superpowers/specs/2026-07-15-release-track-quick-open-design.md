# Release Track Quick Open Design

**Status:** Approved for implementation planning
**Date:** 2026-07-15

## Context

The Releases workspace shows linked Tracks as cards in the selected Release's
right-hand detail panel. A Track title links to the full Track detail view, and
the card also exposes Track ratings. Opening a Track's local audio currently
requires navigating to the Track detail view first.

DiscWeave is a local-first archive, not an in-app music player. The existing
desktop integration safely delegates trusted local audio files to the macOS
default application through the Electron bridge. The quick action should reuse
that model instead of introducing playback controls or a player lifecycle.

## Goals

- Let a user open a Track's local audio from the Release detail Track card.
- Preserve the current dense, calm card layout and Track detail link.
- Scope the action to local files associated with the selected Release.
- Reuse the existing trusted local-file opening and error-reporting behavior.
- Make the action keyboard-accessible and unambiguous.

## Non-Goals

- An embedded audio player, queue, transport controls, or playback state.
- Streaming, cloud audio, or remote URLs.
- A guarantee that the system application starts playback automatically.
- Opening files for the same Track that belong to another Release appearance.
- Removing or changing the existing Release-level `Open local files` action.

## Selected Visual Design

Each Track card that has at least one openable local file for the selected
Release shows a compact secondary icon button in its top-right corner.

- Size: 28 by 28 pixels.
- Position: aligned to the card's top and right padding.
- Icon: Lucide `ExternalLink`.
- Tooltip: `Open in default player`.
- Accessible name: `Open <track title> in default player`.
- Styling: existing secondary-button border, surface, radius, text color, focus,
  hover, and disabled conventions.
- Title layout: reserve enough inline space for the button so a long Track title
  never renders underneath it.
- Visibility: omit the button entirely when no eligible file exists or local
  desktop opening is unavailable. Do not render a disabled placeholder.

The `ExternalLink` icon is intentional. A Play triangle would imply an embedded
player or guaranteed playback, while this action asks the operating system to
open a local file in its default application.

The selected Superdesign draft is:

- [Icon action in the Track card](https://p.superdesign.dev/draft/4590099b-3d92-4024-8cdd-c7c9e37832e1)

The alternative labeled-button exploration remains available for comparison:

- [Labeled action beside Track metadata](https://p.superdesign.dev/draft/e833c3ed-0124-49fc-8d19-8650d6a14b70)

## Interaction Behavior

### No eligible files

The card has no quick-open button. The Track title remains the only Track-level
navigation action.

### One eligible file

1. The user activates the icon button.
2. The button becomes disabled and replaces the icon with a compact pending
   indicator.
3. DiscWeave sends the existing trusted-file open request through the Electron
   bridge.
4. On success, the pending state clears. No success notification is shown;
   the system application opening is the confirmation.
5. On failure, the pending state clears and the existing local-file panel opens
   with the failed file, the returned reason, and its existing retry action.

Direct-open serialization is scoped to the selected Release. While one Track
from that Release is pending, its sibling Track actions remain disabled.
Switching to another Release exposes that Release's independent actions
immediately; completion of the earlier request must not clear or replace the
new Release's pending state.

### Multiple eligible files

1. The user activates the icon button.
2. DiscWeave opens the existing local-file panel with only the eligible files
   for this Track and selected Release.
3. The panel title is `Local files — <track title>`.
4. Each file keeps the existing format, Release position, path, open, pending,
   error, and retry treatment.

## File Scope

Eligibility is the intersection of:

- the Track represented by the card;
- the currently selected Release;
- a non-empty trusted local audio file identifier;
- a non-empty local path;
- availability of the desktop local-file bridge.

A Track may appear on multiple Releases and may have local files linked to more
than one appearance. The quick action in a Release panel must use only files
whose `releaseId` matches the selected Release. The Track detail view remains the
place to access all local files linked to the Track.

## Component Boundaries and Data Flow

### `ReleasesWorkspace`

The workspace owns the side effect and panel state:

- derive the eligible files for the requested Track and Release with the
  existing local-file open model;
- open a single file directly;
- open the existing local-file panel for multiple files;
- open the same panel with the initial failure result when direct opening fails;
- track the pending Track identifier so duplicate activation is prevented.

The local-file panel state may be extended with optional initial results so the
single-file failure can use the same established error UI.

### `ReleaseDetail`

The Release detail passes a Track-specific open callback and pending identifier
to the Tracks section. Its existing Release-level local-file actions remain
unchanged.

### `ReleaseDetailTracksSection`

The section determines whether each card has eligible files in the current
Release context and passes only presentation-level state to the card:

- whether the quick action is available;
- whether the action is pending;
- the callback for that Track.

The card does not receive local filesystem paths or call Electron APIs.

### `ReleaseDetailTrackCard`

The card renders the icon button, accessible text, pending state, and title
spacing. Activating the button does not trigger the Track title link or navigate
to the Track detail route.

## Error Handling

The trusted Electron flow remains authoritative for path validation, trust
checks, missing files, non-file paths, and operating-system errors.

- A file that becomes missing after rendering may still leave the button visible;
  activation then reports the existing `missing` result in the local-file panel.
- A disallowed or changed path reports the existing security failure without
  attempting another path.
- An operating-system failure shows the returned message in the existing panel.
- Failure never navigates to the Track detail page and never falls back to a
  different Track or Release file.

## Accessibility

- Use a native `button` with `type="button"`.
- Support Enter and Space through native button behavior.
- Retain the application's visible `focus-visible` treatment.
- Do not rely on the tooltip for the accessible name.
- Mark the icon and pending indicator as decorative when the button already has
  an accessible name.
- Keep the button disabled while its direct-open request is pending.
- Preserve the Track title as an independent link with its current destination.

## Test Strategy

Add focused component and workspace tests for these cases:

1. A card shows the action when an openable file belongs to the Track and the
   selected Release.
2. A file for the same Track but a different Release does not enable the action.
3. A card omits the action when the desktop bridge is unavailable.
4. A card omits the action for blank paths or missing local audio file IDs.
5. One eligible file invokes the trusted open bridge directly.
6. The button is disabled and visually pending during direct opening.
7. Repeated activation while pending does not issue another request.
8. A successful direct open does not show a success panel.
9. A failed direct open opens the local-file panel with the failure result and
   allows retry.
10. Multiple eligible files open the local-file panel with only the selected
    Track and Release files.
11. Activating the icon does not navigate to the Track route.
12. Activating the Track title still navigates to the Track route.
13. The existing Release-level `Open local files` behavior remains unchanged.

## Acceptance Criteria

- A Track with one eligible local file can be opened from its Release detail
  card with one activation.
- A Track with multiple eligible files offers a scoped choice without navigating
  to Track detail.
- Tracks without eligible selected-Release files do not display the action.
- The icon action preserves the current card hierarchy and rating controls.
- All failure states use the existing trusted-file result and retry UI.
- No embedded playback capability or playback state is introduced.
