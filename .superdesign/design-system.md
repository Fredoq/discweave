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
