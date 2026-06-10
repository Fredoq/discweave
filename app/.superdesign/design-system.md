# DiscWeave Design System

DiscWeave is a dense personal music archive for collectors. The UI should stay calm, precise, and work-focused.

## Visual Direction

- Use the existing muted archive palette from `src/index.css` and `src/App.css`.
- Keep page structure dense and scannable: sidebar navigation, constrained content, panels, tables, and detail asides.
- Avoid marketing layout, large decorative cards, gradients, and ornamental backgrounds.
- Controls use compact labels, 8px or smaller radii, restrained borders, and clear focus states.

## Components

- Use existing `.panel`, `.catalog-layout`, `.catalog-main`, `.detail-panel`, `.settings-control`, `.settings-mode-switch`, `.button`, `.badge`, and table classes.
- Settings forms should be grid-based and align to the rest of settings.
- For tag role mapping, distinguish portable standard fields from custom fields without adding a new visual style.

## Feature Requirements

- Tag field selection needs two modes: standard field and custom field.
- Standard fields should be offered as curated options.
- Custom field should be an explicit text input with validation hint, not hidden behind a select.
- Compatibility copy must clarify that custom fields are best-effort and format-specific.

## Discogs Release Review Requirements

- Discogs lookup must stay inside the release form, not in a modal.
- Keep the flow dense and review-oriented: search, candidates, selected review, group apply, then normal form save.
- Do not show barcode search fields, barcode values, or raw identifier lists in release lookup/review UI unless a future product task makes them first-class fields.
- Candidate rows should prioritize title, artists, year, labels, formats, catalog number, source link, and Discogs attribution.
- Selecting a candidate must reveal the review immediately near the selected candidate or in a clearly visible review rail; users should not need to discover it by scrolling.
- Review must make apply consequences explicit for Core, Artists, Labels, and Tracklist. External source provenance is applied with the selected Discogs draft after the user applies fields and saves.
- Artist role suggestions that are not already in local dictionaries should be presented as roles that will be added/accepted with the release update, not as unexplained raw Discogs strings.
- Multiple Discogs artist credits must be shown as separate rows grouped under Artists, with each artist name, one or more roles, and a clear existing-role/new-role status. Do not collapse mixed artist roles into a single comma-separated sentence.
- Tracklist review must clearly state whether tracks will be created, replaced, preserved, or updated before the user applies a group.
- Tracklist impact must show representative per-track rows, not only a count. Each row should show position, title, duration when available, track artist credits, and whether those artists/roles are matched, new, or accepted.
- Compilation and Various Artists cases must be explicit: when Discogs track rows have track-specific artists different from release artists, review should show that the release will be treated as Various Artists or that track-level artist credits will be applied. Do not hide compilation behavior behind a generic "Tracklist" checkbox.
