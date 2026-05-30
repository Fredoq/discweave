# DiscWeave Web UI Direction

This document captures the initial visual direction for DiscWeave Web.

The goal is to keep implementation decisions aligned before building the app shell, routing, screens and UI components.

## Product Positioning

DiscWeave Web is a working catalog and archive interface, not a landing page and not a music player.

The UI should feel like a precise collection database for careful collectors, DJs, bloggers and researchers:

- calm;
- fast;
- compact;
- trustworthy;
- tolerant of incomplete metadata;
- focused on ownership, credits, relations and media formats.

Do not introduce streaming, social, marketplace, public-profile or recommendation patterns into the product interface.

## Approved Direction

The approved direction is a quiet operational archive tool.

Reference mockups:

- [Catalog, search and detail workspace](assets/catalog-search-detail.png)
- [Artist detail, release detail and import flow board](assets/entity-import-board.png)

These images are direction references, not pixel-perfect implementation specs. They define density, hierarchy, layout language, component anatomy and tone.

## Layout Model

Use a persistent application shell:

- left sidebar for primary navigation;
- main workspace for the current route;
- optional right-side detail or context panel;
- compact page headers with primary actions;
- dense tables and lists for catalog data;
- filters and saved views near search/results, not as separate pages.

Primary navigation should include:

- Catalog;
- Artists;
- Releases;
- Tracks;
- Owned Items;
- Relations;
- Imports;
- Exports;
- Settings.

The first real implementation target should be the Catalog/Search/Details workspace because it establishes most of the UI system.

## Visual System

Use restrained, precise styling:

- white and very light gray surfaces;
- charcoal text;
- muted secondary text;
- thin neutral borders;
- subtle selected states;
- 6-8px border radius;
- no decorative gradients, orbs, bokeh or marketing illustration;
- no large hero sections;
- no album-cover collage as a main layout device.

Status accents should be muted and functional:

- green for owned/imported/available;
- amber for needs review or needs digitization;
- blue for digital/lossless/informational states;
- gray for skipped/sold/unknown;
- red only for destructive or failed states.

## Typography

Use crisp system sans-serif typography first.

Guidelines:

- compact but readable;
- strong page title hierarchy without hero-scale text;
- labels and table metadata should be deliberate and smaller than body text;
- no negative letter spacing;
- no viewport-scaled font sizes;
- controls, tabs, inputs and table cells must have explicit font sizing.

## Core Components

Start with a small UI foundation instead of a large component library.

Initial component set:

- `AppShell`;
- `SidebarNav`;
- `PageHeader`;
- `Button`;
- `TextField`;
- `SearchField`;
- `FilterBar`;
- `Panel`;
- `DataTable`;
- `CatalogRow`;
- `StatusBadge`;
- `MediaBadge`;
- `TagList`;
- `EmptyState`;
- `InlineAlert`;

Use native accessible controls where possible. Add headless primitives later only when a component needs robust behavior such as dialogs, menus, comboboxes or popovers.

## Catalog Workspace

The catalog screen should combine:

- global catalog search;
- saved views and filters;
- a dense result table/list;
- selected row state;
- right detail panel.

Rows should make collection state visible without extra navigation:

- artist;
- title;
- entity type;
- year or date;
- label;
- media types;
- ownership status;
- relation or credit hints.

The right detail panel should summarize:

- release or track metadata;
- owned copies;
- media formats;
- physical condition;
- storage location;
- credits;
- relations;
- tags.

## Entity Detail Screens

Artist detail pages should emphasize relationships and credits:

- aliases;
- group/member relations;
- remix credits;
- producer credits;
- collaborations;
- releases and tracks where the artist participated;
- collection coverage summary.

Release detail pages should emphasize:

- release metadata;
- tracklist;
- credits;
- media formats;
- owned copies;
- ownership state;
- physical details.

Cover art may appear as a supporting thumbnail, but should not dominate the layout.

## Import Flow

The import UI should be practical and review-oriented:

- folder selection;
- import queue;
- metadata extraction summary;
- deduplication preview;
- conflict review;
- clear statuses for pending, imported, skipped, duplicate and needs review.

Every import path must show how duplicates are handled before committing changes.

## Settings Workspace

The settings screen is a working editor for collection dictionaries, not a placeholder configuration page.

It should let a user manage the allowed values used by catalog forms:

- release types;
- artist credit roles;
- genres;
- media types;
- artist relation types;
- track relation types.

Dictionary rows should show the user-facing name, stable code, sort order and active state. The detail panel should support renaming, reordering, activating or deactivating, deleting unused entries, and replacing used entries before deletion.

Catalog forms must load options from dictionaries instead of hard-coded lists. Existing inactive values may remain visible in records, but new writes should present only active entries.

## UI-Kit Constraints

Do not create a broad abstract design system before screens prove the need.

Build the UI-kit from real DiscWeave surfaces:

1. Catalog/Search/Details;
2. Artist Detail;
3. Release Detail;
4. Import Flow;
5. Export Flow.

Keep components domain-aware where it improves clarity. For example, `MediaBadge`, `OwnershipStatus`, `CreditRole` and `CatalogRow` are more useful than generic visual wrappers.

## Implementation Notes

- Prefer React, TypeScript and local CSS first.
- Keep layout primitives simple and explicit.
- Keep table/list density high enough for serious catalog work.
- Test user-observable behavior with Testing Library.
- Keep collection data private in URLs and client state.
- Do not expose `collectionId` in normal UI routes.

## Open Questions

These decisions should be resolved before implementing the full UI-kit:

- whether the first shell should use CSS modules or plain feature-scoped CSS files;
- whether route-level data fetching should be introduced with React Router loaders or kept in explicit hooks;
- whether a headless component library is needed for dialogs, menus and comboboxes in the first milestone;
- whether a dark theme is in scope for the current product direction.
