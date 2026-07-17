# OKF Maintenance Log

## 2026-06-27

- Created the initial DiscWeave OKF bundle.
- Captured product, domain, architecture, workflow, and roadmap knowledge that
  future agents should inspect before related implementation work.
- Replaced the repo-local DiscWeave OKF skill with the reusable global `$okf`
  skill.
- Captured the accepted Track metadata, relation-derived stack, and release-only
  tracklist row direction in the domain and import workflow pages.

## 2026-06-28

- Clarified that linked release tracklist rows can edit canonical Track
  metadata, while row position, disc, and side remain release metadata.
- Clarified that import confirmation applies reviewed Track metadata to linked
  existing Tracks.
- Captured product-owned Track stack relation semantics: `remixOf` and
  `versionOf` are protected first-class stack relation codes, while edit-like
  variants are modeled as `versionOf`.

## 2026-07-17

- Captured the collection-scoped searchable Track stack assignment workflow,
  including source and destination eligibility, explicit relation meaning, and
  shared validation with drag-and-drop.
- Captured Release-scoped Track quick-open behavior and its boundary between
  trusted operating-system file opening and in-app playback.
